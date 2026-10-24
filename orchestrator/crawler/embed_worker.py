"""Reads the embed_tasks queue, turns each chunk into a vector and stores it in document_chunks.
Run from the orchestrator folder, in its own terminal, and leave it open:
    py -3.14 -m crawler.embed_worker
Same style as crawler/scheduler.py. A failed embedding is retried after 60 seconds, up to 5 times."""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from retriever.embedder import embed_text
from retriever.supabase_store import supabase, upsert_chunk

QUEUE = "embed_tasks"
POLL_INTERVAL_SECONDS = 10
BATCH = 5
VISIBILITY_SECONDS = 60   # a message that was read but not finished comes back after this long
MAX_RETRIES = 5           # after this many failed attempts the chunk is dropped
PAUSE_BETWEEN_EMBEDS = 1.0  # keeps the embedding calls under the per-minute limit


def _read() -> list[dict]:
    result = supabase.rpc("pgmq_read", {"queue_name": QUEUE, "vt": VISIBILITY_SECONDS, "qty": BATCH}).execute()
    return result.data or []


def _archive(msg_id: int) -> None:
    supabase.rpc("pgmq_archive", {"queue_name": QUEUE, "msg_id": msg_id}).execute()


def _already_stored(document_id: str, content: str) -> bool:
    """Protects against a chunk being stored twice (for example if two workers run)."""
    r = (
        supabase.table("document_chunks").select("id")
        .eq("document_id", document_id).eq("content", content).limit(1).execute()
    )
    return bool(r.data)


def process(task: dict) -> None:
    msg = task["message"]
    document_id, content = msg.get("document_id"), msg.get("content")
    if not document_id or not content:
        print(f"[embed] message {task['msg_id']} has no document_id or content, dropping")
        _archive(task["msg_id"])
        return
    if _already_stored(document_id, content):
        _archive(task["msg_id"])
        return
    vector = embed_text(content)
    if vector is None:
        if task.get("read_ct", 1) >= MAX_RETRIES:
            print(f"[embed] message {task['msg_id']} failed {MAX_RETRIES}x, dropping")
            _archive(task["msg_id"])
        return  # otherwise it comes back after the visibility time
    upsert_chunk(document_id, content, vector, {})
    _archive(task["msg_id"])
    print(f"[embed] stored a chunk for document {document_id}")
    time.sleep(PAUSE_BETWEEN_EMBEDS)


def run_forever() -> None:
    print(f"[embed] polling {QUEUE} every {POLL_INTERVAL_SECONDS} seconds")
    while True:
        try:
            tasks = _read()
        except Exception as e:
            print(f"[embed] FAILED READING QUEUE (Supabase): {e}")
            time.sleep(POLL_INTERVAL_SECONDS)
            continue
        for task in tasks:
            try:
                process(task)
            except Exception as e:
                print(f"[embed] task {task.get('msg_id')} failed unexpectedly: {e}")
        if not tasks:
            time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_forever()