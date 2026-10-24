import os
import random
import time

import requests

from model_router.adapters.gemini_adapter import GeminiAdapter
from model_router.adapters.groq_adapter import GroqAdapter, GROQ_MAX_OUTPUT_TOKENS
from model_router.adapters.adapter2 import TogetherAdapter
from model_router.config import FALLBACK_MODEL, GEMINI_FALLBACK_PROVIDER, GEMINI_FALLBACK_MODEL
# ADDED: the shared token bucket (see rate_limiter.py). GROQ_TPM_LIMIT now lives there.
from rate_limiter import GROQ_TPM_LIMIT, groq_reserve, groq_settle, groq_failed

_groq = GroqAdapter()
_gemini = GeminiAdapter()
_together = TogetherAdapter()
_ADAPTERS = {"groq": _groq, "gemini": _gemini, "together": _together}

# A second Gemini model, tried when the main one is overloaded. Check the exact name in Google AI
# Studio. You can also change it without editing code: set GEMINI_BACKUP_MODEL in .env.
GEMINI_BACKUP_MODEL = os.environ.get("GEMINI_BACKUP_MODEL", "gemini-flash-lite-latest")

# Groq's free tier: tokens per minute for the whole account. The prompt AND the answer size you
# ask for both count (your 413 error said "Requested 13460" against "Limit 8000").
GROQ_MIN_OUTPUT_TOKENS = 1500   # below this room for the answer, Groq is not worth calling
_SYSTEM_PROMPT_TOKENS = 400     # the adapters add a system prompt of about this size

# The whole answer (all models, all retries) must finish before Cloudflare gives up at ~100 s.
DEADLINE_SECONDS = 90
MIN_ATTEMPT_SECONDS = 6
_DEFAULT_TIMEOUT = {"groq": 30.0, "gemini": 60.0}
_RETRY_STATUS = {500, 502, 503, 504}   # busy or broken for a moment: same model is worth another try
_BACKOFF = (1.0, 2.5)                  # seconds to wait before retry 2 and retry 3

<<<<<<< HEAD
# ADDED: shorter wait per model. A healthy model answers in a few seconds; waiting 60 s on a stuck one
# (your log: gemini-flash-latest timed out after ~60 s, then flash-lite answered in 2 s) made every
# such request take over a minute. Change without editing code: GEMINI_TIMEOUT / GROQ_TIMEOUT in .env.
_DEFAULT_TIMEOUT["gemini"] = float(os.environ.get("GEMINI_TIMEOUT", "25"))
_DEFAULT_TIMEOUT["groq"] = float(os.environ.get("GROQ_TIMEOUT", "20"))

# ADDED: circuit breaker. A model that just timed out or returned a server error is skipped for
# BREAKER_SECONDS, so the next users do not each wait for the same dead model. It is only skipped when
# another model is available; if all are marked down, they are all tried anyway.
BREAKER_SECONDS = float(os.environ.get("MODEL_BREAKER_SECONDS", "60"))
_down: dict[tuple[str, str], float] = {}


def _is_down(prov: str, mod: str) -> bool:
    return _down.get((prov, mod), 0) > time.monotonic()


def _mark_down(prov: str, mod: str, why: str) -> None:
    if prov == "groq":
        return   # Groq's limits are handled by rate_limiter.py
    if why == "timed out" or why.startswith("HTTP 5") or why == "connection error":
        _down[(prov, mod)] = time.monotonic() + BREAKER_SECONDS
        print(f"[fallback] {prov}/{mod} marked down for {BREAKER_SECONDS:.0f}s ({why})")


=======
>>>>>>> 17d14f619ee27a032db336356d927b1b42009a91
USER_MESSAGE = "Connection lost. Please try again in a moment."


class ModelUnavailable(RuntimeError):
    """Every model was tried and none answered. The message is safe to show to a user."""


def _estimate_tokens(prompt: str, history: list[dict] | None) -> int:
    chars = len(prompt) + sum(len(str(t.get("content", ""))) for t in (history or []))
    return int(chars / 3.5) + _SYSTEM_PROMPT_TOKENS


def _groq_output_cap(est_in: int) -> int | None:
    """How big an answer Groq may write for this prompt, or None if the prompt is too big for Groq."""
    room = GROQ_TPM_LIMIT - int(est_in * 1.15)   # 15% safety, because this is an estimate
    if room < GROQ_MIN_OUTPUT_TOKENS:
        return None
    return min(room, GROQ_MAX_OUTPUT_TOKENS)


def _candidates(provider: str, model: str) -> list[tuple[str, str]]:
    """Models to try, in order, without repeats."""
    order = []
    if provider != "gemini":
        order.append((provider, model))            # what the router chose
    order.append(("gemini", model if provider == "gemini" else FALLBACK_MODEL))
    order.append(("gemini", GEMINI_BACKUP_MODEL))  # second Gemini model
    order.append((GEMINI_FALLBACK_PROVIDER, GEMINI_FALLBACK_MODEL))  # different company as last resort
    seen, result = set(), []
    for c in order:
        if c not in seen and c[0] in _ADAPTERS:
            seen.add(c)
            result.append(c)
    return result


