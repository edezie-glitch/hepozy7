import hashlib
import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _make_cache_key(message: str, model: str) -> str:
    """Normalizes (lowercase, stripped) so trivial whitespace/case differences still hit."""
    normalized = f"{model}:{message.strip().lower()}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def get_cached_response(message: str, model: str) -> dict | None:
    """
    Returns the cached row if this exact message+model has been asked before, else None.

    CHANGED: now also selects safeguard_passed, so main.py can skip re-running
    the safeguard check on cache hits where it's already confirmed to have
    passed once — REQUIRES a safeguard_passed boolean column on
    response_cache (add it via migration; defaults to NULL for existing rows,
    which main.py treats as "not confirmed, check once more" rather than
    silently trusting old rows with no recorded verdict).
    """
    key = _make_cache_key(message, model)
    try:
        result = (
            supabase.table("response_cache")
            .select("reply, input_tokens, output_tokens, safeguard_passed")
            .eq("cache_key", key)
            .execute()
        )
    except Exception as e:
        print(f"[cache] lookup failed, treating as cache miss: {e}")
        return None

    if result.data:
        return result.data[0]
    return None


def store_response(
    message: str, model: str, reply: str, input_tokens: int, output_tokens: int,
    safeguard_passed: bool = False,
) -> None:
    """
    Writes a new cache entry. A cache write failing should never break the user's response.

    CHANGED: now also stores safeguard_passed, so future cache hits on this
    exact text can skip re-checking it. Defaults to False (not "assumed
    safe") — callers that already ran the safeguard check successfully
    should pass True explicitly; anything that doesn't pass it explicitly
    gets re-checked on its next cache hit, which is the safe default.
    """
    key = _make_cache_key(message, model)
    try:
        supabase.table("response_cache").upsert(
            {
                "cache_key": key,
                "message": message,
                "model": model,
                "reply": reply,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "safeguard_passed": safeguard_passed,
            }
        ).execute()
    except Exception as e:
        print(f"[cache] write failed, response still returned to user: {e}")