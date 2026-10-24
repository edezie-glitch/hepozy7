import os

import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.environ["GROQ_API_KEY"]
RERANK_MODEL = "openai/gpt-oss-20b"


def _score_relevance(query: str, chunk_text: str) -> float:
    prompt = (
        f"Query: {query}\n\nText: {chunk_text}\n\n"
        "Rate how relevant this text is to answering the query, "
        "on a scale of 0 to 10. Respond with ONLY the number."
    )
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={"model": RERANK_MODEL, "messages": [{"role": "user", "content": prompt}]},
            timeout=15,
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()
        return float("".join(c for c in text if c.isdigit() or c == "."))
    except Exception as e:
        print(f"[reranker] scoring failed for one chunk, keeping original order: {e}")
        return 0.0


def rerank(query: str, chunks: list[dict]) -> list[dict]:
    """Re-scores and re-sorts chunks by relevance. Expensive — one Groq call per chunk."""
    scored = [(chunk, _score_relevance(query, chunk["content"])) for chunk in chunks]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return [chunk for chunk, _score in scored]
