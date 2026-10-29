import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import BackgroundTasks
from pydantic import BaseModel


class TestMainChatTitleIntegration(unittest.TestCase):
    @patch("main._supabase")
    @patch("main.route_to_model")
    @patch("main.get_recent_history")
    @patch("main.check_request_quota")
    @patch("main.retrieve_chunks", return_value=[])
    @patch("discovery.wiki_context", return_value="")
    @patch("main.check_safeguard", return_value=False)
    @patch("main.check_prompt_guard", return_value=False)
    def test_first_turn_schedules_title_generation(
        self, mock_guard, mock_safe, mock_wiki, mock_search, mock_quota, mock_history, mock_route, mock_supabase
    ):
        """Verify POST /chat on first turn inserts title=None and queues title generation background task."""
        from main import chat, ChatRequest, generate_and_persist_conversation_title

        mock_quota.return_value = {"allowed": True, "reset_at": None}
        mock_history.return_value = []  # No prior messages -> first turn
        mock_route.return_value = {
            "text": "Quantum computing uses qubits.",
            "provider": "groq",
            "model": "openai/gpt-oss-20b",
            "input_tokens": 10,
            "output_tokens": 15,
        }

        # Mock conversation insertion
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
            {"id": "new-conv-uuid", "title": None}
        ]

        background_tasks = BackgroundTasks()
        mock_request = MagicMock()
        mock_request.client.host = "127.0.0.1"

        req = ChatRequest(
            message="Explain quantum computing principles simply",
            conversation_id=None,
        )

        response = chat(
            req=req,
            background_tasks=background_tasks,
            request=mock_request,
            uid="user-test-123",
        )

        # 1. Assert conversation was created with title=None
        mock_supabase.table.assert_any_call("conversations")
        mock_supabase.table().insert.assert_any_call(
            {"user_id": "user-test-123", "title": None}
        )

        # 2. Assert conversation_id is returned
        self.assertEqual(response.conversation_id, "new-conv-uuid")

        # 3. Assert title generation was added to background tasks
        task_funcs = [t.func for t in background_tasks.tasks]
        self.assertIn(generate_and_persist_conversation_title, task_funcs)

    @patch("main._supabase")
    @patch("main.route_to_model")
    @patch("main.get_recent_history")
    @patch("main.check_request_quota")
    @patch("main.assert_owner")
    @patch("main.retrieve_chunks", return_value=[])
    @patch("discovery.wiki_context", return_value="")
    @patch("main.check_safeguard", return_value=False)
    @patch("main.check_prompt_guard", return_value=False)
    def test_subsequent_turn_does_not_schedule_title_generation(
        self, mock_guard, mock_safe, mock_wiki, mock_search, mock_assert_owner, mock_quota, mock_history, mock_route, mock_supabase
    ):
        """Verify POST /chat on subsequent turn does NOT re-trigger title generation."""
        from main import chat, ChatRequest, generate_and_persist_conversation_title

        mock_quota.return_value = {"allowed": True, "reset_at": None}
        mock_history.return_value = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]  # Prior messages exist
        mock_route.return_value = {
            "text": "Sure, here are more details.",
            "provider": "groq",
            "model": "openai/gpt-oss-20b",
            "input_tokens": 12,
            "output_tokens": 18,
        }

        background_tasks = BackgroundTasks()
        mock_request = MagicMock()
        mock_request.client.host = "127.0.0.1"

        req = ChatRequest(
            message="Tell me more about qubit coherence times",
            conversation_id="existing-conv-uuid",
        )

        response = chat(
            req=req,
            background_tasks=background_tasks,
            request=mock_request,
            uid="user-test-123",
        )

        # Assert title generation was NOT added to background tasks
        task_funcs = [t.func for t in background_tasks.tasks]
        self.assertNotIn(generate_and_persist_conversation_title, task_funcs)

    @patch("main._supabase")
    @patch("main.get_recent_history", return_value=[])
    @patch("main.check_request_quota", return_value={"allowed": True, "reset_at": None})
    @patch("main.check_query_clarity")
    @patch("main.check_safeguard", return_value=False)
    @patch("main.check_prompt_guard", return_value=False)
    def test_first_turn_clarification_schedules_title_generation(
        self, mock_guard, mock_safe, mock_clarity, mock_quota, mock_history, mock_supabase
    ):
        """Verify that when the first message triggers clarification, title generation is still scheduled."""
        from main import chat, ChatRequest, generate_and_persist_conversation_title

        mock_clarity.return_value = {
            "clear": False,
            "clarifying_question": "Did you mean quantum physics or computing?",
            "suggested_replies": ["Physics", "Computing"],
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
            {"id": "conv-clarify-1", "title": None}
        ]

        background_tasks = BackgroundTasks()
        mock_request = MagicMock()
        mock_request.client.host = "127.0.0.1"

        req = ChatRequest(message="quantum", conversation_id=None)
        response = chat(
            req=req,
            background_tasks=background_tasks,
            request=mock_request,
            uid="user-test-123",
        )

        self.assertTrue(response.needs_clarification)
        task_funcs = [t.func for t in background_tasks.tasks]
        self.assertIn(generate_and_persist_conversation_title, task_funcs)

    @patch("main._supabase")
    @patch("main.get_recent_history", return_value=[])
    @patch("main.check_request_quota", return_value={"allowed": True, "reset_at": None})
    @patch("main.get_cached_response")
    @patch("main.check_safeguard", return_value=False)
    @patch("main.check_prompt_guard", return_value=False)
    def test_first_turn_cache_hit_schedules_title_generation(
        self, mock_guard, mock_safe, mock_cache, mock_quota, mock_history, mock_supabase
    ):
        """Verify that when the first message hits cache, title generation is scheduled in background."""
        from main import chat, ChatRequest, generate_and_persist_conversation_title

        mock_cache.return_value = {
            "reply": "Cached quantum computing explanation.",
            "safeguard_passed": True,
            "input_tokens": 8,
            "output_tokens": 14,
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
            {"id": "conv-cache-1", "title": None}
        ]

        background_tasks = BackgroundTasks()
        mock_request = MagicMock()
        mock_request.client.host = "127.0.0.1"

        req = ChatRequest(message="What is quantum computing?", conversation_id=None)
        response = chat(
            req=req,
            background_tasks=background_tasks,
            request=mock_request,
            uid="user-test-123",
        )

        self.assertEqual(response.reply, "Cached quantum computing explanation.")
        task_funcs = [t.func for t in background_tasks.tasks]
        self.assertIn(generate_and_persist_conversation_title, task_funcs)


if __name__ == "__main__":
    unittest.main()

