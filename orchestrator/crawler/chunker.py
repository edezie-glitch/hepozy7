
def chunk_text(
    text: str,
    chunk_size: int = 600,
    overlap: int = 100,
) -> list[str]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be between 0 and chunk_size - 1")

    words = text.split()
    if not words:
        return []

    chunks = []
    step = chunk_size - overlap

    for start in range(0, len(words), step):
        chunk = words[start : start + chunk_size]
        chunks.append(" ".join(chunk))

        # Stop once the final word has been included.
        if start + chunk_size >= len(words):
            break

    return chunks
