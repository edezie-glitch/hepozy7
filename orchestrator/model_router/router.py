from model_router.config import TASK_MODEL_MAP
from model_router.cost_tracker import track_call
from model_router.fallback import complete_with_fallback


def route(task_type: str, prompt: str, user_id: str, history: list[dict] | None = None) -> dict:
    """
    Routes a prompt to the right model based on task_type, with automatic
    Groq -> Gemini fallback on failure, and usage logged automatically.
    history: prior conversation turns, oldest first — passed through so the
    model sees the whole conversation, not just the current message.
    Returns the reply text.

    UNCHANGED from the original — this file was never the bug. It correctly
    does a generic .get() lookup; it just had nowhere real to land for
    tool_use_short/tool_use_long until config.py was fixed.
    """
    provider, model = TASK_MODEL_MAP.get(task_type, TASK_MODEL_MAP["simple"])

    with track_call(user_id, provider, model) as tracker:
        result = complete_with_fallback(prompt, provider=provider, model=model, history=history)
        tracker["input_tokens"] = result["input_tokens"]
        tracker["output_tokens"] = result["output_tokens"]

    return result