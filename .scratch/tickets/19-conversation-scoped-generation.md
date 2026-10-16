## What to build

Scope assistant generation and stop-mode state to specific conversation IDs so that navigating between conversations does not disable or lock the input box across unrelated conversations.

Currently, `isGenerating`, `activeRequestId`, and `abortController` are managed globally in `useChatStore`. When a response is pending or generating in Conversation A, the bottom chatbox displays a Stop button and disables the text input globally. If a user clicks into Conversation B or starts a new conversation from the sidebar while Generation A is in flight, the chat input in Conversation B remains disabled with the Stop button visible, preventing the user from interacting with other conversations.

## Proposed Solution

1. **Scoped Generation State**:
   - Scope generation state by `conversationId` (e.g. tracking `generatingConversationId` or a mapping of active generation controllers by conversation).
   - If the user moves to a different conversation, the chat input for that conversation remains active and editable.

2. **Per-Conversation Stop Controls**:
   - The Stop button should only appear in the bottom input bar when viewing the specific conversation that is actively generating.
   - For all other non-generating conversations, the standard Send button and interactive textarea are displayed.

3. **Background Generation Preservation**:
   - Allow generation in Conversation A to continue streaming or complete in the background when the user temporarily views Conversation B.
   - Returning to Conversation A seamlessly displays the generating stream, active animated typewriter, or completed assistant message.

## Acceptance criteria

- [ ] Moving to a different conversation while an inquiry is generating in the previous conversation restores the new conversation's chat input to an enabled, interactive state.
- [ ] Stop button is scoped strictly to the generating conversation and does not lock down the input controls of unrelated conversations.
- [ ] Returning to the generating conversation restores the active generating state, animated typing/stream indicator, and stop control if still in progress.
- [ ] Aborting or stopping generation from either conversation or background cleanup behaves predictably without orphaned abort controllers.
- [ ] Vitest integration tests in `chat-workspace.test.tsx` and `workspace-shell.test.tsx` verify independent input states across conversation switching.
