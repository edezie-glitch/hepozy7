import asyncio
import os
import time

from dotenv import load_dotenv
from supabase import create_client

from crawler.chunker import chunk_text
from crawler.deduper import is_duplicate, record_document
from crawler.deduper import set_document_meta  # ADDED
from crawler.fetcher import fetch_many
from crawler.parser import parse_html
from crawler.parser import parse_title  # ADDED
from crawler.storage_client import archive_raw

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
POLL_INTERVAL_SECONDS = 10
MAX_RETRIES = 3  # after this many failed attempts, archive (drop) instead of retrying forever

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _read_crawl_tasks(batch_size: int = 5) -> list[dict]:
    try:
        result = supabase.rpc(
            "pgmq_read", {"queue_name": "crawl_tasks", "vt": 30, "qty": batch_size}
        ).execute()
        return result.data or []
    except Exception as e:
        # CHANGED: previously this exception bubbled up and got caught by
        # run_forever()'s generic except, printing only the raw network
        # error with no indication of WHICH step failed. Now explicitly
        # tagged as a Supabase read failure.
        raise RuntimeError(f"Supabase pgmq_read failed: {e}") from e


def _archive_message(msg_id: int) -> None:
    try:
        supabase.rpc("pgmq_archive", {"queue_name": "crawl_tasks", "msg_id": msg_id}).execute()
    except Exception as e:
        raise RuntimeError(f"Supabase pgmq_archive failed for msg_id={msg_id}: {e}") from e


def _push_embed_task(document_id: str, chunk: str) -> None:
    try:
        supabase.rpc(
            "pgmq_send",
            {"queue_name": "embed_tasks", "msg": {"document_id": document_id, "content": chunk}},
        ).execute()
    except Exception as e:
        raise RuntimeError(f"Supabase pgmq_send (embed_tasks) failed for document_id={document_id}: {e}") from e


async def _process_one(task: dict, html: str | None) -> None:
    """
    Isolated per-task work. Any exception here is caught by the caller in
    process_batch() so one bad task can never take down the whole worker.
    """
    url = task["message"]["url"]

    if html is None:
        retry_count = task.get("read_ct", 1)  # pgmq increments this on each read
        if retry_count >= MAX_RETRIES:
            print(f"[scheduler] {url} failed fetch {retry_count}x, dropping (dead-letter)")
            _archive_message(task["msg_id"])
        # else: leave the message alone, it becomes visible again after the vt expires
        return

    text = parse_html(html)

    if is_duplicate(url, text):
        print(f"[scheduler] {url} is a duplicate, skipping")
        _archive_message(task["msg_id"])
        return

    document_id = record_document(url, text)
    # ADDED: title and type. The type comes from the queue message (set by whoever queued the URL),
    # never from the page content; anything unknown is stored as "web".
    doc_type = task["message"].get("type")
    if doc_type not in ("paper", "web"):
        doc_type = "web"
    try:
        set_document_meta(document_id, parse_title(html), doc_type)
    except Exception as e:
        print(f"[scheduler] could not save title/type for {url}: {e}")
    archive_raw(document_id, html)

    for chunk in chunk_text(text):
        _push_embed_task(document_id, chunk)

    _archive_message(task["msg_id"])
    print(f"[scheduler] {url} processed successfully, document_id={document_id}")


async def process_batch() -> None:
    # CHANGED: this step is now isolated with its own try/except and an
    # explicit tag, so a failure here (reading from Supabase) is never
    # confused with a failure fetching a URL (network/DNS to the target
    # site) - these were previously indistinguishable, both just showing
    # up as a bare WinError/Errno with no context.
    try:
        tasks = _read_crawl_tasks()
    except Exception as e:
        print(f"[scheduler] FAILED READING QUEUE (Supabase): {e}")
        return

    if not tasks:
        return

    urls = [t["message"]["url"] for t in tasks]

    try:
        fetched = await fetch_many(urls)
    except Exception as e:
        print(f"[scheduler] FAILED FETCHING URLS ({urls}): {e}")
        return

    for task in tasks:
        try:
            url = task["message"]["url"]
            await _process_one(task, fetched.get(url))
        except Exception as e:
            print(f"[scheduler] task {task.get('msg_id')} ({task.get('message', {}).get('url')}) failed unexpectedly: {e}")


def run_forever() -> None:
    print("[scheduler] polling crawl_tasks every", POLL_INTERVAL_SECONDS, "seconds")
    while True:
        try:
            asyncio.run(process_batch())
        except Exception as e:
            print(f"[scheduler] process_batch() failed: {e}")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_forever()