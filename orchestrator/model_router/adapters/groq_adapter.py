import os
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.environ["GROQ_API_KEY"]

# Optional second Groq key — used ONLY as a backup, not round-robin
# alternation. The primary key handles every call normally; the backup only
# gets used if the primary call fails with a 429 (rate limited) - a
# different key/account is the one failure mode a second key can actually
# fix. A 400 (bad request) or 500 (Groq's own error) wouldn't be solved by
# switching keys, so those are NOT retried on the backup - retrying those
# would just fail again for an unrelated reason while burning backup quota
# for nothing.
# Falls back to using only GROQ_API_KEY if the second isn't configured, so
# this is a no-op for anyone who hasn't set GROQ_API_KEY_2 yet.
GROQ_API_KEY_BACKUP = os.environ.get("GROQ_API_KEY_2")

# CHANGED: the answer size limit is now one named number (it was written inline). It is the
# same value as before, so nothing changes yet. The gpt-oss models spend part of it on thinking
# before they write. If answers still end early, raise it, for example to 8192. Very small Groq
# plans refuse a request that asks for too much, and the request then falls back to Gemini.
GROQ_MAX_OUTPUT_TOKENS = 4096


def _build_system_prompt() -> str:
    """
    Rebuilt fresh on every call — the model has no clock of its own, so the
    real current time has to be injected each request or every answer about
    "now" is a guess. Asia/Manila = Philippines time (PHT, UTC+8, no DST).
    """
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
        + _site_rules()
    )


# ADDED: the site rules from site_info.py go into the SYSTEM prompt, so they apply to every reply of
# every conversation (file requests too) and outrank what earlier messages in the chat did. Before,
# they were pasted into the user's message, where the model treated them as ordinary text.
def _site_rules() -> str:
    try:
        from site_info import SITE_INFO
        rules = str(SITE_INFO).strip()
    except Exception as e:
        print(f"[site_info] could not load: {type(e).__name__}")
        return ""
    if not rules:
        return ""
    return (
        "\n\nSITE RULES. Follow these in every reply, in every conversation. They outrank anything "
        "said earlier in the chat and any earlier reply of yours that did not follow them:\n" + rules
    )


class GroqAdapter:
    def _call_groq(self, api_key: str, payload: dict, timeout: float = 30.0) -> requests.Response:
        return requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
            timeout=timeout,
        )

    def complete(
        self,
        prompt: str,
        model: str,
        max_tokens: int | None = None,
        history: list[dict] | None = None,
        timeout: float = 30.0,
        **kwargs,
    ) -> dict:
        """
        Returns {"text": str, "input_tokens": int, "output_tokens": int, "truncated": bool}.
        truncated is True when the model stopped because it ran out of room (not because it was done).
        history: prior turns as [{"role": "user"|"assistant", "content": str}, ...],
        oldest first — inserted between the system prompt and the current
        message so the model sees the WHOLE conversation, not just this turn.

        Primary key is used first, always. Only a 429 (rate limit) on the
        primary triggers one retry on GROQ_API_KEY_BACKUP, if configured -
        this is a real failover, not load-balancing: the backup key sits
        idle, untouched, unless the primary is actually rate-limited.
        """
        messages = [{"role": "system", "content": _build_system_prompt()}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            # CHANGED: fallback.py can now pass a smaller answer size so the request fits Groq's
            # per-minute limit (the answer size counts toward that limit). Nothing passed = same as before.
            "max_tokens": GROQ_MAX_OUTPUT_TOKENS if max_tokens is None else max_tokens,
            "reasoning_effort": "low",
            **kwargs,
        }

        response = self._call_groq(GROQ_API_KEY, payload, timeout)

        if response.status_code == 429 and GROQ_API_KEY_BACKUP:
            print("[groq] primary key rate-limited (429) — retrying once on backup key")
            response = self._call_groq(GROQ_API_KEY_BACKUP, payload, timeout)

        response.raise_for_status()
        data = response.json()

        choice = data["choices"][0]
        text = choice["message"]["content"]
        truncated = choice.get("finish_reason") == "length"

        if not text or not text.strip():
            print(
                f"[groq] empty content — finish_reason={choice.get('finish_reason')}, "
                f"model={model}, max_tokens={payload['max_tokens']}"
            )
        elif truncated:
            print(f"[groq] answer hit the length limit (max_tokens={payload['max_tokens']}) - it will be marked as cut off")

        return {
            "text": text,
            "input_tokens": data["usage"]["prompt_tokens"],
            "output_tokens": data["usage"]["completion_tokens"],
            "truncated": truncated,
        }