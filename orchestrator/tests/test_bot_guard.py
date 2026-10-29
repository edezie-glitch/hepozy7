import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from bot_guard import (
    install_bot_guard,
    is_heavy_request,
    is_loopback,
    reset_bot_guard_state,
)


class TestBotGuard(unittest.TestCase):
    def setUp(self):
        reset_bot_guard_state()

    def _create_app(self):
        app = FastAPI()
        install_bot_guard(app)

        @app.get("/chat/conversations")
        async def get_conversations():
            return [{"id": "c1", "title": "Conv 1"}]

        @app.get("/chat/history/{conversation_id}")
        async def get_history(conversation_id: str):
            return [{"id": "m1", "role": "user", "content": "hi"}]

        @app.get("/chat/quota")
        async def get_quota():
            return {"remaining": 50}

        @app.post("/chat")
        async def post_chat():
            return {"reply": "hello"}

        @app.post("/chat/edit")
        async def post_chat_edit():
            return {"reply": "edited"}

        @app.get("/search")
        async def get_search():
            return {"results": []}

        @app.post("/auth/login")
        async def post_auth_login():
            return {"token": "xyz"}

        return app

    def test_is_heavy_request_classification(self):
        # Heavy endpoints: LLM generation, search, auth
        self.assertTrue(is_heavy_request("POST", "/chat"))
        self.assertTrue(is_heavy_request("POST", "/chat/edit"))
        self.assertTrue(is_heavy_request("GET", "/search"))
        self.assertTrue(is_heavy_request("POST", "/auth/login"))

        # Read / lightweight chat endpoints are NOT heavy
        self.assertFalse(is_heavy_request("GET", "/chat/conversations"))
        self.assertFalse(is_heavy_request("GET", "/chat/history/123-abc"))
        self.assertFalse(is_heavy_request("GET", "/chat/quota"))
        self.assertFalse(is_heavy_request("POST", "/chat/conversations/new"))
        self.assertFalse(is_heavy_request("PATCH", "/chat/conversations/123/title"))
        self.assertFalse(is_heavy_request("DELETE", "/chat/conversations/123"))
        self.assertFalse(is_heavy_request("POST", "/chat/stop"))

    def test_read_endpoints_do_not_exhaust_heavy_limit(self):
        app = self._create_app()
        # Non-loopback client IP via Cloudflare header
        headers = {
            "cf-connecting-ip": "203.0.113.10",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        }
        client = TestClient(app)

        # Send 45 requests to GET /chat/conversations (exceeds default HEAVY_PER_MIN=40)
        for i in range(45):
            res = client.get("/chat/conversations", headers=headers)
            self.assertEqual(
                res.status_code,
                200,
                f"Request {i+1} failed with status {res.status_code}: {res.text}",
            )

        # GET /chat/history should also succeed
        res = client.get("/chat/history/c1", headers=headers)
        self.assertEqual(res.status_code, 200)

    def test_heavy_chat_endpoint_rate_limited_at_heavy_limit(self):
        app = self._create_app()
        headers = {
            "cf-connecting-ip": "203.0.113.20",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        }
        client = TestClient(app)

        # POST /chat is heavy (limit 40/min)
        for i in range(40):
            res = client.post("/chat", headers=headers)
            self.assertEqual(res.status_code, 200, f"Request {i+1} failed")

        # 41st request must trigger 429
        res = client.post("/chat", headers=headers)
        self.assertEqual(res.status_code, 429)
        self.assertEqual(res.json()["detail"], "Too many requests. Slow down.")
        self.assertEqual(res.headers.get("Retry-After"), "30")

    def test_loopback_traffic_exempt_or_elevated(self):
        app = self._create_app()
        # Direct loopback (no cf-connecting-ip header)
        headers = {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        }
        client = TestClient(app)

        # 50 fast navigations from localhost must not trigger 429
        for i in range(50):
            res = client.get("/chat/conversations", headers=headers)
            self.assertEqual(res.status_code, 200)

    def test_bot_bypass_local_env_flag(self):
        old_val = os.environ.get("BOT_BYPASS_LOCAL")
        try:
            os.environ["BOT_BYPASS_LOCAL"] = "1"
            app = self._create_app()
            client = TestClient(app)

            # Heavy endpoint on loopback should not be rate limited when BOT_BYPASS_LOCAL=1
            for i in range(50):
                res = client.post("/chat", headers={"user-agent": "Mozilla/5.0"})
                self.assertEqual(res.status_code, 200)
        finally:
            if old_val is None:
                os.environ.pop("BOT_BYPASS_LOCAL", None)
            else:
                os.environ["BOT_BYPASS_LOCAL"] = old_val


if __name__ == "__main__":
    unittest.main()
