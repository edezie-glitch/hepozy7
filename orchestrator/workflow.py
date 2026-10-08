import re

from intent_router.nlp import classify_intent, has_multiple_steps
from intent_router.router_bridge import get_output_type

TOOL_USE_PATTERNS = [
    r"\bsearch\b", r"\blatest\b", r"\bcurrent\b", r"\btoday\b",
    r"\bcalculate\b", r"\brun (this|the) code\b", r"\bexecute\b",
]


def _needs_tool_use(message: str) -> bool:
    text = message.lower()
    return any(re.search(p, text) for p in TOOL_USE_PATTERNS)


def _choose_task_type(message: str, multi_step: bool, intent: str) -> str:
    """Returns a key matching model_router/config.py's TASK_MODEL_MAP."""
    if _needs_tool_use(message):
        return "tool_use_long" if len(message.split()) > 15 else "tool_use_short"
    if multi_step or intent == "how_to":
        return "complex"
    return "simple"


def decide_workflow(message: str) -> dict:
    """
    Returns a plan dict describing what this request needs:
      - needs_crawl: bool (stub — always False, no crawler exists yet)
      - needs_retrieve: bool (stub — always False, no retriever exists yet)
      - model: str (real routing across gpt-oss-20b/120b, qwen, and — pending
        confirmation of availability — compound/compound-mini)
      - output_type: str (reply / instructions / workflow / examples)
      - guard_model: str (prompt-guard model used on the incoming message)
      - safeguard_model: str (safeguard model used on the outgoing reply)

    UNCHANGED — this file already correctly emitted tool_use_short/long.
    The bug was that model_router/config.py had no matching keys for them;
    that's fixed in config.py, not here.

    NOTE: guard_model and safeguard_model are computed below but main.py
    currently ignores both — it calls select_prompt_guard_model(req.user_action)
    and a hardcoded SAFEGUARD_MODEL constant instead of reading these two
    fields. Either wire main.py to actually read plan["guard_model"] /
    plan["safeguard_model"], or drop these two keys — as written they're
    computed and discarded every request.
    """
    intent = classify_intent(message)
    multi_step = has_multiple_steps(message)
    output_type = get_output_type(intent, multi_step)
    task_type = _choose_task_type(message, multi_step, intent)

    return {
        "needs_crawl": False,  # stub — no crawler wired into this path yet, runs standalone
        "needs_retrieve": True,  # retriever is now wired in — see main.py
        "task_type": task_type,
        "output_type": output_type,
        "intent": intent,
        "multi_step": multi_step,
        "guard_model": "meta-llama/llama-prompt-guard-2-86m",
        "safeguard_model": "openai/gpt-oss-safeguard-20b",
    }