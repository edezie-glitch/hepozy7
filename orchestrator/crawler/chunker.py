CHUNK_SIZE_WORDS = 600  # ~ 800 tokens
OVERLAP_WORDS = 100


def chunk_text(text: str) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks = []
    start = 0
    while start < len(words):
        end = start + CHUNK_SIZE_WORDS
        chunks.append(" ".join(words[start:end]))
        start += CHUNK_SIZE_WORDS - OVERLAP_WORDS

    return chunks
