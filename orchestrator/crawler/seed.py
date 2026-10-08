import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

SEED_FILE = Path(__file__).parent / "seed_urls.txt"


def load_seed_urls() -> list[str]:
    urls = []
    for line in SEED_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        urls.append(line)
    return urls


def enqueue(url: str) -> None:
    supabase.rpc("pgmq_send", {"queue_name": "crawl_tasks", "msg": {"url": url}}).execute()


def main() -> None:
    urls = load_seed_urls()
    print(f"[seed] enqueuing {len(urls)} URL(s) from {SEED_FILE}")
    for url in urls:
        enqueue(url)
        print(f"[seed]   -> {url}")
    print("[seed] done — crawler.scheduler will pick these up on its next poll")


if __name__ == "__main__":
    main()