"""
live_web.py - live internet grounding for chat answers.

When a message needs current information (news, today, latest, prices, scores, "search the web"...), the chat
fetches real pages moments before answering and gives the model their text, so it answers from the internet
instead of from memory.

Sources, all asked at the same time, all legal and official:
  - news: GDELT + Google News RSS + BBC / CNN / Al Jazeera / Rappler feeds (discovery.discover_news)
  - the open web: Brave Search API, only when the environment variable BRAVE_API_KEY is set
  - background: Wikipedia (discovery.wiki_context)
The top few pages are opened and only the paragraphs that match the question are kept.
Every step has a time limit; if anything fails the chat simply answers as before.

needs_live(message) -> bool
gather(query, fetch_page) -> (context_text, [(title, url), ...])
"""
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as _Timeout

import requests

NEEDS_LIVE_RE = re.compile(
    r"\b(today|tonight|tomorrow|yesterday|latest|newest|breaking|news|currently|current|right now|nowadays|"
    r"recent|recently|this (?:week|month|year|weekend)|updates?|202[5-9]|price of|how much (?:is|does|are)|"
    r"exchange rate|weather|forecast|score|standings|who won|who is the (?:current|new)|release date|stocks?|"
    r"trending|happening|what happened|search (?:the )?(?:web|internet|online)|look (?:it )?up|"
    r"(?:on|from|through) the (?:internet|web)|connected to the internet|live)\b",
    re.IGNORECASE,
)
_STOP = set("the and for with that this what when where which who whom whose have has had are was were will would "
            "could should about from into your you me my our their them they there here than then also just give tell "
            "show make please can does did how why is it of in on at to a an or as by be do not".split())
DEADLINE = 7.0
MAX_PAGES = 3
MAX_CHARS = 4800


def needs_live(message: str) -> bool:
    return len((message or "").split()) >= 2 and bool(NEEDS_LIVE_RE.search(message))


def _words(q: str) -> list:
    return [w for w in re.findall(r"[a-z0-9]{3,}", q.lower()) if w not in _STOP]


def brave_search(q: str, limit: int = 5) -> list:
    key = os.environ.get("BRAVE_API_KEY", "").strip()
    if not key:
        return []
    try:
        r = requests.get("https://api.search.brave.com/res/v1/web/search",
                         params={"q": q, "count": limit, "safesearch": "moderate"},
                         headers={"X-Subscription-Token": key, "Accept": "application/json"}, timeout=5)
        r.raise_for_status()
        out = []
        for x in ((r.json().get("web") or {}).get("results") or [])[:limit]:
            if x.get("url") and x.get("title"):
                out.append({"title": re.sub(r"<[^>]+>", "", x["title"]), "url": x["url"],
                            "snippet": re.sub(r"<[^>]+>", "", x.get("description") or "")})
        return out
    except Exception as e:
        print(f"[live_web] brave failed: {type(e).__name__}")
        return []


def _relevant(text: str, words: list, max_chars: int = 1300) -> str:
    paras = [p.strip() for p in re.split(r"\n+", text or "") if len(p.strip()) > 50]
    if not paras:
        return ""
    scored = sorted(range(len(paras)), key=lambda i: (-sum(w in paras[i].lower() for w in words), i))
    keep = sorted(i for i in scored[:4] if not words or any(w in paras[i].lower() for w in words))
    body = " ".join(paras[i] for i in (keep or [0]))
    return body[:max_chars]


def gather(query: str, fetch_page, news_fn=None, wiki_fn=None, web_fn=None):
    t0 = time.time()
    if news_fn is None or wiki_fn is None:
        import discovery
        news_fn = news_fn or discovery.discover_news
        wiki_fn = wiki_fn or discovery.wiki_context
    web_fn = web_fn or brave_search
    words = _words(query)
    # not "with": leaving a with-block waits for slow threads, and a slow source must never hold the answer back
    ex = ThreadPoolExecutor(max_workers=3)
    jobs = {"news": ex.submit(news_fn, query), "web": ex.submit(web_fn, query), "wiki": ex.submit(wiki_fn, query)}
    got = {}
    for name, fut in jobs.items():
        try:
            got[name] = fut.result(timeout=max(0.5, DEADLINE - (time.time() - t0)))
        except (_Timeout, Exception) as e:
            print(f"[live_web] {name} skipped: {type(e).__name__}")
            got[name] = [] if name != "wiki" else ""
    ex.shutdown(wait=False)
    # candidates: open-web results first (when a key is set), then news
    cands, seen = [], set()
    for src in (got["web"], got["news"]):
        for it in src or []:
            u = it.get("url")
            if u and u not in seen:
                seen.add(u)
                cands.append(it)
    chosen = cands[:MAX_PAGES]
    pages = {}
    if chosen:
        ex2 = ThreadPoolExecutor(max_workers=MAX_PAGES)
        futs = {it["url"]: ex2.submit(fetch_page, it["url"]) for it in chosen}
        for u, fut in futs.items():
            try:
                pages[u] = fut.result(timeout=max(0.5, DEADLINE + 3 - (time.time() - t0))) or ""
            except (_Timeout, Exception):
                pages[u] = ""
        ex2.shutdown(wait=False)
    parts, sources = [], []
    for i, it in enumerate(chosen, 1):
        body = _relevant(pages.get(it["url"], ""), words) or (it.get("snippet") or "")
        parts.append(f"[{i}] {it['title']} ({it.get('snippet') or 'no date'})\nLink: {it['url']}\n{body}")
        sources.append((it["title"], it["url"]))
    # headlines that were not opened still tell the model what is being reported
    for it in cands[MAX_PAGES:MAX_PAGES + 4]:
        parts.append(f"Headline: {it['title']} ({it.get('snippet') or ''})\nLink: {it['url']}")
    if got.get("wiki"):
        parts.append(str(got["wiki"]))
    text = "\n\n".join(parts)[:MAX_CHARS]
    return text, sources