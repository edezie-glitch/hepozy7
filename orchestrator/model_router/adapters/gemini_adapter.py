import os
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_CHAT_MODEL = "gemini-flash-latest"

# CHANGED: how many tokens one answer may use. It was 1024, which is about 700 words. That is
# why answers (tables and long documents especially) ended in the middle: Gemini also spends
# part of this number on thinking before it writes. Raise it if answers still end early.
GEMINI_MAX_OUTPUT_TOKENS = 8192


def _build_system_prompt() -> str:
    now = datetime.now(ZoneInfo("Asia/Manila"))
    current_time = now.strftime("%A, %B %d, %Y, %I:%M %p") + " PHT"
    return (
        "You are Hepozy, an AI assistant created by Edezie and co. If asked what model or AI you are, "
        "say you are Hepozy. Never claim to be ChatGPT, GPT, ChatGPT-4, Claude, "
        "Gemini, or any other named AI product — you are Hepozy, built by Edezie and co. "
        "What you can help with: having conversations and answering questions, teaching by "
        "breaking complex subjects into simple steps, writing (emails, stories, essays, "
        "summaries, posts), reasoning through problems by analyzing information, working "
        "with languages (translating and explaining), and analyzing information (comparing "
        "ideas, summarizing documents, identifying patterns). Only mention this capability "
        "list if the user actually asks what you can do — don't volunteer it unprompted. "
        f"The current date and time is {current_time}. "
        "Use this when asked about the current date, time, or day."
    )


class GeminiAdapter:
    def complete(
        self,
        prompt: str,
        model: str = GEMINI_CHAT_MODEL,
        max_tokens: int = GEMINI_MAX_OUTPUT_TOKENS,
        history: list[dict] | None = None,
        **kwargs,
    ) -> dict:
        """
        Returns {"text": str, "input_tokens": int, "output_tokens": int, "truncated": bool}.
        truncated is True when the model stopped because it ran out of room (not because it was done).
        history: prior turns as [{"role": "user"|"assistant", "content": str}, ...].
        Gemini's API uses "user"/"model" as role names (not "assistant"), so
        each history turn is converted before being sent.
        """
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent?key={GEMINI_API_KEY}"
        )

        contents = []
        if history:
            for turn in history:
                role = "model" if turn["role"] == "assistant" else "user"
                contents.append({"role": role, "parts": [{"text": turn["content"]}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        response = requests.post(
            url,
            json={
                "systemInstruction": {"parts": [{"text": _build_system_prompt()}]},
                "contents": contents,
                "generationConfig": {"maxOutputTokens": max_tokens, **kwargs},
            },
            # RAISED from 30s: this adapter serves long_document/file-generation
            # requests specifically - genuinely heavier generation than a quick
            # chat reply. A 30s ceiling was causing real ReadTimeout failures
            # with zero retry (timeouts are RequestException, not HTTPError,
            # so fallback.py's 503 retry never applied). Retrying a timeout
            # would just double the wait for likely the same outcome, so the
            # real fix is a more realistic budget, not a retry.
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()

        candidates = data.get("candidates") or []
        if not candidates:
            block_reason = data.get("promptFeedback", {}).get("blockReason", "unknown")
            raise RuntimeError(f"Gemini blocked this request (blockReason={block_reason})")

        candidate = candidates[0]
        parts = candidate.get("content", {}).get("parts") or []
        if not parts:
            finish_reason = candidate.get("finishReason", "unknown")
            raise RuntimeError(f"Gemini returned no content (finishReason={finish_reason})")

        # CHANGED: Gemini can split one answer over several parts. Only the first part was read
        # before, so the rest of a long answer was silently dropped. All text parts are joined now
        # (the model's private "thought" parts, if any, are left out).
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        if not text.strip():
            finish_reason = candidate.get("finishReason", "unknown")
            raise RuntimeError(f"Gemini returned no text (finishReason={finish_reason})")

        usage = data.get("usageMetadata", {})
        finish_reason = candidate.get("finishReason")
        truncated = finish_reason == "MAX_TOKENS"
        if truncated:
            print(f"[gemini] answer hit the length limit (maxOutputTokens={max_tokens}) - it will be marked as cut off")

        if text.strip().lower().startswith(("i'm sorry", "i cannot", "i can't", "sorry, but")):
            print(f"[gemini] possible soft refusal (finishReason={finish_reason}): {text[:200]!r}")

        return {
            "text": text,
            "input_tokens": usage.get("promptTokenCount", 0),
            "output_tokens": usage.get("candidatesTokenCount", 0),
            "truncated": truncated,
        }