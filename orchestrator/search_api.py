"""GET /search?type=all|images|news&q=...   (index-only first version)
Uses NO chat tokens: one embedding of the query, then one database call."""

import os
import re
import threading
import time as _time
from concurrent.futures import ThreadPoolExecutor
import time
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import current_user
from retriever.embedder import embed_text
from retriever.supabase_store import supabase
from discovery import commons_images, discover_news, discover_text
from intent import parse_intent, kind_score
try:
    from deep_search import deep_verify
except Exception as _e:  # the deep check is optional: without it live results are shown unverified
    print(f'[search] deep check unavailable: {_e}')
    deep_verify = None

router = APIRouter()

MIN_SIMILARITY = float(os.environ.get("SEARCH_MIN_SIMILARITY", "0.65"))  # tune on real queries
CANDIDATES = 40
MAX_RESULTS = 20
PER_MINUTE = 10

MIN_INDEX_HITS = 5          # fewer index answers than this -> also search the internet
CRAWL_PER_QUERY = 8         # at most this many new pages queued per search
CRAWL_PER_DAY = 30          # per user
_recent_queries: dict[str, float] = {}   # normalized query -> time it was last queued (24 h)
_crawled_today: dict[str, list[float]] = {}

_hits: dict[str, list[float]] = {}
_result_cache: dict[str, tuple[float, dict]] = {}   # normalized query -> (time, answer)
RESULT_CACHE_SECONDS = 600
_hits_lock = threading.Lock()


def _rate_ok(uid: str) -> bool:
    now = time.time()
    with _hits_lock:
        recent = [t for t in _hits.get(uid, []) if now - t < 60]
        if len(recent) >= PER_MINUTE:
            _hits[uid] = recent
            return False
        recent.append(now)
        _hits[uid] = recent
        return True


def _clip(s: str, n: int) -> str:
    s = " ".join((s or "").split())
    return s if len(s) <= n else s[:n].rstrip() + "…"


def _queue_for_crawl(uid: str, q: str, live: list[dict]) -> None:
    """Queue the best live results for the crawler. The same query is queued once per 24 hours,
    and each user may queue at most CRAWL_PER_DAY pages per day. The type tag comes from which API
    answered, never from page content."""
    now = time.time()
    key = " ".join(re.findall(r"\w+", q.lower()))
    with _hits_lock:
        if now - _recent_queries.get(key, 0) < 86400:
            return
        used = [t for t in _crawled_today.get(uid, []) if now - t < 86400]
        room = CRAWL_PER_DAY - len(used)
        if room <= 0:
            return
        picks = [(d.get("crawl_url") or d["url"], d["type"]) for d in live if (d.get("crawl_url") or d["url"])]
        picks = picks[: min(CRAWL_PER_QUERY, room)]
        if not picks:
            return
        _recent_queries[key] = now
        _crawled_today[uid] = used + [now] * len(picks)
    for url, kind in picks:
        if not url.lower().startswith(("http://", "https://")) or url.lower().split("?")[0].endswith(".pdf"):
            continue  # the crawler reads web pages only, not PDF files
        try:
            supabase.rpc("pgmq_send", {"queue_name": "crawl_tasks", "msg": {"url": url, "type": kind}}).execute()
        except Exception as e:
            print(f"[search] could not queue {url}: {type(e).__name__}: {e}")


