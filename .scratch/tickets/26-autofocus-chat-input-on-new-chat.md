## What to build

Ensure that when the user triggers "New Chat" (via the expanded sidebar button, collapsed sidebar icon button, mobile drawer button, or empty conversation reset), the keyboard cursor and focus are immediately and automatically placed inside the chat input textarea (`chat-input-textarea`).

Currently:
1. In `WorkspaceShell` (`frontend-next/src/components/workspace/workspace-shell.tsx`), clicking "New Chat" invokes `handleNewChat()`, which clears the active conversation ID and resets workspace state (`resetWorkspaceState(true)`).
2. However, the browser focus remains stuck on the clicked "New Chat" button (or on the sidebar/drawer), requiring the user to manually click inside the chatbox textarea before they can start typing their prompt.
3. In `ChatInput` (`frontend-next/src/components/chat/chat-input.tsx`), the textarea ref is maintained internally, but there is no mechanism or state trigger to transfer focus to the textarea when a new chat is started or when switching to an empty conversation state.

## Proposed Solution

1. **Chat Input Focus Management**:
   - Provide a mechanism (e.g., via `useChatStore` focus trigger, prop, or effect reacting to new chat reset) to programmatically focus `textareaRef.current`.
   - In `ChatInput`, ensure `textareaRef.current?.focus()` is called when a new chat action occurs.
   - Maintain clean focus management without unwanted layout jumps or scrolling artifacts.

2. **Trigger Focus on "New Chat" Touchpoints**:
   - In `WorkspaceShell` / `ConversationSidebar`:
     - In `handleNewChat` and `handleStartConversation`, signal the focus trigger so that as soon as the workspace clears or sets up the optimistic conversation, the chatbox textarea gains focus.
     - On mobile drawer "New Chat" click, close the drawer and ensure focus transfers smoothly to the main chat input.

3. **Verify Edge Cases & Accessibility**:
   - Ensure focusing the textarea does not disrupt existing prompt draft text or staged attachments if present.
   - Ensure screen readers correctly announce the input field when focused.
   - Ensure selecting an existing conversation with history does not unexpectedly steal focus if the user is scrolling history, or only autofocus when explicitly creating/starting a new chat.

4. **Automated Unit & Integration Tests**:
   - In `frontend-next/src/__tests__/chat-workspace.test.tsx` and `workspace-shell.test.tsx`:
     - Test that clicking "New Chat" in the sidebar causes the chat input textarea (`getByTestId('chat-input-textarea')`) to receive focus (`toHaveFocus()`).
     - Test that starting a new chat from both desktop and mobile drawer properly focuses the input box.

## Acceptance criteria

- [ ] Clicking "New Chat" in the expanded desktop sidebar immediately places cursor focus inside the chat input textarea.
- [ ] Clicking "New Chat" in the collapsed sidebar icon rail immediately places cursor focus inside the chat input textarea.
- [ ] Clicking "New Chat" inside the mobile drawer panel closes the drawer and focuses the chat input textarea.
- [ ] Users can start typing their prompt immediately after clicking "New Chat" without requiring an extra click inside the textarea.
- [ ] Unit & integration tests in `workspace-shell.test.tsx` and `chat-workspace.test.tsx` assert that `chat-input-textarea` has focus following a new chat trigger.

## Blocked by

None — ready to implement.
