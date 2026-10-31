from datetime import datetime, timezone
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TestRequestQuota(unittest.TestCase):
    @patch("main._supabase")
    def test_check_request_quota_local_dev_bypass(self, mock_supabase):
        """When LOCAL_DEV=1, check_request_quota immediately returns {'allowed': True, 'bypassed': True}
        without querying or locking rate tables."""
        from main import check_request_quota

        with patch.dict(os.environ, {"LOCAL_DEV": "1"}):
            result = check_request_quota("user-local-test")

        self.assertEqual(result, {"allowed": True, "bypassed": True})
        mock_supabase.table.assert_not_called()

    @patch("main._supabase")
    def test_default_production_limits(self, mock_supabase):
        """Default production message and token quota thresholds are 50 messages and 20k tokens."""
        import main
        from main import check_request_quota

        mock_supabase.table.return_value.select.return_value.eq.return_value.gte.return_value.order.return_value.execute.return_value.data = []

        env = dict(os.environ)
        env.pop("LOCAL_DEV", None)
        env.pop("QUOTA_MAX_MESSAGES", None)
        env.pop("QUOTA_MAX_TOKENS", None)

        with patch.dict(os.environ, env, clear=True):
            result = check_request_quota("user-prod-test")

        self.assertEqual(main.REQUEST_LIMIT, 50)
        self.assertEqual(main.TOKEN_LIMIT, 20000)
        self.assertEqual(result, {"allowed": True, "remaining": 50, "reset_at": None})

    @patch("main._supabase")
    def test_configurable_limits_via_env(self, mock_supabase):
        """Thresholds are configurable via QUOTA_MAX_MESSAGES and QUOTA_MAX_TOKENS."""
        from main import check_request_quota

        mock_supabase.table.return_value.select.return_value.eq.return_value.gte.return_value.order.return_value.execute.return_value.data = []

        env = dict(os.environ)
        env.pop("LOCAL_DEV", None)
        env["QUOTA_MAX_MESSAGES"] = "350"
        env["QUOTA_MAX_TOKENS"] = "250000"

        with patch.dict(os.environ, env, clear=True):
            result = check_request_quota("user-custom-quota")

        self.assertEqual(result, {"allowed": True, "remaining": 350, "reset_at": None})

    @patch("main._supabase")
    def test_production_limit_enforcement_messages(self, mock_supabase):
        """When message limit is exceeded in production, check_request_quota returns allowed: False."""
        from main import check_request_quota

        now_iso = datetime.now(timezone.utc).isoformat()
        # 5 user messages
        rows = [
            {"role": "user", "created_at": now_iso, "input_tokens": 10, "output_tokens": 10}
            for _ in range(5)
        ]
        mock_supabase.table.return_value.select.return_value.eq.return_value.gte.return_value.order.return_value.execute.return_value.data = rows

        env = dict(os.environ)
        env.pop("LOCAL_DEV", None)
        env["QUOTA_MAX_MESSAGES"] = "5"
        env["QUOTA_MAX_TOKENS"] = "100000"

        with patch.dict(os.environ, env, clear=True):
            result = check_request_quota("user-limit-msg")

        self.assertFalse(result["allowed"])
        self.assertEqual(result["remaining"], 0)
        self.assertIsNotNone(result["reset_at"])

    @patch("main._supabase")
    def test_production_limit_enforcement_tokens(self, mock_supabase):
        """When token limit is exceeded in production, check_request_quota returns allowed: False."""
        from main import check_request_quota

        now_iso = datetime.now(timezone.utc).isoformat()
        # 1 user message with 1500 tokens
        rows = [
            {"role": "user", "created_at": now_iso, "input_tokens": 1000, "output_tokens": 500}
        ]
        mock_supabase.table.return_value.select.return_value.eq.return_value.gte.return_value.order.return_value.execute.return_value.data = rows

        env = dict(os.environ)
        env.pop("LOCAL_DEV", None)
        env["QUOTA_MAX_MESSAGES"] = "50"
        env["QUOTA_MAX_TOKENS"] = "1000"

        with patch.dict(os.environ, env, clear=True):
            result = check_request_quota("user-limit-tokens")

        self.assertFalse(result["allowed"])
        self.assertEqual(result["remaining"], 0)
        self.assertIsNotNone(result["reset_at"])


    @patch("main._supabase")
    def test_get_quota_local_dev_bypassed(self, mock_supabase):
        """GET /chat/quota reports unlimited/bypassed status in local development mode without querying DB."""
        from main import get_quota

        with patch.dict(os.environ, {"LOCAL_DEV": "1"}):
            quota_data = get_quota(uid="user-local-quota")

        self.assertTrue(quota_data.get("bypassed"))
        self.assertTrue(quota_data.get("unlimited"))
        self.assertEqual(quota_data.get("requests_used"), 0)
        self.assertIsNone(quota_data.get("requests_limit"))
        self.assertEqual(quota_data.get("tokens_used"), 0)
        self.assertIsNone(quota_data.get("tokens_limit"))
        mock_supabase.table.assert_not_called()

    @patch("main._supabase")
    def test_get_quota_production_configurable_limits(self, mock_supabase):
        """GET /chat/quota returns usage and limits configured via env in production mode."""
        from main import get_quota

        now_iso = datetime.now(timezone.utc).isoformat()
        rows = [
            {"role": "user", "created_at": now_iso, "input_tokens": 100, "output_tokens": 50},
            {"role": "assistant", "created_at": now_iso, "input_tokens": 100, "output_tokens": 200},
        ]
        mock_supabase.table.return_value.select.return_value.eq.return_value.gte.return_value.order.return_value.execute.return_value.data = rows

        env = dict(os.environ)
        env.pop("LOCAL_DEV", None)
        env["QUOTA_MAX_MESSAGES"] = "300"
        env["QUOTA_MAX_TOKENS"] = "150000"

        with patch.dict(os.environ, env, clear=True):
            quota_data = get_quota(uid="user-prod-quota")

        self.assertFalse(quota_data.get("bypassed", False))
        self.assertFalse(quota_data.get("unlimited", False))
        self.assertEqual(quota_data.get("requests_used"), 1)
        self.assertEqual(quota_data.get("requests_limit"), 300)
        self.assertEqual(quota_data.get("tokens_used"), 450)
        self.assertEqual(quota_data.get("tokens_limit"), 150000)
        self.assertEqual(quota_data.get("window_hours"), 5)
        mock_supabase.table.assert_called_once_with("chat_messages")
