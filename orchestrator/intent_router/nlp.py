import re

HOW_TO_PATTERNS = [r"\bhow (do|can|to)\b", r"\bhow do i\b", r"\bsteps? to\b"]
EXAMPLES_PATTERNS = [r"\bexample[s]?\b", r"\bshow me\b", r"\bsample[s]?\b"]
OPINION_PATTERNS = [r"\bwhat do you think\b", r"\bshould i\b", r"\bis it (good|bad|worth)\b"]


def classify_intent(message: str) -> str:
    """Returns one of: how_to / show_examples / opinion_request / factual_question."""
    text = message.lower()

    for pattern in HOW_TO_PATTERNS:
        if re.search(pattern, text):
            return "how_to"
    for pattern in EXAMPLES_PATTERNS:
        if re.search(pattern, text):
            return "show_examples"
    for pattern in OPINION_PATTERNS:
        if re.search(pattern, text):
            return "opinion_request"

    return "factual_question"


def has_multiple_steps(message: str) -> bool:
    """Heuristic: multiple sentences, numbered lists, or 'and then'/'after that' style text."""
    text = message.lower()

    if re.search(r"\b(step\s*\d|first.*then|and then|after that)\b", text):
        return True
    if re.search(r"\b\d\.\s", message):  # numbered list like "1. ... 2. ..."
        return True

    sentence_count = len(re.findall(r"[.!?]+", message))
    return sentence_count >= 3
