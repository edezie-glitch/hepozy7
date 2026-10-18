## What to build

Refactor `ChatWorkspace` (`frontend-next/src/components/chat/chat-workspace.tsx`) to adopt shadcn's Base UI `MessageScroller` primitive, replacing manual DOM imperative scroll tracking, refs (`pendingInstantScrollRef`, `loadedConversationIdRef`, `upgradedConversationIdRef`, `viewportRef`, `messagesEndRef`), and `useIsomorphicLayoutEffect` synchronization with a declarative headless scroll architecture.

## Proposed Solution

1. **Install / Add Base UI MessageScroller Primitive**:
   - Add shadcn `MessageScroller` components (`MessageScrollerProvider`, `MessageScroller`, `MessageScrollerViewport`, `MessageScrollerContent`, `MessageScrollerItem`, `MessageScrollerButton`) under `frontend-next/src/components/ui/message-scroller.tsx` (using installed `@base-ui/react: ^1.9.0`).

2. **Integrate into ChatWorkspace**:
   - Wrap the message stream in `<MessageScrollerProvider autoScroll>` and `<MessageScroller>`.
   - Use `<MessageScrollerViewport>` for the pane-docked scroll container.
   - Render each `<MessageItem>` inside a `<MessageScrollerItem key={msg.id} messageId={msg.id} scrollAnchor={msg.sender === 'user'}>`.
   - Add `<MessageScrollerButton>` to provide a floating "Scroll to bottom" button when the user detaches during generation or scrolls up.

3. **Eliminate Imperative Ref Boilerplate**:
   - Safely remove manual `pendingInstantScrollRef`, `loadedConversationIdRef`, `upgradedConversationIdRef`, manual `useIsomorphicLayoutEffect` scroll triggers, and imperative `scrollTop = scrollHeight` assignments.
   - Let Base UI handle bottom pinning, intelligent detachment on upward user scroll, and turn anchoring.

4. **Verify & Update Tests**:
   - Ensure existing tests in `frontend-next/src/__tests__/chat-workspace.test.tsx` pass cleanly by preserving `data-testid="message-stream-scroll-viewport"` and `data-testid="message-stream-container"` on the new component tree.

## Acceptance criteria

- [ ] `MessageScroller` primitive components are placed in `frontend-next/src/components/ui/message-scroller.tsx`.
- [ ] `ChatWorkspace` uses `MessageScroller` compound components instead of manual imperative scroll refs.
- [ ] History loads and conversation switches land immediately at the latest turn with zero perceived visual jump.
- [ ] When a user scrolls up during active response streaming, auto-scroll detaches cleanly without fighting user input, and a floating "Scroll to bottom" button appears.
- [ ] Clicking "Scroll to bottom" smoothly re-anchors the user to the live edge.
- [ ] Existing `chat-workspace.test.tsx` test suite passes with all assertions green.

## Blocked by

None — ready to implement in next session.
