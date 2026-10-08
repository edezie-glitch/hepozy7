import time

import requests

from model_router.adapters.gemini_adapter import GeminiAdapter
from model_router.adapters.groq_adapter import GroqAdapter
from model_router.adapters.adapter2 import TogetherAdapter
from model_router.config import FALLBACK_MODEL, GEMINI_FALLBACK_PROVIDER, GEMINI_FALLBACK_MODEL

_groq = GroqAdapter()
_gemini = GeminiAdapter()
_together = TogetherAdapter()
_ADAPTERS = {"groq": _groq, "gemini": _gemini, "together": _together}


def complete_with_fallback(prompt: str, provider: str, model: str, history: list[dict] | None = None) -> dict:
    """
    Calls the requested provider/model directly.

    Timeouts and 503s each get ONE same-provider retry (both are "transient,
    worth retrying" - a timeout means the server didn't answer in time, not
    that it structurally can't; a 400 never gets retried on the same
    provider, since that will never succeed twice).

    FALLBACK CHAIN, now two-tiered:
      - Any non-gemini provider (groq, together) failing -> falls back to
        Gemini (FALLBACK_MODEL), as before.
      - Gemini ITSELF failing (this is long_document's primary provider) ->
        previously had nowhere to go at all ("Gemini failed and is already
        the fallback target" -> hard failure, confirmed happening live in
        production logs). Now falls back to GEMINI_FALLBACK_PROVIDER/MODEL
        (Groq's gpt-oss-120b) as a genuine second option on different
        infrastructure - a real fix, not "retry the same single point of
        failure." Tradeoff, accepted deliberately: gpt-oss-120b has a
        smaller context window and its own separate TPM budget - a genuinely
        huge document that fits in Gemini's window may not fit here, and
        this call could itself fail on a large enough prompt. Still strictly
        better than always failing whenever Gemini has a bad moment,
        regardless of document size.
      - If GEMINI_FALLBACK_PROVIDER/MODEL also fails, that's a real, final
        failure - both real options on two different providers were tried.

    Returns {"text", "input_tokens", "output_tokens", "provider", "model"}.
    """
    adapter = _ADAPTERS[provider]

    for attempt in range(2):
        try:
            result = adapter.complete(prompt, model=model, history=history)
            return {**result, "provider": provider, "model": model}
        except requests.Timeout as e:
            if attempt == 0:
                print(f"[fallback] {provider}/{model} timed out (transient), retrying same provider once")
                time.sleep(2)
                continue
            print(f"[fallback] {provider}/{model} timed out again on retry - giving up on this provider: {e}")
            break
        except requests.HTTPError as e:
            status = e.response.status_code if e.response is not None else None
            body = e.response.text if e.response is not None else "no response body"
            if status == 503 and attempt == 0:
                print(f"[fallback] {provider}/{model} got 503 (transient), retrying same provider once")
                time.sleep(2)
                continue
            print(f"[fallback] {provider}/{model} failed ({e}) - body: {body}")
            break
        except requests.RequestException as e:
            print(f"[fallback] {provider}/{model} errored ({e})")
            break

    if provider == "gemini":
        # Gemini itself failed - this used to be a dead end. Now tries a
        # real second option on different infrastructure instead of giving up.
        print(f"[fallback] gemini/{model} exhausted its retries — trying {GEMINI_FALLBACK_PROVIDER}/{GEMINI_FALLBACK_MODEL} as a genuine second option")
        try:
            fallback_adapter = _ADAPTERS[GEMINI_FALLBACK_PROVIDER]
            result = fallback_adapter.complete(prompt, model=GEMINI_FALLBACK_MODEL, history=history)
            return {**result, "provider": GEMINI_FALLBACK_PROVIDER, "model": GEMINI_FALLBACK_MODEL}
        except Exception as e:
            raise RuntimeError(
                f"Both Gemini and its fallback ({GEMINI_FALLBACK_PROVIDER}/{GEMINI_FALLBACK_MODEL}) failed: {e}"
            )

    print(f"[fallback] {provider}/{model} failed, retrying on Gemini")
    result = _gemini.complete(prompt, model=FALLBACK_MODEL, history=history)
    return {**result, "provider": "gemini", "model": FALLBACK_MODEL}