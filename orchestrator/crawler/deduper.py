import hashlib
import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def hash_content(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def is_duplicate(source_url: str, text: str) -> bool:
    """True if this exact content (by hash) was already indexed for this URL."""
    content_hash = hash_content(text)
    result = (
        supabase.table("documents")
        .select("id")
        .eq("source_url", source_url)
        .eq("content_hash", content_hash)
        .execute()
    )
    return len(result.data) > 0


def record_document(source_url: str, text: str) -> str:
    """Inserts a new documents row, returns the new document_id."""
    content_hash = hash_content(text)
    result = (
        supabase.table("documents")
        .insert({"source_url": source_url, "content_hash": content_hash})
        .execute()
    )
    return result.data[0]["id"]
