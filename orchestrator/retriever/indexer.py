import os
import re
from pathlib import Path

from retriever.embedder import embed_text
from retriever.supabase_store import upsert_chunk

DOCUMENTS_DIR = Path(__file__).parent.parent / "documents"

# Rough chunking - splits on blank lines (paragraph breaks). Documents with
# very long unbroken paragraphs will produce very long chunks; adjust
# CHUNK_MAX_CHARS or add sentence-level splitting if that's a problem for
# your actual source material.
CHUNK_MAX_CHARS = 2000


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _chunk_text(text: str) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current = ""
    for p in paragraphs:
        if len(current) + len(p) > CHUNK_MAX_CHARS and current:
            chunks.append(current.strip())
            current = ""
        current += p + "\n\n"
    if current.strip():
        chunks.append(current.strip())
    return chunks


def index_file(path: Path) -> int:
    """Embeds and stores every chunk of one file. Returns chunk count indexed."""
    text = path.read_text(encoding="utf-8")
    chunks = _chunk_text(text)
    document_id = _slugify(path.stem)

    indexed = 0
    for i, chunk in enumerate(chunks):
        vector = embed_text(chunk)
        if vector is None:
            print(f"[indexer] skipping chunk {i} from {path.name} - embedding failed")
            continue

        try:
            upsert_chunk(
                document_id=f"{document_id}-{i}",
                content=chunk,
                embedding=vector,
                metadata={"source": path.name, "chunk_index": i},
            )
            indexed += 1
        except Exception as e:
            print(f"[indexer] failed to store chunk {i} from {path.name}: {e}")

    return indexed


def run() -> None:
    if not DOCUMENTS_DIR.exists():
        print(f"[indexer] {DOCUMENTS_DIR} does not exist - nothing to index")
        return

    files = list(DOCUMENTS_DIR.glob("*.txt")) + list(DOCUMENTS_DIR.glob("*.md"))
    if not files:
        print(f"[indexer] no .txt or .md files found in {DOCUMENTS_DIR}")
        return

    total = 0
    for path in files:
        count = index_file(path)
        print(f"[indexer] {path.name}: {count} chunks indexed")
        total += count

    print(f"[indexer] done - {total} chunks indexed across {len(files)} files")


if __name__ == "__main__":
    run()