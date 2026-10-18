import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Ensure orchestrator directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from title_generator import (
    TITLE_SYSTEM_PROMPT,
    clean_generated_title,
    extract_fallback_title,
    build_title_prompt,
    generate_title,
    generate_and_persist_conversation_title,
)


class TestPromptFormatting(unittest.TestCase):
    def test_title_system_prompt_rules(self):
        """Verify system prompt contains constraints for 3-6 words, no quotes, and no trailing punctuation."""
        prompt = TITLE_SYSTEM_PROMPT.lower()
        self.assertIn("3", prompt)
        self.assertIn("6", prompt)
        self.assertIn("word", prompt)
        self.assertIn("quote", prompt)
        self.assertIn("punctuation", prompt)

    def test_build_title_prompt(self):
        """Verify prompt builder formats user initial prompt cleanly."""
        user_msg = "Can you help me design a database schema for an e-commerce platform?"
        built = build_title_prompt(user_msg)
        self.assertIn(user_msg, built)
        self.assertTrue(built.startswith("Inquiry:") or "inquiry" in built.lower())


class TestTitleSanitization(unittest.TestCase):
    def test_clean_generated_title_strips_quotes(self):
        """Verify quotes of all types are stripped from LLM output."""
        cases = [
            ('"E-Commerce Database Schema Design"', "E-Commerce Database Schema Design"),
            ("'Next.js SSR Authentication Guide'", "Next.js SSR Authentication Guide"),
            ("`Python Fast Background Tasks`", "Python Fast Background Tasks"),
            ("“Quantum Computing Core Principles”", "Quantum Computing Core Principles"),
            ("«Modern Web Development Practices»", "Modern Web Development Practices"),
        ]
        for raw, expected in cases:
            cleaned = clean_generated_title(raw)
            self.assertEqual(cleaned, expected)

    def test_clean_generated_title_strips_trailing_punctuation(self):
        """Verify trailing punctuation is removed."""
        cases = [
            ("E-Commerce Schema Design.", "E-Commerce Schema Design"),
            ("How Solar Panels Work?", "How Solar Panels Work"),
            ("Optimized Database Querying!", "Optimized Database Querying"),
            ("Vector Similarity Search:", "Vector Similarity Search"),
            ("Machine Learning Overview;", "Machine Learning Overview"),
            ("Distributed Systems Basics -", "Distributed Systems Basics"),
        ]
        for raw, expected in cases:
            cleaned = clean_generated_title(raw)
            self.assertEqual(cleaned, expected)

    def test_clean_generated_title_strips_prefixes(self):
        """Verify prefixes like 'Title:', 'Topic:', 'Summary:' are removed."""
        cases = [
            ("Title: Cloud Architecture Guide", "Cloud Architecture Guide"),
            ("Title:   PostgreSQL Index Optimization", "PostgreSQL Index Optimization"),
            ("Topic: Real-time Audio Processing", "Real-time Audio Processing"),
            ("Summary: Global Climate Trends", "Global Climate Trends"),
            ("Subject: Modern Cryptography Protocols", "Modern Cryptography Protocols"),
        ]
        for raw, expected in cases:
            cleaned = clean_generated_title(raw)
            self.assertEqual(cleaned, expected)

    def test_clean_generated_title_enforces_word_count(self):
        """Verify titles exceeding 6 words are bounded to 6 words."""
        raw = "Comprehensive Guide to Distributed Consensus Algorithms in Python"
        cleaned = clean_generated_title(raw)
        words = cleaned.split()
        self.assertLessEqual(len(words), 6)
        self.assertEqual(cleaned, "Comprehensive Guide to Distributed Consensus Algorithms")

    def test_clean_generated_title_strips_markdown(self):
        """Verify markdown formatting characters (*, _, #) are removed."""
        raw = "**Docker Containerization** _Best Practices_"
        cleaned = clean_generated_title(raw)
        self.assertEqual(cleaned, "Docker Containerization Best Practices")

    def test_clean_generated_title_empty_or_too_short(self):
        """Verify invalid or fewer than 3 words output returns empty string to trigger fallback."""
        self.assertEqual(clean_generated_title(""), "")
        self.assertEqual(clean_generated_title("   "), "")
        self.assertEqual(clean_generated_title("Hello"), "")
        self.assertEqual(clean_generated_title("Two words"), "")


