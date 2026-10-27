import os
import re  # ADDED
from pathlib import Path
from urllib.parse import urlparse  # ADDED

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

SEED_FILE = Path(__file__).parent / "seed_urls.txt"
DONE_FILE = Path(__file__).parent / "seed_done.txt"  # ADDED: sites already queued, so re-running never queues them twice

# ADDED: hosts that serve no readable pages (CDNs, trackers, DNS). Edit freely.
SKIP_DOMAINS = {
    "gstatic.com", "googleapis.com", "googleusercontent.com", "googletagmanager.com", "google-analytics.com",
    "doubleclick.net", "googlesyndication.com", "googleadservices.com", "cloudflare.com", "cloudflare.net",
    "cloudfront.net", "akamai.net", "akamaiedge.net", "akadns.net", "fastly.net", "amazonaws.com",
    "azureedge.net", "windows.net", "microsoftonline.com", "msftncsi.com", "root-servers.net",
    "fbcdn.net", "twimg.com", "ytimg.com", "ggpht.com", "apple-dns.net", "icloud-content.com",
    "tiktokcdn.com", "byteoversea.com", "snapads.com", "adnxs.com", "scorecardresearch.com",
}
# ADDED: only the top N ranked sites are queued (the list has millions; past the first few thousand it is mostly spam).
MAX_RANK = 10000
# ADDED: spam-heavy endings and words (casino, betting, adult, throwaway TLDs) are never queued.
BAD_TLDS = {"top", "xyz", "click", "loan", "win", "bid", "icu", "cfd", "sbs", "buzz", "vip", "bet", "casino",
            "porn", "xxx", "adult", "sex", "gq", "tk", "ml", "cf", "ga", "work", "rest", "monster", "cyou", "live", "fun"}
BAD_WORDS = ("casino", "slot", "bet", "porn", "sex", "xxx", "gambl", "poker", "jackpot", "azino", "lottery",
             "viagra", "escort", "hentai", "nude", "dating", "crypto", "loan")
_DOMAIN_RE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")  # ADDED


# ADDED: accepts "2,cloudflare.com", "cloudflare.com" or "https://cloudflare.com/x" -> "https://cloudflare.com".
# Returns None for junk, rank-only lines and infrastructure domains.
def normalize_seed(line: str) -> str | None:
    s = line.strip().strip('"').strip("'")
    if "," in s:
        s = s.split(",")[-1].strip()
    if "://" not in s:
        s = "https://" + s
    p = urlparse(s)
    host = (p.hostname or "").lower().rstrip(".")
    if not _DOMAIN_RE.match(host):
        return None
    if host.rsplit(".", 1)[-1] in BAD_TLDS or any(w in host for w in BAD_WORDS):  # ADDED
        return None
    if host in SKIP_DOMAINS or ".".join(host.split(".")[-2:]) in SKIP_DOMAINS:
        return None
    path = p.path if p.path not in ("", "/") else ""
    return f"https://{host}{path}"


def load_seed_urls() -> list[str]:
    urls = []
    for line in SEED_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^(\d+)\s*,", line)  # ADDED: rank limit
        if m and int(m.group(1)) > MAX_RANK:
            continue
        line = normalize_seed(line)  # ADDED
        if not line or line in urls:  # ADDED: skip junk and duplicates
            continue
        urls.append(line)
    return urls


def enqueue(url: str) -> None:
    supabase.rpc("pgmq_send", {"queue_name": "crawl_tasks", "msg": {"url": url}}).execute()


def main() -> None:
    urls = load_seed_urls()
    done = set(DONE_FILE.read_text().split()) if DONE_FILE.exists() else set()  # ADDED
    print(f"[seed] enqueuing {len(urls)} URL(s) from {SEED_FILE}")
    for url in urls:
        if url in done:  # ADDED
            continue
        enqueue(url)
        with open(DONE_FILE, "a") as f:  # ADDED
            f.write(url + "\n")
        print(f"[seed]   -> {url}")
    print("[seed] done — crawler.scheduler will pick these up on its next poll")


if __name__ == "__main__":
    main()