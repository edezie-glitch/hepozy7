import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def upsert_chunk(document_id: str, content: str, embedding: list[float], metadata: dict) -> None:
    """Writes one embedded chunk into document_chunks."""
    supabase.table("document_chunks").upsert(
        {
            "document_id": document_id,
            "content": content,
            "embedding": embedding,
            "metadata": metadata,
        }
    ).execute()


def match_documents(query_embedding: list[float], match_count: int = 10, filter: dict | None = None) -> list[dict]:
    """Calls the match_documents RPC (pgvector similarity search) defined in schema.sql."""
    result = supabase.rpc(
        "match_documents",
        {
            "query_embedding": query_embedding,
            "match_count": match_count,
            "filter": filter or {},
        },
    ).execute()
    return result.data
