import asyncio

import httpx


async def fetch_one(url: str, client: httpx.AsyncClient) -> tuple[str, str | None]:
    """Returns (url, raw_html_or_none). None on failure — caller decides how to handle."""
    try:
        response = await client.get(url, timeout=20, follow_redirects=True)
        response.raise_for_status()
        return url, response.text
    except Exception as e:
        print(f"[fetcher] failed to fetch {url}: {e}")
        return url, None


async def fetch_many(urls: list[str]) -> dict[str, str | None]:
    """Fetches multiple URLs concurrently. Returns {url: html_or_none}."""
    async with httpx.AsyncClient(headers={"User-Agent": "HepozyBot/1.0"}) as client:
        results = await asyncio.gather(*[fetch_one(url, client) for url in urls])
    return dict(results)
