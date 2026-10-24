"""Logs in as two accounts through the API, then runs selftest.py with their tokens.
No browser, no copying tokens. Run in the orchestrator folder:
    py -3.14 run_cross_test.py
Server must be running on BASE (default http://127.0.0.1:8001)."""
import os, subprocess, sys, getpass
import requests

BASE = os.environ.get("BASE", "http://127.0.0.1:8001")


def find_token(obj):
    if isinstance(obj, dict):
        for k in ("access_token", "token", "jwt", "session_token"):
            if isinstance(obj.get(k), str) and len(obj[k]) > 20:
                return obj[k]
        for v in obj.values():
            t = find_token(v)
            if t:
                return t
    return None


def login(label):
    print(f"--- Account {label} ---")
    user = input("username: ").strip()
    pw = getpass.getpass("password (hidden): ")
    r = requests.post(BASE + "/auth/login", json={"username": user, "password": pw}, timeout=30)
    print("login status:", r.status_code)
    try:
        data = r.json()
    except Exception:
        print("not JSON:", r.text[:200]); sys.exit(1)
    tok = find_token(data)
    if not tok:
        print("no token found. Response keys:", list(data.keys()) if isinstance(data, dict) else type(data))
        print("Paste that line to Claude."); sys.exit(1)
    print("got token for", label)
    return tok


a = login("A")
b = login("B")
env = dict(os.environ, BASE=BASE, TOKEN_A=a, TOKEN_B=b)
print("\nRunning selftest...\n")
subprocess.run([sys.executable if sys.executable else "py", "selftest.py"], env=env)