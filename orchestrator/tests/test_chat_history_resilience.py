import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import HTTPException
from starlette.requests import ClientDisconnect


class TestChatHistoryResilience(unittest.TestCase):
    @patch("main._supabase")
    def test_assert_owner_retries_on_transient_server_disconnect_and_succeeds(self, mock_supabase):
        from main import assert_owner

        # First call fails with "Server disconnected", second succeeds
        success_response = MagicMock()
        success_response.data = [{"id": "conv-1"}]

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            Exception("Server disconnected"),
            success_response,
        ]

        # Should NOT raise 502 because retry succeeded
        assert_owner("conv-1", "user-123")
        self.assertEqual(
            mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.call_count,
            2,
        )

    @patch("main._supabase")
    def test_assert_owner_fails_with_502_when_transient_error_persists(self, mock_supabase):
        from main import assert_owner

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            Exception("Server disconnected"),
            Exception("Server disconnected"),
        ]

        with self.assertRaises(HTTPException) as ctx:
            assert_owner("conv-1", "user-123")
        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail, "Could not verify conversation")

    @patch("main._supabase")
    def test_assert_owner_raises_404_when_not_found(self, mock_supabase):
        from main import assert_owner

        mock_resp = MagicMock()
        mock_resp.data = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            mock_resp
        ]

        with self.assertRaises(HTTPException) as ctx:
            assert_owner("conv-1", "user-123")
        self.assertEqual(ctx.exception.status_code, 404)

    @patch("main._supabase")
    def test_assert_owner_handles_client_disconnect_quietly(self, mock_supabase):
        from main import assert_owner

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.side_effect = (
            ClientDisconnect("Client disconnected")
        )

        with self.assertRaises(ClientDisconnect):
            assert_owner("conv-1", "user-123")

    @patch("main.assert_owner")
    @patch("main._supabase")
    def test_chat_history_retries_on_transient_error_and_succeeds(self, mock_supabase, mock_assert_owner):
        from main import chat_history

        success_response = MagicMock()
        success_response.data = [
            {
                "id": "msg-1",
                "role": "user",
                "content": "Hello",
                "created_at": "2026-10-20T10:00:00Z",
                "download_url": None,
                "file_name": None,
            }
        ]

        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.side_effect = [
            Exception("Server disconnected"),
            success_response,
        ]

        res = chat_history("conv-1", uid="user-123")
        self.assertIn("messages", res)
        self.assertEqual(len(res["messages"]), 1)
        self.assertEqual(res["messages"][0]["content"], "Hello")
        self.assertEqual(
            mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.call_count,
            2,
        )

    @patch("main.assert_owner")
    @patch("main._supabase")
    def test_chat_history_handles_client_disconnect_during_fetch_quietly(self, mock_supabase, mock_assert_owner):
        from main import chat_history

        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.side_effect = (
            ClientDisconnect("Client disconnected")
        )

        with self.assertRaises(ClientDisconnect):
            chat_history("conv-1", uid="user-123")
