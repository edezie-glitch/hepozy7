"""
Hepozy self-test: checks YOUR OWN server for the common security holes.
Run it only against your own site. Default target is the local server.

    py -3.14 selftest.py

Optional, for the stronger checks (copy each token from the browser: F12 > Application >
Local Storage > hepozy_token, one from two different accounts):

    set TOKEN_A=...      set TOKEN_B=...      py -3.14 selftest.py

Other options:  set BASE=https://hepozy.com   (go gently: it runs through your laptop)
                set RATE=1   (also tests login lockout; this locks YOUR IP out of login for 5 minutes)
"""
import os
import sys

import requests

BASE = os.environ.get("BASE", "http://127.0.0.1:8000").rstrip("/")
A, B = os.environ.get("TOKEN_A"), os.environ.get("TOKEN_B")
RATE = os.environ.get("RATE") == "1"
fails = warns = 0


def show(kind, name, detail=""):
    global fails, warns
    if kind == "FAIL":
        fails += 1
    if kind == "WARN":
        warns += 1
    print(f"{kind:5} {name}" + (f"   [{detail}]" if detail else ""))


def check(name, ok, detail=""):
    show("PASS" if ok else "FAIL", name, "" if ok else detail)


def call(method, path, token=None, **kw):
    headers = kw.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.request(method, BASE + path, headers=headers, timeout=20, allow_redirects=False, **kw)


def leaks_secret(text: str) -> bool:
    return any(m in text for m in ("SUPABASE_", "GROQ_API_KEY", "GEMINI_API_KEY", "OWNER_ADMIN_KEY", "sb_secret_", "import os"))


print(f"Target: {BASE}\n")

print("--- 1. Routes that need a login must refuse visitors ---")
protected = [
    ("GET", "/chat/conversations"), ("GET", "/chat/quota"), ("GET", "/chat/history/abc"),
    ("POST", "/chat/conversations/new"), ("DELETE", "/chat/conversations/abc"),
    ("PATCH", "/chat/conversations/abc/title"), ("POST", "/chat/edit"), ("POST", "/chat/stop"), ("POST", "/chat"),
]
for m, p in protected:
    r = call(m, p, json={})
    check(f"{m} {p} without a token", r.status_code in (401, 403), f"got {r.status_code}")
r = call("GET", "/chat/conversations", token="not-a-real-token")
check("fake token is refused", r.status_code in (401, 403), f"got {r.status_code}")

print("\n--- 2. Admin ---")
for hdr, label in ((None, "no key"), ({"x-admin-key": "wrong"}, "wrong key")):
    r = call("POST", "/admin/crawl", json={"url": "https://example.com"}, headers=hdr or {})
    check(f"/admin/crawl with {label}", r.status_code in (401, 403), f"got {r.status_code}")

print("\n--- 3. Things that must not be public ---")
for p in ("/docs", "/redoc", "/openapi.json"):
    r = call("GET", p)
    show("PASS" if r.status_code == 404 else "WARN", f"{p} hidden", f"got {r.status_code}; it lists every route of your API" if r.status_code != 404 else "")
for p in ("/files/", "/.env", "/main.py", "/auth.py", "/requirements.txt", "/.git/config", "/files/..%2f.env",
          "/files/%2e%2e/.env", "/static/..%2f.env", "/..%2f.env", "/orchestrator/.env"):
    r = call("GET", p)
    bad = r.status_code == 200 and (leaks_secret(r.text) or p.endswith("/"))
    check(f"{p} not readable", not bad, f"got {r.status_code}, {len(r.text)} bytes")

print("\n--- 4. Security headers ---")
r = call("GET", "/")
h = {k.lower(): v for k, v in r.headers.items()}
check("X-Content-Type-Options: nosniff", h.get("x-content-type-options", "").lower() == "nosniff")
check("X-Frame-Options set", "x-frame-options" in h or "frame-ancestors" in h.get("content-security-policy", ""))
check("Content-Security-Policy set", "content-security-policy" in h)
check("Referrer-Policy set", "referrer-policy" in h)
r = call("GET", "/chat/conversations", token=A or "x")
check("private responses are not cached", "no-store" in {k.lower(): v for k, v in r.headers.items()}.get("cache-control", "").lower(), f"cache-control: {r.headers.get('cache-control')}")

print("\n--- 5. Other websites must not be allowed to call your API ---")
r = call("GET", "/health", headers={"Origin": "https://evil.example"})
acao = r.headers.get("access-control-allow-origin")
check("CORS refuses a stranger's website", acao not in ("*", "https://evil.example"), f"allow-origin: {acao}")

print("\n--- 6. Bad input must not crash or leak ---")
r = call("POST", "/auth/login", data="{not json", headers={"Content-Type": "application/json"})
check("broken JSON gives 4xx, not 500", 400 <= r.status_code < 500 and "Traceback" not in r.text, f"got {r.status_code}")
r = call("POST", "/auth/login", json={"username": "x" * 2_000_000, "password": "y"})
check("2 MB username is refused", r.status_code in (413, 422), f"got {r.status_code}")
r = call("POST", "/auth/signup", json={"email": "a@b.co", "username": "ab", "password": "short"})
check("weak signup refused, no stack trace", r.status_code in (400, 422) and "Traceback" not in r.text, f"got {r.status_code}")

if A:
    r = call("POST", "/chat", token=A, json={"message": "a" * 9000})
    check("9000-character message is refused", r.status_code == 422, f"got {r.status_code}")
else:
    show("SKIP", "message size limit", "set TOKEN_A to run")

print("\n--- 7. One user reading another user's data (the big one) ---")
if A and B:
    r = call("POST", "/chat/conversations/new", token=A)
    try:
        cid = r.json()["conversation"]["id"]
    except Exception:
        cid = None
        show("FAIL", "could not create a test conversation with TOKEN_A", f"got {r.status_code}")
    if cid:
        r = call("GET", f"/chat/history/{cid}", token=B)
        check("B cannot read A's conversation", r.status_code in (403, 404), f"got {r.status_code}")
        r = call("PATCH", f"/chat/conversations/{cid}/title", token=B, json={"title": "hacked"})
        check("B cannot rename A's conversation", r.status_code in (403, 404), f"got {r.status_code}")
        r = call("GET", "/chat/conversations", token=B)
        check("A's conversation is not in B's list", cid not in r.text)
        r = call("POST", "/chat", token=B, json={"message": "hi", "conversation_id": cid})
        check("B cannot chat inside A's conversation", r.status_code in (403, 404), f"got {r.status_code}")
        r = call("DELETE", f"/chat/conversations/{cid}", token=B)   # last, because a successful delete would hide the others
        check("B cannot delete A's conversation", r.status_code in (403, 404), f"got {r.status_code}")
        call("DELETE", f"/chat/conversations/{cid}", token=A)  # clean up
else:
    show("SKIP", "cross-user tests", "set TOKEN_A and TOKEN_B from two different accounts")

print("\n--- 8. Login lockout ---")
if RATE:
    codes = [call("POST", "/auth/login", json={"username": "nobody_x", "password": "wrong"}).status_code for _ in range(25)]
    check("repeated bad logins end in 429", 429 in codes, f"codes: {sorted(set(codes))}")
else:
    show("SKIP", "login lockout", "set RATE=1 to run (it locks your own IP out for 5 minutes)")

print(f"\nResult: {fails} failed, {warns} warnings.")
sys.exit(1 if fails else 0)