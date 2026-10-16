"""Deep check for the Search tab: opens each candidate page, reads its text, and keeps it only if the
page really talks about the query. Menu pages, section pages and unrelated links are dropped.
Gate = the page's best passage must contain the topic words of the query (no tokens, no guessing).
Ranking = the passage is embedded and compared with the query. The passage becomes the snippet."""

import asyncio
import re
import time
from concurrent.futures import ThreadPoolExecutor

from crawler.parser import parse_html, parse_title
from retriever.embedder import embed_text
from discovery import _strong, unpaywall, doi_of
from intent import parse_intent, kind_score, centrality, LABEL

WINDOW = 110          # words per passage
STEP = 70
MAX_PAGES = 16        # candidates opened per search
FETCH_BUDGET = 5.0    # seconds for opening all pages together
EMBED_MAX = 4         # at most this many passages embedded per search
MIN_COVERAGE = 0.6    # share of the topic words a passage must contain
MIN_COSINE = 0.40     # loose floor after embedding; the keyword gate is the real filter


def _passages(text: str) -> list[str]:
    words = text.split()
    if not words:
        return []
    return [" ".join(words[i:i + WINDOW]) for i in range(0, max(1, len(words) - 20), STEP)]


def _best_passage(text: str, topic: list[str]) -> tuple[str, float]:
    best, best_cov = "", 0.0
    for p in _passages(text):
        low = p.lower()
        cov = sum(w in low for w in topic) / len(topic)
        if cov > best_cov:
            best, best_cov = p, cov
    if best:  # start the snippet at the first topic word so the shown 300 characters are the relevant ones
        low = best.lower()
        pos = min((low.find(w) for w in topic if low.find(w) >= 0), default=0)
        best = best[max(0, pos - 40):]
    return best, best_cov


