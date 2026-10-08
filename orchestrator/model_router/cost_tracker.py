import time
from contextlib import contextmanager

from usage_logger import log_usage


@contextmanager
def track_call(user_id: str, provider: str, model: str, cache_hit: bool = False):
    """
    Usage:
        with track_call(user_id, "groq", model) as tracker:
            result = router.route(...)
            tracker["input_tokens"] = result["input_tokens"]
            tracker["output_tokens"] = result["output_tokens"]
    Logs automatically on exit, including latency.
    """
    start = time.monotonic()
    tracker = {"input_tokens": 0, "output_tokens": 0}
    try:
        yield tracker
    finally:
        latency_ms = int((time.monotonic() - start) * 1000)
        log_usage(
            user_id=user_id,
            provider=provider,
            model=model,
            input_tokens=tracker["input_tokens"],
            output_tokens=tracker["output_tokens"],
            cache_hit=cache_hit,
            latency_ms=latency_ms,
        )
