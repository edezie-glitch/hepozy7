import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def log_usage(
    user_id: str,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_hit: bool = False,
    latency_ms: int | None = None,
) -> None:
    """Writes one row to llm_usage. Never lets a logging failure break a chat response."""
    try:
        supabase.table("llm_usage").insert(
            {
                "user_id": user_id,
                "provider": provider,
                "model": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cache_hit": cache_hit,
                "latency_ms": latency_ms,
            }
        ).execute()
    except Exception as e:
        print(f"[log_usage] FAILED to log usage: {e}")