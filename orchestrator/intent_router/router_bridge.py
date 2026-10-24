import os

try:
    from pyswip import Prolog

    _PROLOG_AVAILABLE = True
except Exception:
    _PROLOG_AVAILABLE = False

_KNOWLEDGE_FILE = os.path.join(os.path.dirname(__file__), "knowledge.pl")

# SPEED FIX: previously, _prolog_output_type() created a new Prolog() engine
# AND re-consulted knowledge.pl from disk on every single call - meaning
# every chat message that used the Prolog path re-parsed the same static
# rules file from scratch. knowledge.pl never changes at runtime, so this
# is now done ONCE, at import time, instead of once per request.
_prolog_engine = None
if _PROLOG_AVAILABLE:
    try:
        _prolog_engine = Prolog()
        _prolog_engine.consult(_KNOWLEDGE_FILE)
    except Exception as e:
        print(f"[router_bridge] Prolog init failed at startup, falling back to Python rules: {e}")
        _PROLOG_AVAILABLE = False


def _prolog_output_type(intent: str, multi_step: bool) -> str:
    # Facts are asserted fresh each call (cheap, no disk I/O) — only the
    # engine + consulted rules are reused across calls now.
    _prolog_engine.assertz(f"intent({intent})")
    _prolog_engine.assertz(f"multi_step({'true' if multi_step else 'false'})")

    results = list(_prolog_engine.query("output_type(X)"))

    # Retract the facts we just asserted so they don't accumulate across
    # requests — Prolog's fact database is otherwise a growing, shared,
    # unbounded list for the life of the process.
    _prolog_engine.retractall(f"intent({intent})")
    _prolog_engine.retractall(f"multi_step({'true' if multi_step else 'false'})")

    if not results:
        return "reply"  # safe default if no rule matches
    return str(results[0]["X"])


def _fallback_output_type(intent: str, multi_step: bool) -> str:
    """Pure-Python mirror of knowledge.pl's rules — used if SWI-Prolog isn't installed."""
    table = {
        ("how_to", True): "instructions",
        ("how_to", False): "reply",
        ("show_examples", True): "examples",
        ("show_examples", False): "examples",
        ("opinion_request", True): "reply",
        ("opinion_request", False): "reply",
        ("factual_question", True): "workflow",
        ("factual_question", False): "reply",
    }
    return table.get((intent, multi_step), "reply")


def get_output_type(intent: str, multi_step: bool) -> str:
    if _PROLOG_AVAILABLE:
        try:
            return _prolog_output_type(intent, multi_step)
        except Exception as e:
            print(f"[router_bridge] Prolog query failed, falling back to Python rules: {e}")
    return _fallback_output_type(intent, multi_step)