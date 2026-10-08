import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = "raw-documents"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def archive_raw(document_id: str, raw_html: str) -> None:
    """Uploads the raw fetched HTML, keyed by document_id, for later reference."""
    path = f"{document_id}.html"
    try:
        supabase.storage.from_(BUCKET).upload(
            path, raw_html.encode("utf-8"), {"content-type": "text/html"}
        )
    except Exception as e:
        # Archiving is optional per the doc ("optionally archived") — never
        # let a storage failure break the actual crawl/index pipeline.
        print(f"[storage_client] failed to archive {document_id}: {e}")
