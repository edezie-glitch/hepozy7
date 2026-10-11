## Parent

Part of #2

## What to build

Implement the core interactive chat flow using a Zustand store (`useChatStore`) for ephemeral input state and interaction control. Support submitting user prompts via auto-resizing textareas, appending user messages, calling `POST /api/chat`, and animating assistant responses with a smooth typewriter effect. Provide a "Stop" button during generation to abort the client animation and notify FastAPI (`POST /api/chat/stop`). Implement message action tools: copy message text, reply-to / quote previous messages in draft input, inline message editing, and retry failed messages.

## Acceptance criteria

- [ ] Chat input textarea auto-resizes as text grows and submits on Enter (Shift+Enter for newline).
- [ ] Submitted prompt immediately renders in message history and sends payload to `POST /api/chat`.
- [ ] Assistant response animates via smooth typewriter effect with a fast-forward/skip option on click.
- [ ] During generation, send button transforms to an active "Stop" button wired to an `AbortController` and `POST /api/chat/stop`.
- [ ] User can quote a previous message, showing an orange accented reply chip in the input bar.
- [ ] User can edit a sent message inline, updating the prompt and re-running the turn.
- [ ] User can click "Retry" on any assistant turn to re-submit the corresponding prompt.
- [ ] Component integration tests verify prompt submission, typewriter completion, abort signal handling, and retry flow.

## Blocked by

#5
