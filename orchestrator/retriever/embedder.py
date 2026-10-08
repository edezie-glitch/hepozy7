"""
Two embedders, alternating per request, per explicit instruction:
router 1 = gemini-embedding-001, router 2 = gemini-embedding-2.

FLAGGED ONCE, IN CODE, FOR WHOEVER TOUCHES THIS NEXT (not repeating this
in chat - decision made, this is just so it's not a silent trap later):
these two models produce different, incompatible vector spaces even when
both are asked for 768 output dimensions. A document embedded by router 1
and a query embedded by router 2 will not match correctly via cosine
similarity, and pgvector will not error when this happens - it will
return a number that looks like a valid similarity score. If retrieval
quality seems to degrade or behave inconsistently later, this file is
the first place to look.
"""

import os
import itertools

import requests
from dotenv import load_dotenv

load_dotenv()

EMBEDDING_DIMENSION = 768

_MODEL_1 = "gemini-embedding-001"
_MODEL_2 = "gemini-embedding-2"

_rotation = itertools.cycle([_MODEL_1, _MODEL_2])


def _call_gemini_embed(text: str, model: str, api_key: str) -> list[float]:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:embedContent?key={api_key}"
    )
    response = requests.post(
        url,
        json={
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": EMBEDDING_DIMENSION,
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return data["embedding"]["values"]


def embed_text(text: str) -> list[float] | None:
    """
    Returns a 768-dimension float vector, or None if the key is missing or
    the call fails. Alternates between gemini-embedding-001 and
    gemini-embedding-2 on successive calls (router 1 / router 2), per
    request.

    Fails open (returns None) on any error, matching the pattern used
    everywhere else in this codebase.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[embedder] GEMINI_API_KEY not set — skipping embedding, RAG context will be empty")
        return None

    model = next(_rotation)

    try:
        vector = _call_gemini_embed(text, model, api_key)
        print(f"[embedder] embedded via {model} — {len(vector)} dimensions")
        return vector
    except Exception as e:
        print(f"[embedder] embed_text failed on {model}, continuing without embedding: {e}")
        return None