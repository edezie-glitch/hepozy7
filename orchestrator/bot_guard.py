"""App-level bot protection (no Cloudflare settings needed). Add to main.py:
    from bot_guard import install_bot_guard
    install_bot_guard(app)
What it does:
  1. Per-IP rate limit: strict on /search /chat /auth, looser on everything else.
  2. Blocks empty and well-known scraper user agents on the API paths (a browser never sends these).
  3. Honeypot: bots probing paths no real user visits (/.env, /wp-login.php ...) are banned for an hour.
  4. Serves /robots.txt.
Limits (read this): it runs AFTER the request reaches your server, so it stops scraping and abuse but cannot
absorb a flood of traffic. Cloudflare in front of the tunnel still does that. All numbers are env-tunable."""

import os
import time
import threading
from collections import deque

from fastapi import Request
from fastapi.responses import JSONResponse, PlainTextResponse

HEAVY_PATHS = ("/search", "/auth")
HEAVY_PER_MIN = int(os.environ.get("BOT_HEAVY_PER_MIN", "40"))
GENERAL_PER_MIN = int(os.environ.get("BOT_GENERAL_PER_MIN", "240"))
LOCAL_HEAVY_PER_MIN = int(os.environ.get("BOT_LOCAL_HEAVY_PER_MIN", "400"))
LOCAL_GENERAL_PER_MIN = int(os.environ.get("BOT_LOCAL_GENERAL_PER_MIN", "2400"))
BAN_SECONDS = int(os.environ.get("BOT_BAN_SECONDS", "3600"))
ALLOW_TOOLS = os.environ.get("BOT_ALLOW_TOOLS", "0") == "1"   # set to 1 while you test with curl or scripts
MAX_TRACKED = 20000

BAD_AGENTS = ("scrapy", "python-requests", "python-urllib", "aiohttp", "go-http-client", "curl/", "wget",
              "libwww", "java/", "okhttp", "httpclient", "node-fetch", "axios", "headlesschrome", "phantomjs")
TRAP_PATHS = ("/.env", "/.git", "/wp-login.php", "/wp-admin", "/xmlrpc.php", "/phpmyadmin", "/admin.php",
              "/config.php", "/.aws", "/server-status", "/vendor/phpunit")

ROBOTS = "User-agent: *\nDisallow: /search\nDisallow: /chat\nDisallow: /auth\nAllow: /\n"

_lock = threading.Lock()
_heavy: dict[str, deque] = {}
_general: dict[str, deque] = {}
_banned: dict[str, float] = {}


def reset_bot_guard_state() -> None:
    """Clear in-memory rate limit and ban tracking tables (used for testing)."""
    with _lock:
        _heavy.clear()
        _general.clear()
        _banned.clear()


def is_loopback(host: str, cf_connecting_ip: str | None = None) -> bool:
    """True if request is directly from local loopback rather than via Cloudflare."""
    return host in ("127.0.0.1", "::1", "localhost", "testclient") and not cf_connecting_ip


def is_heavy_request(method: str, path: str) -> bool:
    """Distinguish heavy generation/auth/search endpoints from lightweight read/polling routes."""
    norm = path.rstrip("/") or "/"
    if norm.startswith("/search") and method in ("GET", "POST"):
        return True
    if norm.startswith("/auth") and method in ("POST", "PUT", "PATCH"):
        return True
    # Under /chat, only inference generation and regeneration endpoints are heavy.
    # Read/polling endpoints like /chat/conversations and /chat/history are general.
    if method == "POST" and (norm == "/chat" or norm == "/chat/edit" or norm.startswith("/chat/edit/")):
        return True
    return False


def _client_ip(request: Request) -> str:
    host = request.client.host if request.client else "?"
    # behind the Cloudflare tunnel every request comes from localhost; the real visitor is in this header.
    # It is trusted ONLY when the request really came from localhost, so nobody can fake it from outside.
    if host in ("127.0.0.1", "::1", "localhost", "testclient"):
        return request.headers.get("cf-connecting-ip") or host
    return host


def _hit(table: dict, ip: str, limit: int, now: float) -> bool:
    """True if this request is allowed."""
    q = table.get(ip)
    if q is None:
        if len(table) > MAX_TRACKED:
            table.clear()
        q = table[ip] = deque()
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(now)
    return True


def install_bot_guard(app) -> None:
    @app.get("/robots.txt", include_in_schema=False)
    def robots():
        return PlainTextResponse(ROBOTS)

    @app.middleware("http")
    async def bot_guard(request: Request, call_next):
        if os.environ.get("BOT_GUARD_DISABLED", "0") == "1":
            return await call_next(request)

        path = request.url.path
        if path == "/robots.txt":
            return await call_next(request)

        host = request.client.host if request.client else "?"
        cf_ip = request.headers.get("cf-connecting-ip")
        loopback = is_loopback(host, cf_ip)

        # Allow full bypass for local development if configured
        if loopback and os.environ.get("BOT_BYPASS_LOCAL", "0") == "1":
            return await call_next(request)

        ip = _client_ip(request)
        now = time.time()
        low = path.lower()
        with _lock:
            until = _banned.get(ip, 0)
            if until > now:
                return JSONResponse({"detail": "Forbidden"}, status_code=403)
            if any(low.startswith(t) for t in TRAP_PATHS):
                if len(_banned) > MAX_TRACKED:
                    _banned.clear()
                _banned[ip] = now + BAN_SECONDS
                print(f"[bot_guard] banned {ip} for probing {path}")
                return JSONResponse({"detail": "Not Found"}, status_code=404)

            heavy = is_heavy_request(request.method, path)
            allow_tools = ALLOW_TOOLS or loopback or os.environ.get("BOT_ALLOW_TOOLS", "0") == "1"
            if heavy and not allow_tools:
                ua = (request.headers.get("user-agent") or "").lower()
                if not ua or any(b in ua for b in BAD_AGENTS):
                    print(f"[bot_guard] blocked agent {ua[:40]!r} from {ip} on {path}")
                    return JSONResponse({"detail": "Forbidden"}, status_code=403)

            # Local development loopback traffic gets higher default headroom to prevent false positives
            general_limit = int(os.environ.get("BOT_LOCAL_GENERAL_PER_MIN", str(LOCAL_GENERAL_PER_MIN))) if loopback else int(os.environ.get("BOT_GENERAL_PER_MIN", str(GENERAL_PER_MIN)))
            heavy_limit = int(os.environ.get("BOT_LOCAL_HEAVY_PER_MIN", str(LOCAL_HEAVY_PER_MIN))) if loopback else int(os.environ.get("BOT_HEAVY_PER_MIN", str(HEAVY_PER_MIN)))

            ok = _hit(_general, ip, general_limit, now) and (not heavy or _hit(_heavy, ip, heavy_limit, now))
        if not ok:
            print(f"[bot_guard] rate limited {ip} on {path}")
            return JSONResponse({"detail": "Too many requests. Slow down."}, status_code=429,
                                headers={"Retry-After": "30"})
        return await call_next(request)
