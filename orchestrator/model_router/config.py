PRIMARY_PROVIDER = "groq"
FALLBACK_PROVIDER = "gemini"
 
TASK_MODEL_MAP = {
    "simple": ("groq", "openai/gpt-oss-20b"),           # normal everyday answers
    "complex": ("groq", "openai/gpt-oss-120b"),          # complex reasoning / difficult tasks
    "tool_use_short": ("groq", "openai/gpt-oss-120b"),   # short tool-use style queries (search/calc/exec signals)
    "tool_use_long": ("groq", "openai/gpt-oss-120b"),    # longer tool-use style queries
    "vision": ("groq", "qwen/qwen3-32b"),                # images, OCR, multimodal — unreachable until ChatRequest carries image data
    "long_document": ("gemini", "gemini-flash-latest"),  # long-document analysis + all downloadable-file requests
    # Still an unfilled placeholder — nothing routes here until you put in
    # the real fine-tune model string from Together (client.fine_tuning.retrieve(job.id)).
    "simple_finetuned": ("together", "your-username/Qwen3-8B-your-suffix"),
}
 
# Not chat targets — called as separate checks, not through TASK_MODEL_MAP
PROMPT_GUARD_FAST = "meta-llama/llama-prompt-guard-2-22m"     # prompt-injection detection
PROMPT_GUARD_STRONG = "meta-llama/llama-prompt-guard-2-86m"   # stronger prompt-injection detection
SAFEGUARD_MODEL = "openai/gpt-oss-safeguard-20b"              # safety and policy checking
 
# Which user actions get the STRONG prompt-guard tier instead of the fast
# default — a missed injection matters more here than on an ordinary message.
HIGH_STAKES_ACTIONS = {
    "share_document",
    "publish_document",
    "export_document",
    "invite_collaborator",
}
 
# Not chat completions — separate audio endpoint
WHISPER_FAST = "whisper-large-v3-turbo"   # fast speech-to-text
WHISPER_ACCURATE = "whisper-large-v3"     # high-accuracy speech-to-text
 
FALLBACK_MODEL = "gemini-flash-latest"
GEMINI_FALLBACK_PROVIDER = "groq"
GEMINI_FALLBACK_MODEL = "openai/gpt-oss-120b"