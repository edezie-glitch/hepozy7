import asyncio
import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import httpx

MAX_BYTES = 5 * 1024 * 1024  # a page bigger than this is not worth reading
MAX_REDIRECTS = 5


async def _is_public(url: str) -> bool:
    """
    ADDED: False for anything that is not a plain http(s) address on the public internet.
    Without this, a crawled link could point the server at your own computer, your router,
    or the cloud metadata address (169.254.169.254) and read what answers there.
    """
    parts = urlparse(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return False
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            parts.hostname,
            parts.port or (443 if parts.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except OSError:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if ip.version == 6 and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        if not ip.is_global:
            return False
    return True


async def fetch_one(url: str, client: httpx.AsyncClient) -> tuple[str, str | None]:
    """Returns (url, raw_html_or_none). None on failure — caller decides how to handle."""
    try:
        current = url
        for _ in range(MAX_REDIRECTS + 1):
            if not await _is_public(current):
                print(f"[fetcher] refused a non-public address: {current}")
                return url, None
            # redirects are followed by hand so EVERY step is checked, not just the first address
            async with client.stream("GET", current, timeout=20, follow_redirects=False) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        return url, None
                    current = urljoin(current, location)
                    continue
                response.raise_for_status()
                kind = response.headers.get("content-type", "").lower()
                if kind and not kind.startswith(("text/", "application/xhtml", "application/xml")):
                    return url, None
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_BYTES:
                        print(f"[fetcher] {url} is larger than {MAX_BYTES} bytes, skipped")
                        return url, None
                return url, bytes(body).decode(response.encoding or "utf-8", errors="replace")
        print(f"[fetcher] too many redirects for {url}")
        return url, None
    except Exception as e:
        print(f"[fetcher] failed to fetch {url}: {e}")
        return url, None


async def fetch_many(urls: list[str]) -> dict[str, str | None]:
    """Fetches multiple URLs concurrently. Returns {url: html_or_none}."""
    async with httpx.AsyncClient(headers={"User-Agent": "HepozyBot/1.0"}) as client:
        results = await asyncio.gather(*[fetch_one(url, client) for url in urls])
    return dict(results)


# ADDED: same safety rules as fetch_one (public addresses only, every redirect checked, size cap), but it also
# accepts PDF files and returns raw bytes plus the content type. Used by the Search tab's deep check.
MAX_PDF_BYTES = 15 * 1024 * 1024


async def fetch_bytes(url: str, client: httpx.AsyncClient) -> tuple[str, bytes | None, str]:
    try:
        current = url
        for _ in range(MAX_REDIRECTS + 1):
            if not await _is_public(current):
                print(f"[fetcher] refused a non-public address: {current}")
                return url, None, ""
            async with client.stream("GET", current, timeout=20, follow_redirects=False) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        return url, None, ""
                    current = urljoin(current, location)
                    continue
                response.raise_for_status()
                kind = response.headers.get("content-type", "").lower()
                is_pdf = "application/pdf" in kind or current.lower().split("?")[0].endswith(".pdf")
                if kind and not is_pdf and not kind.startswith(("text/", "application/xhtml", "application/xml")):
                    return url, None, kind
                cap = MAX_PDF_BYTES if is_pdf else MAX_BYTES
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > cap:
                        print(f"[fetcher] {url} is larger than {cap} bytes, skipped")
                        return url, None, kind
                return url, bytes(body), ("application/pdf" if is_pdf or body[:5] == b"%PDF-" else kind)
        print(f"[fetcher] too many redirects for {url}")
        return url, None, ""
    except Exception as e:
        print(f"[fetcher] failed: {url[:90]} ({str(e).splitlines()[0][:80] if str(e) else type(e).__name__})")
        return url, None, ""