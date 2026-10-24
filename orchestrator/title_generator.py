import os
import re
import requests
from dotenv import load_dotenv

load_dotenv()

TITLE_SYSTEM_PROMPT = (
    "You are a conversation title generator. "
    "Synthesize the user's initial inquiry into a clean, concise, descriptive title of 3 to 6 words. "
    "Strict rules:\n"
    "- Output MUST be between 3 and 6 words.\n"
    "- Return ONLY the plain title text.\n"
    "- Do NOT enclose in quotes, backticks, or brackets.\n"
    "- Do NOT include trailing punctuation (such as periods, question marks, exclamation marks, or dashes).\n"
    "- Do NOT prefix with 'Title:', 'Topic:', 'Subject:', 'Summary:', etc."
)

DEFAULT_FAST_MODEL = "openai/gpt-oss-20b"
DEFAULT_TIMEOUT_SECONDS = 6.0


def build_title_prompt(user_message: str) -> str:
    """Format the user message prompt for title synthesis."""
    clean_msg = user_message.strip()[:1000]
    return f"Inquiry: {clean_msg}"


def clean_generated_title(raw_text: str) -> str:
    """
    Sanitize LLM output by removing quotes, prefixes, markdown decoration,
    and trailing punctuation, while strictly bounding length to 3-6 words.
    """
    if not raw_text or not raw_text.strip():
        return ""

    text = raw_text.strip()

    # Strip prefixes like "Title:", "Topic:", "Subject:", "Summary:"
    text = re.sub(r"^(title|topic|subject|summary)\s*:\s*", "", text, flags=re.IGNORECASE).strip()

    # Strip surrounding single/double/curly quotes, backticks, guillemets
    text = re.sub(r"^[\"\'`«“‘]+|[\"\'`»”’]+$", "", text).strip()

    # Strip markdown decoration (*, _, #, ~)
    text = re.sub(r"[*_#~]", "", text).strip()

    # Normalize internal whitespace
    text = re.sub(r"\s+", " ", text).strip()

    words = text.split()
    # Reject outputs that don't satisfy the 3 to 6 word requirement
    if len(words) < 3:
        return ""

    if len(words) > 6:
        words = words[:6]

    result = " ".join(words)
    # Strip trailing punctuation
    result = re.sub(r"[.,;:!?\-_]+$", "", result).strip()
    return result


def extract_fallback_title(text: str) -> str:
    """
    Produce a clean text excerpt when the LLM summarization call fails or times out.
    Extracts the first 3 to 6 words without trailing punctuation or markdown.
    """
    if not text or not text.strip():
        return "New conversation"

    # Use first line of input
    first_line = text.strip().splitlines()[0]

    # Remove markdown tags, brackets, quotes
    cleaned = re.sub(r"[#*_`~>\[\]\(\)\"\'«»“”‘’]", "", first_line)
    cleaned = re.sub(r"^\W+|\W+$", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    words = cleaned.split()
    if not words:
        return "New conversation"

    if len(words) >= 3:
        excerpt = " ".join(words[:min(len(words), 6)])
    else:
        excerpt = " ".join(words)

    excerpt = re.sub(r"[.,;:!?\-_]+$", "", excerpt).strip()
    return excerpt or "New conversation"


def generate_title(user_message: str, groq_api_key: str | None = None) -> str:
    """
    Synthesize a 3 to 6 word title from user_message using a fast LLM model.
    Falls back to extract_fallback_title on failure, timeout, or invalid output.
    """
    api_key = groq_api_key if groq_api_key is not None else os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return extract_fallback_title(user_message)

    model = os.environ.get("TITLE_MODEL", DEFAULT_FAST_MODEL)
    timeout = float(os.environ.get("TITLE_TIMEOUT", str(DEFAULT_TIMEOUT_SECONDS)))

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": TITLE_SYSTEM_PROMPT},
            {"role": "user", "content": build_title_prompt(user_message)},
        ],
        "max_tokens": 40,
        "temperature": 0.2,
    }

    try:
        res = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
            timeout=timeout,
        )

        if res.status_code == 200:
            data = res.json()
            choices = data.get("choices")
            if choices and isinstance(choices, list):
                raw_text = choices[0].get("message", {}).get("content", "")
                cleaned = clean_generated_title(raw_text)
                if cleaned:
                    return cleaned
        else:
            print(f"[title_generator] LLM returned status {res.status_code}")
    except requests.exceptions.Timeout:
        print(f"[title_generator] LLM call timed out after {timeout}s, falling back to excerpt")
    except Exception as e:
        print(f"[title_generator] LLM call failed: {e}, falling back to excerpt")

    return extract_fallback_title(user_message)


def generate_and_persist_conversation_title(
    conversation_id: str,
    user_id: str,
    initial_message: str,
    supabase_client=None,
) -> str:
    """
    Asynchronous background task to generate and persist conversation title.
    Executes autonomously after the chat response has already been sent (0ms overhead).
    """
    if supabase_client is None:
        try:
            from main import _supabase
            supabase_client = _supabase
        except Exception as e:
            print(f"[title_generation] could not import supabase client: {e}")
            return extract_fallback_title(initial_message)

    try:
        title = generate_title(initial_message)
    except Exception as e:
        print(f"[title_generation] generation threw exception: {e}")
        title = extract_fallback_title(initial_message)

    try:
        # Check if conversation already has a custom title (e.g., user manual rename)
        res = (
            supabase_client.table("conversations")
            .select("title")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .execute()
        )
        if res.data and res.data[0].get("title"):
            print(f"[title_generation] conversation {conversation_id} already has title: {res.data[0]['title']!r}")
            return res.data[0]["title"]

        supabase_client.table("conversations").update({"title": title}).eq("id", conversation_id).eq("user_id", user_id).execute()
        print(f"[title_generation] persisted title for {conversation_id}: {title!r}")
        return title
    except Exception as e:
        print(f"[title_generation] failed to persist title to database: {e}")
        return title
