from retriever.embedder import embed_text
from retriever.supabase_store import match_documents


def search(query: str, match_count: int = 10, filter: dict | None = None) -> list[dict]:
    """Returns top-k relevant chunks (text + metadata) for a user query."""
    query_embedding = embed_text(query)
    return match_documents(query_embedding, match_count=match_count, filter=filter)
