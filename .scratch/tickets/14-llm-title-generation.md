## What to build

Replace the static first-message substring truncation (`req.message.strip()[:80]`) in the backend with an autonomous background LLM title generation routine. After the first conversational exchange in a new chat, trigger an asynchronous background task using a fast model to synthesize a concise, descriptive 3-6 word conversation title, persist it in the Supabase conversations table, and reflect the title in the client sidebar.

## Acceptance criteria

- [x] LLM title prompt synthesizes the user's initial prompt into a clean 3 to 6 word title without quotes or trailing punctuation.
- [x] Generation runs as an asynchronous BackgroundTask so 0ms overhead is added to the user's chat response.
- [x] Persists the generated title to the title column in the Supabase conversations table.
- [x] Falls back to a clean text excerpt if the LLM summarization call fails or times out.
- [x] Client conversation sidebar updates dynamically when the generated title is persisted.
- [x] Integration tests verify prompt formatting, background task execution, and fallback handling.