def _try_once(prov: str, mod: str, prompt: str, history, kwargs: dict):
    """Returns ("ok", result) | ("retry", why) | ("next", why)."""
    try:
        result = _ADAPTERS[prov].complete(prompt, model=mod, history=history, **kwargs)
        return "ok", result
    except requests.Timeout:
        return "next", "timed out"                  # a slow server: try another model, do not wait again
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else None
        if status in _RETRY_STATUS:
            return "retry", f"HTTP {status}"
        return "next", f"HTTP {status}"             # 400, 401, 403, 404, 413, 429: this model will not work now
    except requests.ConnectionError:
        return "retry", "connection error"
    except requests.RequestException as e:
        return "next", type(e).__name__
    except (RuntimeError, KeyError, IndexError, ValueError, TypeError) as e:
        return "next", f"{type(e).__name__}: {str(e)[:120]}"   # blocked, empty or odd answer


def complete_with_fallback(
    prompt: str,
    provider: str,
    model: str,
    history: list[dict] | None = None,
    user_id: str | None = None,   # ADDED: needed for the per-user share of the Groq budget
) -> dict:
    """
    Tries the model the router chose, then the others, until one answers.

    1. The router's model. Groq is skipped up front when the prompt is too big for its
       per-minute limit (before: it was called anyway, failed with 413 every time, and wasted time).
       When Groq does fit, its answer size is lowered so the request stays under the limit.
       ADDED: before Groq is called, tokens are reserved from a shared bucket (rate_limiter.py).
       If the bucket is empty, or this user already used their share this minute, the request
       goes to Gemini at once instead of failing on Groq with a 429.
    2. Gemini main model, then a second Gemini model, then Groq 120b as a last resort.
    3. A busy model (500/502/503/504) is retried up to 2 more times with a short wait.
       A timeout or any other error moves straight to the next model.
    4. Everything has to finish inside DEADLINE_SECONDS so Cloudflare does not cut the request off.

    Returns {"text", "input_tokens", "output_tokens", "truncated", "provider", "model"}.
    Raises ModelUnavailable (message safe for users) when nothing works.
    """
    deadline = time.monotonic() + DEADLINE_SECONDS
    est_in = _estimate_tokens(prompt, history)
    failures = []

    for prov, mod in _candidates(provider, model):
<<<<<<< HEAD
        # ADDED: skip a model that just failed (circuit breaker), unless every other model is down too
        if _is_down(prov, mod) and any(
            not _is_down(p, m) for p, m in _candidates(provider, model) if (p, m) != (prov, mod)
        ):
            failures.append(f"{prov}/{mod}: recently failing, skipped")
            continue

=======
>>>>>>> 17d14f619ee27a032db336356d927b1b42009a91
        kwargs: dict = {}
        held = 0   # Groq tokens reserved for this candidate
        if prov == "groq":
            cap = _groq_output_cap(est_in)
            if cap is None:
                print(f"[fallback] skipping groq/{mod}: prompt (about {est_in} tokens) is too big for Groq's per-minute limit")
                failures.append(f"{prov}/{mod}: too big")
                continue
            kwargs["max_tokens"] = cap

            # ADDED: ask the shared bucket. Reserve what Groq will count: the prompt plus the answer size.
            held = int(est_in * 1.15) + cap
            allowed, why = groq_reserve(mod, user_id, held, deadline - time.monotonic())
            if not allowed:
                print(f"[fallback] skipping groq/{mod}: {why}")
                failures.append(f"{prov}/{mod}: {why}")
                continue

        last_info = "no attempt made"   # nothing was sent, so the whole reservation is given back
        for attempt in range(3):
            remaining = deadline - time.monotonic()
            if remaining < MIN_ATTEMPT_SECONDS:
                failures.append(f"{prov}/{mod}: no time left")
                break
            if prov in _DEFAULT_TIMEOUT:
                kwargs["timeout"] = min(_DEFAULT_TIMEOUT[prov], remaining)

            outcome, info = _try_once(prov, mod, prompt, history, kwargs)
            if outcome == "ok":
                if prov == "groq":
                    # ADDED: swap the reservation for the real token count
                    groq_settle(mod, user_id, held, info["input_tokens"] + info["output_tokens"])
                if failures:
                    print(f"[fallback] answered by {prov}/{mod} after: {'; '.join(failures)}")
                return {**info, "provider": prov, "model": mod}

            last_info = info
<<<<<<< HEAD
            _mark_down(prov, mod, info)   # ADDED: remember that this model is struggling
=======
>>>>>>> 17d14f619ee27a032db336356d927b1b42009a91
            print(f"[fallback] {prov}/{mod} attempt {attempt + 1}: {info}")
            if outcome == "next" or attempt == 2:
                failures.append(f"{prov}/{mod}: {info}")
                break
            wait = _BACKOFF[attempt] + random.uniform(0, 0.5)
            if deadline - time.monotonic() - wait < MIN_ATTEMPT_SECONDS:
                failures.append(f"{prov}/{mod}: {info}")
                break
            time.sleep(wait)

        if prov == "groq":
            groq_failed(mod, held, last_info)   # ADDED: refund, or drain the bucket on a 429

        if deadline - time.monotonic() < MIN_ATTEMPT_SECONDS:
            break

    print(f"[fallback] every model failed: {'; '.join(failures)}")
    raise ModelUnavailable(USER_MESSAGE)