class TestFallbackTitleExtraction(unittest.TestCase):
    def test_extract_fallback_title_normal(self):
        """Verify fallback cleanly extracts 3 to 6 words from user prompt."""
        prompt = "Explain quantum computing and superposition principles in simple terms."
        fallback = extract_fallback_title(prompt)
        words = fallback.split()
        self.assertTrue(3 <= len(words) <= 6)
        self.assertEqual(fallback, "Explain quantum computing and superposition principles")

    def test_extract_fallback_title_multiline(self):
        """Verify fallback takes the first line when prompt has multiple lines."""
        prompt = "# Quarterly Sales Review\nPlease analyze the attached spreadsheet and summarize profit margins."
        fallback = extract_fallback_title(prompt)
        self.assertEqual(fallback, "Quarterly Sales Review")

    def test_extract_fallback_title_markdown_and_quotes(self):
        """Verify markdown syntax and quotes are cleaned out from fallback."""
        prompt = "### \"Deploying Next.js 15 Applications\" with Docker containers"
        fallback = extract_fallback_title(prompt)
        self.assertFalse(any(ch in fallback for ch in ['"', '#', '`']))
        self.assertTrue(fallback.startswith("Deploying Next.js 15 Applications"))

    def test_extract_fallback_title_short_prompt(self):
        """Verify fallback handles short prompts gracefully without crashing."""
        self.assertEqual(extract_fallback_title("Hello world"), "Hello world")
        self.assertEqual(extract_fallback_title("Hi"), "Hi")

    def test_extract_fallback_title_empty(self):
        """Verify empty prompt returns default 'New conversation'."""
        self.assertEqual(extract_fallback_title(""), "New conversation")
        self.assertEqual(extract_fallback_title("   "), "New conversation")


class TestTitleGenerationLLM(unittest.TestCase):
    @patch("title_generator.requests.post")
    def test_generate_title_success(self, mock_post):
        """Verify successful LLM response produces clean 3-6 word title."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": '"React Performance Optimization Guide."'}}]
        }
        mock_post.return_value = mock_response

        title = generate_title("How do I optimize React components for better rendering performance?", groq_api_key="test-key")
        self.assertEqual(title, "React Performance Optimization Guide")
        mock_post.assert_called_once()

    @patch("title_generator.requests.post")
    def test_generate_title_timeout_fallback(self, mock_post):
        """Verify LLM timeout cleanly falls back to excerpt without throwing."""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout("Request timed out")

        prompt = "Compare PostgreSQL and MySQL databases for large enterprise workloads."
        title = generate_title(prompt, groq_api_key="test-key")
        words = title.split()
        self.assertTrue(3 <= len(words) <= 6)
        self.assertEqual(title, "Compare PostgreSQL and MySQL databases for")

    @patch("title_generator.requests.post")
    def test_generate_title_http_error_fallback(self, mock_post):
        """Verify HTTP 500/429 error falls back to excerpt."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_post.return_value = mock_response

        prompt = "Build a real-time collaborative whiteboarding application in React."
        title = generate_title(prompt, groq_api_key="test-key")
        self.assertEqual(title, "Build a real-time collaborative whiteboarding application")

    @patch.dict(os.environ, {}, clear=True)
    def test_generate_title_missing_key_fallback(self):
        """Verify missing API key safely triggers excerpt fallback."""
        prompt = "Explain how transformer neural networks process sequential tokens."
        title = generate_title(prompt, groq_api_key=None)
        self.assertEqual(title, "Explain how transformer neural networks process")


class TestBackgroundTaskPersistence(unittest.TestCase):
    @patch("title_generator.generate_title")
    def test_generate_and_persist_success(self, mock_generate):
        """Verify generated title is persisted to Supabase conversations table."""
        mock_generate.return_value = "Docker Swarm Deployment Guide"

        mock_supabase = MagicMock()
        # Mock select query finding conversation with title=None
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"id": "conv-123", "title": None}
        ]

        title = generate_and_persist_conversation_title(
            conversation_id="conv-123",
            user_id="user-456",
            initial_message="How do I deploy a high availability Docker Swarm cluster?",
            supabase_client=mock_supabase,
        )

        self.assertEqual(title, "Docker Swarm Deployment Guide")
        mock_supabase.table.assert_any_call("conversations")
        mock_supabase.table().update.assert_called_with({"title": "Docker Swarm Deployment Guide"})

    @patch("title_generator.generate_title")
    def test_generate_and_persist_does_not_overwrite_custom_title(self, mock_generate):
        """Verify already-set custom title is not overwritten."""
        mock_supabase = MagicMock()
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"id": "conv-123", "title": "My Custom Title"}
        ]

        title = generate_and_persist_conversation_title(
            conversation_id="conv-123",
            user_id="user-456",
            initial_message="Some initial message",
            supabase_client=mock_supabase,
        )

        self.assertEqual(title, "My Custom Title")
        mock_supabase.table().update.assert_not_called()

    @patch("title_generator.generate_title")
    def test_generate_and_persist_falls_back_on_exception(self, mock_generate):
        """Verify generation exception falls back to excerpt and persists it."""
        mock_generate.side_effect = RuntimeError("Model provider down")

        mock_supabase = MagicMock()
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"id": "conv-123", "title": None}
        ]

        title = generate_and_persist_conversation_title(
            conversation_id="conv-123",
            user_id="user-456",
            initial_message="Analyze financial quarterly revenue reports for tech companies",
            supabase_client=mock_supabase,
        )

        self.assertEqual(title, "Analyze financial quarterly revenue reports for")
        mock_supabase.table().update.assert_called_with({"title": "Analyze financial quarterly revenue reports for"})


if __name__ == "__main__":
    unittest.main()