def _cos(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    return dot / (na * nb) if na and nb else 0.0


def _pdf_text(data: bytes) -> tuple[str, str]:
    """Text of a PDF: the first 10 pages (title, abstract, introduction) and the last 5 (reference list).
    Returns (text, title). Empty text when the file cannot be read (scanned image, encrypted, broken)."""
    try:
        import io
        from pypdf import PdfReader
        rd = PdfReader(io.BytesIO(data))
        if rd.is_encrypted:
            return "", ""
        n = len(rd.pages)
        idx = list(range(min(n, 10))) + [i for i in range(max(10, n - 5), n)]
        text = "\n".join((rd.pages[i].extract_text() or "") for i in idx)
        title = ((rd.metadata.title if rd.metadata else "") or "").strip()
        return text, title
    except Exception as e:
        print(f"[deep] pdf unreadable: {type(e).__name__}: {e}")
        return "", ""


def _read(data: bytes, kind: str) -> tuple[str, str]:
    if kind == "application/pdf":
        text, title = _pdf_text(data)
        good = len(title) > 8 and title.lower() not in ("untitled", "microsoft word - document")
        return text, (title if good else "")  # a useless PDF title is ignored: the API's title is used instead
    html = data.decode("utf-8", errors="replace")
    return parse_html(html), (parse_title(html) or "")


def _open_pages(urls: list[str]) -> dict:
    """Opens all pages and PDFs at the same time and returns {url: (text, title)}. When the time is up the
    ones already read are KEPT and the slow ones are dropped."""
    import httpx
    from crawler.fetcher import fetch_bytes

    async def run():
        raw = {}
        async with httpx.AsyncClient(headers={"User-Agent": "HepozyBot/1.0"}) as client:
            tasks = [asyncio.ensure_future(fetch_bytes(u, client)) for u in urls]
            done, pending = await asyncio.wait(tasks, timeout=FETCH_BUDGET)
            for t in pending:
                t.cancel()
            for t in done:
                try:
                    u, data, kind = t.result()
                    if data:
                        raw[u] = (data, kind)
                except Exception:
                    pass
        return raw
    try:
        raw = asyncio.run(run())
    except Exception as e:
        print(f"[deep] fetch failed: {type(e).__name__}: {e}")
        return {}
    with ThreadPoolExecutor(max_workers=4) as pool:  # reading PDFs is CPU work: do it side by side
        items = list(raw.items())
        texts = list(pool.map(lambda it: _read(it[1][0], it[1][1]), items))
    return {u: texts[i] for i, (u, _) in enumerate(items)}


def _fetch_url(c: dict) -> str:
    """Where to read the paper: the open-access copy if the API gave one, else the link; arXiv pages go to the PDF."""
    u = c.get("crawl_url") or c["url"]
    m = re.match(r"https://arxiv\.org/abs/(.+)$", u)
    return f"https://arxiv.org/pdf/{m.group(1)}" if m else u


def deep_verify(q: str, vector: list[float], candidates: list[dict]) -> list[dict]:
    """candidates: [{title,url,snippet,thumb_url,source,type,...}]. Returns the verified ones, best first,
    each with the matching passage as the snippet."""
    intent, topic_q = parse_intent(q)
    topic = _strong(topic_q)[:6]
    if not topic:
        return candidates
    cands = candidates[:MAX_PAGES]
    if intent == "news":  # news is time-sensitive and often JavaScript: trust headline + source, keep the topic check
        keep = [c for c in cands if sum(w in (c["title"] + " " + (c.get("snippet") or "")).lower() for w in topic) / len(topic) >= MIN_COVERAGE]
        print(f"[deep] news: {len(keep)}/{len(cands)} headlines match the topic")
        return keep
    t0 = time.time()
    # papers that only have a publisher link (ScienceDirect, JSTOR, Springer...) are blocked for bots:
    # look up the free legal copy by DOI first, and read that instead
    need = [c for c in cands if not c.get("crawl_url") and doi_of(c["url"])]
    if need:
        with ThreadPoolExecutor(max_workers=8) as pool:
            found = list(pool.map(lambda c: unpaywall(doi_of(c["url"])), need))
        for c, u in zip(need, found):
            if u:
                c["crawl_url"] = u
        print(f"[deep] free copies found for {sum(1 for u in found if u)}/{len(need)} publisher-only papers")
    pages = _open_pages([_fetch_url(c) for c in cands]) if cands else {}
    kept = []
    for c in cands:
        got = pages.get(_fetch_url(c))
        if got and got[0].strip():
            text, title = got
            passage, cov = _best_passage(text, topic)
            if cov < MIN_COVERAGE:
                print(f"[deep] dropped (topic words {cov:.0%}): {c['title'][:70]}")
                continue
            if intent:
                # the user asked for a kind of document (review, thesis, dataset, tutorial): the page must be one
                rscore, ok = kind_score(intent, title or c["title"], c["title"] + " " + (c.get("snippet") or "") + " " + text)
                if not (ok or c.get("api_kind") == intent):
                    print(f"[deep] dropped (not a {intent}, score {rscore}): {(title or c['title'])[:70]}")
                    continue
                passage = (LABEL[intent] + " · " if intent in LABEL else "") + passage
            about, dens, in_title = centrality(topic, title or c["title"], text)
            if not about:
                print(f"[deep] dropped (only mentions the topic, {dens:.1f} per 1000 words): {(title or c['title'])[:70]}")
                continue
            kept.append({**c, "title": title or c["title"], "snippet": passage, "_cov": cov,
                         "_central": (2.0 if in_title else 0.0) + min(dens, 10) / 10})
        else:
            print(f"[deep] could not read: {c['url'][:90]}")
            # page could not be opened (blocked, slow): trust only an API summary that itself matches
            snip = c.get("snippet") or ""
            cov = sum(w in (c["title"] + " " + snip).lower() for w in topic) / len(topic)
            if cov >= MIN_COVERAGE:
                if intent:
                    rscore, ok = kind_score(intent, c["title"], snip)
                    if not (ok or c.get("api_kind") == intent):  # is_review: the API itself tagged it a review article
                        continue
                    c = {**c, "snippet": (LABEL[intent] + " · " if intent in LABEL else "") + snip}
                kept.append({**c, "_cov": cov})
    kept.sort(key=lambda d: -d["_cov"])
    with ThreadPoolExecutor(max_workers=EMBED_MAX) as pool:
        vecs = list(pool.map(lambda d: embed_text(d["snippet"][:1500]) if d["snippet"] else None, kept[:EMBED_MAX]))
    out = []
    for i, d in enumerate(kept):
        v = vecs[i] if i < len(vecs) else None
        d["_sim"] = _cos(vector, v) if v else 0.0
        if v and d["_sim"] < MIN_COSINE:
            continue
        out.append(d)
    out.sort(key=lambda d: (-d.get("_central", 0), -d["_cov"], -d["_sim"]))
    print(f"[deep] opened {len(pages)}/{len(cands)} pages, verified {len(out)}, {time.time() - t0:.1f}s, "
          f"topic={topic}, sims={[round(d['_sim'], 2) for d in out[:5]]}")
    return out