@router.get("/search")
def search_endpoint(
    type: str = Query("all"),
    q: str = Query("", max_length=200),
    uid: str = Depends(current_user),
):
    if type not in ("all", "images", "news"):
        raise HTTPException(status_code=400, detail="Unknown search type")
    q = " ".join(q.split())
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    if not _rate_ok(uid):
        raise HTTPException(status_code=429, detail="Too many searches. Wait a moment.")

    if type == "news":  # live from GDELT; shown with a picture when the article has one, not stored
        return {"status": "done", "results": [
            {"title": _clip(n["title"], 200), "url": n["url"], "snippet": _clip(n["snippet"], 120), "thumb_url": n["thumb_url"]}
            for n in discover_news(q)
        ]}
    if type == "images":  # live from Wikimedia Commons, with licenses; nothing is stored
        return {"status": "done", "results": commons_images(q)}

    t0 = _time.time()
    # ADDED: the same search again within 10 minutes is answered from memory (no embedding, no internet)
    _ck = " ".join(re.findall(r"\w+", q.lower()))
    _hit = _result_cache.get(_ck)
    if _hit and t0 - _hit[0] < RESULT_CACHE_SECONDS:
        print(f"[search] q={q!r} served from cache in {(_time.time() - t0) * 1000:.0f} ms")
        return _hit[1]
    # ADDED: the internet sources and the pictures start NOW, at the same time as the embedding and
    # the index search, so a search takes as long as the slowest one, not the sum of all of them.
    _pool = ThreadPoolExecutor(max_workers=2)
    _live = _pool.submit(discover_text, q)
    _imgs = _pool.submit(commons_images, q, 8)

    vector = embed_text(q) or embed_text(q)  # one retry; embed_text returns None on any failure
    if vector is None:
        _pool.shutdown(wait=False)
        raise HTTPException(status_code=503, detail="Search is temporarily unavailable")
    t_embed = _time.time()

    try:
        rows = supabase.rpc(
            "search_chunks", {"query_embedding": vector, "match_count": CANDIDATES}
        ).execute().data or []
    except Exception as e:
        print(f"[search] rpc failed: {type(e).__name__}: {e}")
        _pool.shutdown(wait=False)
        raise HTTPException(status_code=503, detail="Search is temporarily unavailable")

    # keyword gate: a nearest-neighbour search always returns something, so a chunk must
    # also contain at least one real word of the query (words of 3+ letters)
    words = [w for w in re.findall(r"\w+", q.lower()) if len(w) >= 3]
    _intent, _topic = parse_intent(q)
    if _intent:
        words = [w for w in re.findall(r"\w+", _topic.lower()) if len(w) >= 3] or words

    best: dict[str, dict] = {}
    for r in rows:
        if (r.get("similarity") or 0) < MIN_SIMILARITY:
            continue
        text = ((r.get("title") or "") + " " + (r.get("content") or "")).lower()
        if words and not any(w in text for w in words):
            continue
        if _intent and not kind_score(_intent, r.get("title") or "", r.get("content") or "")[1]:
            continue  # the user asked for a kind of document (review, thesis, dataset, tutorial): the chunk must read like one
        doc = r["document_id"]
        if doc not in best or r["similarity"] > best[doc]["similarity"]:  # one result per document
            best[doc] = r

    # one log line per search so a "No results" can be explained: how many chunks came back,
    # how similar the best ones were, and how many survived the cutoff and the keyword gate
    top = sorted((round(r.get("similarity") or 0, 3) for r in rows), reverse=True)[:5]
    print(f"[search] q={q!r} rows={len(rows)} top_similarity={top} cutoff={MIN_SIMILARITY} kept={len(best)}")

    ordered = sorted(best.values(), key=lambda r: r["similarity"], reverse=True)[:MAX_RESULTS]
    results = []
    for r in ordered:
        url = r.get("source_url") or ""
        title = (r.get("title") or "").strip() or urlparse(url).netloc or url
        results.append({"title": _clip(title, 200), "url": url, "snippet": _clip(r.get("content"), 300)})

    # ADDED: when the index has fewer than MIN_INDEX_HITS answers, look on the internet now.
    # Live results are shown immediately; the best ones are also queued for the crawler so the
    # next search finds them in the index.
    if len(results) < MIN_INDEX_HITS:
        seen = {r["url"] for r in results}
        try:
            live_all = _live.result(timeout=7)
        except Exception:
            live_all = []
        live = [d for d in live_all if d["url"] not in seen]
        if deep_verify is not None:  # ADDED: open each page and keep only those that really match the query
            try:
                live = deep_verify(q, vector, live)
            except Exception as e:
                print(f"[search] deep check failed: {type(e).__name__}: {e}")
        for d in live:
            if len(results) >= MAX_RESULTS:
                break
            snip = d["snippet"]
            if d.get("source") and not snip.startswith(d["source"]):
                snip = f"{d['source']} · {snip}" if snip else d["source"]
            results.append({"title": _clip(d["title"], 200), "url": d["url"], "snippet": _clip(snip, 300), "thumb_url": d.get("thumb_url", "")})
        # queued in the background: each queued page is a database call and must not slow the answer
        threading.Thread(target=_queue_for_crawl, args=(uid, q, live), daemon=True).start()
    try:
        images = _imgs.result(timeout=6)
    except Exception:
        images = []
    _pool.shutdown(wait=False)
    print(f"[search] timing: embed {t_embed - t0:.1f}s, total {_time.time() - t0:.1f}s")
    payload = {"status": "done", "results": results, "images": images}
    if results or images:  # an empty answer is not cached, so a failure is retried
        if len(_result_cache) > 200:
            _result_cache.clear()
        _result_cache[_ck] = (_time.time(), payload)
    return payload