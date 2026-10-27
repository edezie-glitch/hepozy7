"""Finds sources on the internet for a search query, using official free APIs
(no scraping of search engines, no keys needed):
  - Wikipedia search  -> web pages          (type "web")
  - OpenAlex          -> research papers    (type "paper")
  - Wikimedia Commons -> images             (licensed, with a license name)
Every function returns [] on any failure, so search never breaks because one source is down."""

import html
import os
import re
import time
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus, urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote

import requests

TIMEOUT = 3
NEWS_TIMEOUT = 6  # GDELT is often slow; a slow source is skipped, never waited for
DEADLINE = 4  # seconds: the most a search waits for all sources together
HEADERS = {"User-Agent": "HepozyBot/1.0 (https://hepozy.com; search discovery)"}
MAILTO = os.environ.get("OPENALEX_MAILTO", "")  # optional: puts you in OpenAlex's faster "polite" pool


def _get(url: str, params: dict, timeout: int = TIMEOUT) -> dict | None:
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[discovery] {url.split('/')[2]} failed: {type(e).__name__}: {e}")
        return None


def _plain(s: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", s or "")).split())


def wikipedia(q: str, limit: int = 8) -> list[dict]:
    d = _get("https://en.wikipedia.org/w/api.php", {
        "action": "query", "generator": "search", "gsrsearch": q, "gsrlimit": limit,
        "prop": "pageimages|extracts", "piprop": "thumbnail", "pithumbsize": 160,
        "exintro": 1, "explaintext": 1, "exsentences": 2, "exlimit": "max",
        "format": "json", "utf8": 1,
    })
    pages = list((((d or {}).get("query") or {}).get("pages") or {}).values())
    pages.sort(key=lambda p: p.get("index", 0))  # the API returns them keyed by id; "index" is the rank
    out = []
    for r in pages:
        title = r.get("title")
        if not title:
            continue
        out.append({
            "title": title,
            "url": "https://en.wikipedia.org/wiki/" + quote(title.replace(" ", "_"), safe="_()"),
            "snippet": _plain(r.get("extract")),
            "thumb_url": ((r.get("thumbnail") or {}).get("source")) or "",
            "type": "web",
            "source": "Wikipedia",
            "crawl_url": None,  # same as url
        })
    return out


def _abstract(inv: dict | None) -> str:
    if not isinstance(inv, dict):
        return ""
    words = {}
    for word, positions in inv.items():
        for p in positions or []:
            words[p] = word
    return " ".join(words[i] for i in sorted(words))


def openalex(q: str, limit: int = 8, review: bool = False, work_type: str = "") -> list[dict]:
    params = {
        "search": q, "per-page": limit,
        "select": "id,title,doi,publication_year,primary_location,open_access,abstract_inverted_index",
    }
    if review:
        work_type = "review"
    if work_type:
        params["filter"] = "type:" + work_type  # OpenAlex tags review, dissertation, dataset...: ask for that type only
    if MAILTO:
        params["mailto"] = MAILTO
    d = _get("https://api.openalex.org/works", params)
    out = []
    for w in (d or {}).get("results") or []:
        title = w.get("title")
        loc = w.get("primary_location") or {}
        url = w.get("doi") or loc.get("landing_page_url") or w.get("id")
        if not title or not url:
            continue
        snippet = _abstract(w.get("abstract_inverted_index"))[:400]
        if w.get("publication_year"):
            snippet = f"{w['publication_year']} · {snippet}" if snippet else str(w["publication_year"])
        oa = (w.get("open_access") or {}).get("oa_url")
        out.append({"title": _plain(title), "url": url, "snippet": snippet, "type": "paper", "source": "OpenAlex", "crawl_url": oa,
                    "api_kind": {"dissertation": "thesis"}.get(work_type, work_type)})
    return out


def commons_images(q: str, limit: int = 20) -> list[dict]:
    """Pictures from Wikimedia Commons and Openverse (Flickr, museums, Wikimedia...), both with licenses,
    asked at the same time and interleaved. Nothing is stored."""
    def work():
        ex = ThreadPoolExecutor(max_workers=2)
        fa, fb = ex.submit(_commons_images, q, limit), ex.submit(openverse_images, q, limit)
        got = []
        for f in (fa, fb):
            try:
                got.append(f.result(timeout=DEADLINE))
            except Exception:
                got.append([])
        ex.shutdown(wait=False)
        out, i = [], 0
        while any(i < len(g) for g in got) and len(out) < limit:
            for g in got:
                if i < len(g):
                    out.append(g[i])
            i += 1
        return out[:limit]
    return _cached(f"img:{limit}:{q.lower()}", work)


def openverse_images(q: str, limit: int = 20) -> list[dict]:
    """Openverse: free image search over openly licensed pictures from many sources. No key needed."""
    d = _get("https://api.openverse.org/v1/images/", {"q": q, "page_size": min(limit, 20), "mature": "false"})
    out = []
    for r in (d or {}).get("results") or []:
        thumb, full = r.get("thumbnail") or r.get("url"), r.get("url")
        page = r.get("foreign_landing_url") or full
        if not thumb or not page or not str(page).startswith("http"):
            continue
        lic = " ".join(x for x in (str(r.get("license") or "").upper(), str(r.get("license_version") or "")) if x)
        out.append({"title": _plain(r.get("title") or r.get("creator") or "Image"), "url": page,
                    "image_url": full, "thumb_url": thumb, "license": lic})
    return out


def _commons_images(q: str, limit: int) -> list[dict]:
    d = _get("https://commons.wikimedia.org/w/api.php", {
        "action": "query", "generator": "search", "gsrsearch": q, "gsrnamespace": 6, "gsrlimit": limit,
        "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 320,
        "format": "json", "utf8": 1,
    })
    out = []
    for page in (((d or {}).get("query") or {}).get("pages") or {}).values():
        info = (page.get("imageinfo") or [None])[0]
        if not info:
            continue
        meta = info.get("extmetadata") or {}
        thumb = info.get("thumburl") or info.get("url")
        if not thumb or not str(info.get("url", "")).lower().split("?")[0].endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
            continue
        title = re.sub(r"^File:", "", page.get("title") or "")
        title = re.sub(r"\.\w+$", "", title)
        out.append({
            "title": _plain(title),
            "url": info.get("descriptionurl") or info.get("url"),
            "image_url": info.get("url"),
            "thumb_url": thumb,
            "license": _plain((meta.get("LicenseShortName") or {}).get("value")),
        })
    return out


# ---------------------------------------------------------------------------------------------
# MORE PAPER SOURCES (official free APIs, no key): arXiv, DOAJ, Zenodo
# ---------------------------------------------------------------------------------------------
def arxiv(q: str, limit: int = 6, review: bool = False) -> list[dict]:
    words = _strong(q)[:5]
    if not words:
        return []
    try:
        r = requests.get("https://export.arxiv.org/api/query", headers=HEADERS, timeout=TIMEOUT, params={
            "search_query": " AND ".join("all:" + w for w in words) + (
                ' AND (ti:survey OR ti:review OR ti:overview OR abs:"literature review" OR abs:"systematic review")' if review else ""),
            "start": 0, "max_results": limit,
            "sortBy": "relevance"})
        r.raise_for_status()
        raw = r.content[:2_000_000]
        if b"<!DOCTYPE" in raw[:2000].upper() or b"<!ENTITY" in raw.upper():
            return []
        root = ET.fromstring(raw)
    except Exception as e:
        print(f"[discovery] arxiv failed: {type(e).__name__}: {e}")
        return []
    ns = "{http://www.w3.org/2005/Atom}"
    out = []
    for e in root.iter(ns + "entry"):
        title = _plain((e.findtext(ns + "title") or ""))
        url = (e.findtext(ns + "id") or "").strip().replace("http://", "https://")
        if not title or not url.startswith("https://arxiv.org/"):
            continue
        year = (e.findtext(ns + "published") or "")[:4]
        summary = _plain(e.findtext(ns + "summary") or "")[:400]
        out.append({"title": title, "url": url, "snippet": f"{year} · {summary}" if year else summary,
                    "type": "paper", "source": "arXiv", "crawl_url": url})
    return out


def doaj(q: str, limit: int = 6) -> list[dict]:
    d = _get("https://doaj.org/api/search/articles/" + quote(q, safe=""), {"pageSize": limit})
    out = []
    for r in (d or {}).get("results") or []:
        b = r.get("bibjson") or {}
        title = _plain(b.get("title"))
        links = [l.get("url") for l in (b.get("link") or []) if str(l.get("url", "")).startswith("https://")]
        if not title or not links:
            continue
        snippet = _plain(b.get("abstract"))[:400]
        if b.get("year"):
            snippet = f"{b['year']} · {snippet}" if snippet else str(b["year"])
        out.append({"title": title, "url": links[0], "snippet": snippet, "type": "paper", "source": "DOAJ", "crawl_url": links[0]})
    return out


def zenodo(q: str, limit: int = 6) -> list[dict]:
    d = _get("https://zenodo.org/api/records", {"q": q, "size": limit, "sort": "bestmatch"})
    out = []
    for h in (((d or {}).get("hits") or {}).get("hits")) or []:
        m = h.get("metadata") or {}
        url = (h.get("links") or {}).get("self_html") or (h.get("links") or {}).get("html") or ""
        title = _plain(m.get("title"))
        if not title or not str(url).startswith("https://"):
            continue
        out.append({"title": title, "url": url, "snippet": _plain(m.get("description"))[:400],
                    "type": "paper", "source": "Zenodo", "crawl_url": url})
    return out


# ---------------------------------------------------------------------------------------------
# SEED SITES: ask the site's own search page, then take the top result links it lists.
# Each entry: name, base address, search path ({q} = the query), and which link paths count as
# a result (so menus and footers are ignored). A site that blocks bots, draws its results with
# JavaScript, or changes its layout simply returns nothing: it never breaks search.
# ---------------------------------------------------------------------------------------------
SITE_SEARCH = [
    ("Britannica", "https://www.britannica.com", "/search?query={q}", r"^/(topic|biography|science|place|event|animal|plant|technology|art|sports|money|story)/"),
    ("Stanford Encyclopedia", "https://plato.stanford.edu", "/search/searcher.py?query={q}", r"^/entries/"),
    ("Internet Encyclopedia of Philosophy", "https://iep.utm.edu", "/?s={q}", r"^/[a-z0-9\-]+/?$"),
    ("Rappler", "https://www.rappler.com", "/?s={q}", r"^/[a-z\-]+/.+"),
    ("Project Gutenberg", "https://www.gutenberg.org", "/ebooks/search/?query={q}", r"^/ebooks/\d+$"),
    ("Open Library", "https://openlibrary.org", "/search?q={q}", r"^/works/OL\w+"),
    ("Wikibooks", "https://en.wikibooks.org", "/w/index.php?search={q}&fulltext=1&ns0=1", r"^/wiki/[^:?#]+$"),
]


def site_search(name: str, base: str, path: str, link_re: str, q: str, limit: int = 3) -> list[dict]:
    try:
        from bs4 import BeautifulSoup
        r = requests.get(base + path.format(q=quote_plus(q)), headers=HEADERS, timeout=TIMEOUT, stream=True)
        r.raise_for_status()
        host = urlparse(base).hostname
        final = urlparse(r.url).hostname or ""
        if final != host:  # a redirect to another site is not followed into
            return []
        body = r.raw.read(1_500_000, decode_content=True)
        soup = BeautifulSoup(body, "html.parser")
    except Exception as e:
        print(f"[discovery] {name} search failed: {type(e).__name__}: {e}")
        return []
    pat = re.compile(link_re)
    topic = _strong(q)  # a result must mention a topic word in its title or address, which removes menus and section links
    if not topic:
        return []
    seen, out = set(), []
    for a in soup.find_all("a", href=True):
        url = urljoin(base + "/", a["href"]).split("#")[0]
        p = urlparse(url)
        if p.scheme != "https" or p.hostname != host or not pat.search(p.path) or url in seen:
            continue
        title = _plain(a.get_text(" "))
        if len(title) < 12 or not any(w in (title + " " + p.path).lower() for w in topic):
            continue
        seen.add(url)
        out.append({"title": title[:200], "url": url, "snippet": name, "type": "web", "source": name, "crawl_url": None})
        if len(out) >= limit:
            break
    return out


def _gather(fns: list, deadline: float = DEADLINE) -> list[list]:
    """Runs the functions at the same time and waits at most `deadline` seconds in total.
    A source that is not done by then is skipped (its thread finishes in the background)."""
    ex = ThreadPoolExecutor(max_workers=len(fns))
    futs = [ex.submit(f) for f in fns]
    end = time.time() + deadline
    out = []
    for f in futs:
        try:
            out.append(f.result(timeout=max(0.05, end - time.time())))
        except Exception:
            out.append([])
    ex.shutdown(wait=False)
    return out



# ---------------------------------------------------------------------------------------------
# MORE PAPER SOURCES (free, no key). Added so a search never depends on arXiv + OpenAlex alone.
# Every one returns [] on any failure.
# ---------------------------------------------------------------------------------------------
def semantic_scholar(q: str, limit: int = 10, review: bool = False) -> list[dict]:
    params = {"query": q, "limit": limit, "fields": "title,year,url,abstract,openAccessPdf,publicationTypes"}
    if review:
        params["publicationTypes"] = "Review"  # Semantic Scholar tags review articles
    d = _get("https://api.semanticscholar.org/graph/v1/paper/search", params)
    out = []
    for p in (d or {}).get("data") or []:
        title, url = p.get("title"), p.get("url")
        if not title or not url:
            continue
        pdf = (p.get("openAccessPdf") or {}).get("url")
        snip = _plain(p.get("abstract"))[:400]
        snip = f"{p['year']} · {snip}" if p.get("year") and snip else (str(p.get("year") or "") or snip)
        out.append({"title": _plain(title), "url": url, "snippet": snip, "type": "paper", "source": "Semantic Scholar",
                    "crawl_url": pdf, "api_kind": "review" if review else ""})
    return out


def dblp(q: str, limit: int = 12) -> list[dict]:
    """DBLP: computer-science papers. Good for automata, algorithms, AI. Has no review filter: put 'survey' in q."""
    d = _get("https://dblp.org/search/publ/api", {"q": q, "format": "json", "h": limit})
    hits = ((((d or {}).get("result") or {}).get("hits") or {}).get("hit")) or []
    out = []
    for h in hits:
        i = h.get("info") or {}
        title, url = _plain(i.get("title")), i.get("ee") or i.get("url")
        if isinstance(url, list):
            url = url[0] if url else None
        if not title or not url or not str(url).startswith("http"):
            continue
        out.append({"title": title, "url": url, "snippet": " · ".join(x for x in (str(i.get("year") or ""), i.get("venue") if isinstance(i.get("venue"), str) else "") if x),
                    "type": "paper", "source": "DBLP", "crawl_url": None})
    return out


def crossref(q: str, limit: int = 10) -> list[dict]:
    """Crossref: the DOI registry. Nearly every journal paper is here, with its abstract when the publisher gave one."""
    params = {"query.bibliographic": q, "rows": limit, "filter": "type:journal-article",
              "select": "title,DOI,URL,abstract,issued"}
    if MAILTO:
        params["mailto"] = MAILTO
    d = _get("https://api.crossref.org/works", params)
    out = []
    for w in (((d or {}).get("message") or {}).get("items")) or []:
        title = _plain((w.get("title") or [""])[0])
        url = w.get("URL") or (("https://doi.org/" + w["DOI"]) if w.get("DOI") else "")
        if not title or not url:
            continue
        year = ((w.get("issued") or {}).get("date-parts") or [[None]])[0][0]
        snip = _plain(re.sub(r"<[^>]+>", " ", w.get("abstract") or ""))[:400]
        out.append({"title": title, "url": url, "snippet": f"{year} · {snip}" if year and snip else (str(year or "") or snip),
                    "type": "paper", "source": "Crossref", "crawl_url": None})
    return out


def europe_pmc(q: str, limit: int = 10, review: bool = False) -> list[dict]:
    """Europe PMC: life-science and medicine papers, many with free full text."""
    query = q + (' AND (PUB_TYPE:"review" OR PUB_TYPE:"Review Literature")' if review else "")
    d = _get("https://www.ebi.ac.uk/europepmc/webservices/rest/search",
             {"query": query, "format": "json", "pageSize": limit, "resultType": "core"})
    out = []
    for r in (((d or {}).get("resultList") or {}).get("result")) or []:
        title = _plain(r.get("title"))
        doi, pmid = r.get("doi"), r.get("pmid")
        url = ("https://doi.org/" + doi) if doi else (f"https://europepmc.org/article/MED/{pmid}" if pmid else "")
        if not title or not url:
            continue
        free = None
        for l in ((r.get("fullTextUrlList") or {}).get("fullTextUrl")) or []:
            if l.get("availabilityCode") == "OA" and l.get("url"):
                free = l["url"]
                break
        snip = _plain(r.get("abstractText"))[:400]
        out.append({"title": title, "url": url, "snippet": f"{r.get('pubYear')} · {snip}" if r.get("pubYear") and snip else snip,
                    "type": "paper", "source": "Europe PMC", "crawl_url": free, "api_kind": "review" if review else ""})
    return out



UNPAYWALL_EMAIL = os.environ.get("UNPAYWALL_EMAIL") or MAILTO  # Unpaywall asks for a real email, no key


def unpaywall(doi: str) -> str | None:
    """The free, legal copy of a paper (author manuscript, repository copy, open-access PDF) for a DOI.
    This is how a ScienceDirect / JSTOR / publisher paper becomes readable: the publisher page is blocked,
    the free copy usually is not. Returns a URL or None."""
    if not UNPAYWALL_EMAIL or not doi:
        return None
    d = _get(f"https://api.unpaywall.org/v2/{quote(doi, safe='/')}", {"email": UNPAYWALL_EMAIL}, timeout=3)
    best = (d or {}).get("best_oa_location") or {}
    return best.get("url_for_pdf") or best.get("url_for_landing_page") or best.get("url") or None


def doi_of(url: str) -> str | None:
    m = re.match(r"https?://(?:dx\.)?doi\.org/(10\.\d{4,9}/\S+)$", url or "", re.I)
    return m.group(1) if m else None


def source_plan(q: str):
    """(intent, topic, [functions]) for the All tab: which sources to ask for this kind of query."""
    from intent import parse_intent
    intent, topic = parse_intent(q)
    if intent == "review":
        # the user wants review/survey papers: ask only the paper sources, and ask them for reviews
        fns = [lambda: openalex(topic, 10, True), lambda: arxiv(topic, 8, True),
               lambda: openalex(topic + " literature review survey", 6),
               lambda: openalex(topic, 6, work_type="dissertation"),  # RRLs live in theses too
               lambda: semantic_scholar(topic, 10, True), lambda: dblp(topic + " survey"),
               lambda: crossref(topic + " review survey"), lambda: europe_pmc(topic, 6, True)]
    elif intent == "thesis":
        fns = [lambda: openalex(topic, 12, work_type="dissertation"), lambda: openalex(topic + " thesis", 6)]
    elif intent == "dataset":
        fns = [lambda: openalex(topic, 10, work_type="dataset"), lambda: zenodo(topic + " dataset"),
               lambda: openalex(topic + " dataset", 6)]
    elif intent == "tutorial":
        fns = [lambda: wikipedia(topic, 4)] + [(lambda s=s: site_search(*s, topic)) for s in SITE_SEARCH]
        fns += [lambda: openalex(topic + " tutorial introduction", 6)]
    elif intent == "news":
        fns = [lambda: [{**n, "type": "web", "source": "News", "crawl_url": None} for n in discover_news(topic)]]
    elif intent == "academic":
        fns = [lambda: openalex(q, 8), lambda: arxiv(q, 6), lambda: semantic_scholar(q, 6), lambda: dblp(q, 6),
               lambda: crossref(q, 6), lambda: wikipedia(q, 3)]
    else:
        # an ordinary topic (a person, a place, a thing, an event): encyclopedias and the seed sites, NOT papers
        fns = [lambda: wikipedia(q, 8)] + [(lambda s=s: site_search(*s, q)) for s in SITE_SEARCH]
    return intent, topic, fns


def discover_text(q: str) -> list[dict]:
    """Web pages and papers for the All tab, fetched at the same time."""
    intent, topic, fns = source_plan(q)
    groups = _gather(fns)
    # take results turn by turn from each source, so one source cannot fill the whole list
    out, i = [], 0
    while any(i < len(g) for g in groups):
        for g in groups:
            if i < len(g):
                out.append(g[i])
        i += 1
    return out


def discover_stream(q: str, on_group, deadline: float = DEADLINE) -> None:
    """Same sources as discover_text, but each source's results are handed to on_group(list) THE MOMENT
    that source answers, so the page checks can start while slower sources are still running."""
    from concurrent.futures import as_completed
    intent, topic, fns = source_plan(q)
    ex = ThreadPoolExecutor(max_workers=len(fns))
    futs = [ex.submit(f) for f in fns]
    try:
        for f in as_completed(futs, timeout=deadline):
            try:
                g = f.result()
            except Exception:
                g = []
            if g:
                on_group(g)
    except Exception:
        pass  # deadline reached: slower sources are skipped
    ex.shutdown(wait=False)


def gdelt_news(q: str, limit: int = 15) -> list[dict]:
    """News articles from the GDELT DOC API (free, no key). It gives title, link, domain, date and
    usually a picture. News pages are shown but not stored in the index."""
    d = _get("https://api.gdeltproject.org/api/v2/doc/doc", {
        "query": f"{q} sourcelang:english", "mode": "artlist", "format": "json",
        "maxrecords": limit, "sort": "datedesc",
    }, timeout=NEWS_TIMEOUT)
    out = []
    for a in (d or {}).get("articles") or []:
        url, title = a.get("url"), a.get("title")
        if not url or not title:
            continue
        seen = str(a.get("seendate") or "")  # 20261016T053000Z
        date = f"{seen[0:4]}-{seen[4:6]}-{seen[6:8]}" if len(seen) >= 8 else ""
        out.append({
            "title": _plain(title),
            "url": url,
            "snippet": " · ".join(x for x in (a.get("domain"), date) if x),
            "thumb_url": a.get("socialimage") or "",
        })
    return out


# ---------------------------------------------------------------------------------------------
# NEWS: three sources asked at the same time, merged. Any one can be slow or down.
#   1. GDELT (open news index)      2. Google News RSS (a feed meant for readers)
#   3. Publisher RSS feeds (BBC, CNN, Al Jazeera, Rappler), filtered by the query words
# ---------------------------------------------------------------------------------------------
PUBLISHER_FEEDS = [
    ("BBC", "https://feeds.bbci.co.uk/news/rss.xml"),
    ("CNN", "http://rss.cnn.com/rss/edition.rss"),
    ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
    ("Rappler", "https://www.rappler.com/feed/"),
]
_cache: dict[str, tuple[float, list]] = {}
CACHE_SECONDS = 600


def _cached(key: str, fn):
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < CACHE_SECONDS:
        return hit[1]
    value = fn()
    if value:  # an empty answer is not cached, so a failure is retried next time
        if len(_cache) > 500:
            _cache.clear()
        _cache[key] = (now, value)
    return value


def _rss(url: str, source: str | None, timeout: int = TIMEOUT) -> list[dict]:
    """Reads an RSS feed. Feeds that declare entities or a DOCTYPE are refused (XML bomb guard)."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        raw = r.content[:2_000_000]
        if b"<!DOCTYPE" in raw[:2000].upper() or b"<!ENTITY" in raw.upper():
            return []
        root = ET.fromstring(raw)
    except Exception as e:
        print(f"[discovery] feed {url.split('/')[2]} failed: {type(e).__name__}: {e}")
        return []
    out = []
    for item in root.iter("item"):
        def pick(name):
            for ch in item:
                if ch.tag.split("}")[-1] == name:
                    return ch
            return None
        t, l, d, p, src = pick("title"), pick("link"), pick("description"), pick("pubDate"), pick("source")
        title = _plain(t.text if t is not None else "")
        link = (l.text or "").strip() if l is not None else ""
        if not title or not link.startswith(("http://", "https://")):
            continue
        thumb = ""
        for ch in item.iter():
            tag = ch.tag.split("}")[-1]
            if tag in ("thumbnail", "content", "enclosure") and ch.get("url", "").startswith("https://"):
                if tag != "content" or ch.get("medium", "image") == "image":
                    thumb = ch.get("url")
                    break
        date = _plain(p.text if p is not None else "")[:16]
        name = source or (_plain(src.text) if src is not None else "")
        out.append({
            "title": title, "url": link, "thumb_url": thumb,
            "text": _plain(d.text if d is not None else ""),
            "snippet": " · ".join(x for x in (name, date) if x),
        })
    return out


def _words(q: str) -> list[str]:
    return [w for w in re.findall(r"\w+", q.lower()) if len(w) >= 3]


_STOP = {"literature", "riview", "review", "survey", "overview", "systematic", "state", "art", "research", "study", "paper", "papers", "about", "from", "with", "that", "what",
         "this", "which", "where", "when", "into", "using", "some", "have", "does", "give", "show", "find", "need"}


def _strong(q: str) -> list[str]:
    """The words that carry the topic: 4+ letters and not filler like "literature" or "review".
    Falls back to all words of 3+ letters when none are left."""
    w = [x for x in re.findall(r"\w+", q.lower()) if len(x) >= 4 and x not in _STOP]
    return w or _words(q)


def google_news(q: str, limit: int = 15) -> list[dict]:
    url = "https://news.google.com/rss/search?q=" + quote(q) + "&hl=en-US&gl=US&ceid=US:en"
    return _rss(url, None)[:limit]


def publisher_news(q: str, limit: int = 15) -> list[dict]:
    words = _words(q)
    if not words:
        return []
    out = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        feeds = list(ex.map(lambda f: _cached("feed:" + f[1], lambda: _rss(f[1], f[0])), PUBLISHER_FEEDS))
    for items in feeds:
        for it in items:
            hay = (it["title"] + " " + it.get("text", "")).lower()
            if all(w in hay for w in words):  # every query word must appear in a feed item
                out.append(it)
    return out[:limit]


def discover_news(q: str) -> list[dict]:
    def work():
        groups = _gather([lambda: gdelt_news(q), lambda: google_news(q), lambda: publisher_news(q)], deadline=7)
        seen, merged = set(), []
        for g in groups:
            for n in g:
                if n["url"] not in seen:
                    seen.add(n["url"])
                    merged.append(n)
        return merged[:20]
    return _cached("news:" + " ".join(_words(q) or [q.lower()]), work)


def wiki_context(q: str, max_chars: int = 3500) -> str:
    """Grounding text for the CHAT: finds the best Wikipedia page for the question, reads the whole
    article, and returns only the paragraphs that mention the question's words (so a fact buried deep in
    the article, like one trophy in a long career, is found). Returns "" on any failure."""
    topic = _strong(q)
    if not topic:
        return ""
    d = _get("https://en.wikipedia.org/w/api.php", {
        "action": "query", "list": "search", "srsearch": q, "srlimit": 2, "format": "json", "utf8": 1,
    })
    hits = (((d or {}).get("query") or {}).get("search")) or []
    parts = []
    for h in hits[:2]:
        title = h.get("title")
        if not title:
            continue
        p = _get("https://en.wikipedia.org/w/api.php", {
            "action": "query", "prop": "extracts", "explaintext": 1, "titles": title,
            "format": "json", "utf8": 1, "redirects": 1,
        })
        pages = list((((p or {}).get("query") or {}).get("pages") or {}).values())
        text = (pages[0].get("extract") if pages else "") or ""
        paras = [x.strip() for x in re.split(r"\n+", text) if len(x.strip()) > 40]
        if not paras:
            continue
        scored = sorted(
            range(len(paras)),
            key=lambda i: (-sum(w in paras[i].lower() for w in topic), i),
        )
        keep = sorted(i for i in scored[:5] if any(w in paras[i].lower() for w in topic))
        body = "\n".join(paras[i] for i in ([0] + [i for i in keep if i != 0]))
        parts.append(f"Source: Wikipedia, {title}\n{body}")
    return "\n\n".join(parts)[:max_chars]