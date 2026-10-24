## What to build

Ensure conversation history viewport renders immediately anchored at the bottom without triggering a visible smooth scroll-from-top animation on conversation load or switching.

Currently, in `ChatWorkspace` (`frontend-next/src/components/chat/chat-workspace.tsx`), the scroll helper unconditionally calls `messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })` inside a `useEffect` watching `[messages, isGenerating, scrollToBottom]`. When a user opens or switches to a conversation with existing history, the viewport initially paints at the top (`scrollTop: 0`) and visibly animates a long smooth scroll down to the most recent message. This causes a disorienting visual artifact and perceived lag.

## Proposed Solution

1. **Instant Initial Anchor**:
   - Differentiate initial conversation history loading / conversation switching from ongoing incremental message appending.
   - When historical messages are loaded or when mounting a conversation with history, set the viewport scroll position directly to the bottom instantly (`behavior: 'instant'` or direct `viewportRef.current.scrollTop = viewportRef.current.scrollHeight` in layout phase) before the user sees the content.
   - The conversation must appear already at the bottom with 0ms perceived scroll movement.

2. **Selective Smooth Scrolling**:
   - Preserve smooth scrolling only for real-time interactions during the active session:
     - User submitting a new prompt.
     - New incoming streamed assistant chunks or typewriter generation steps.
     - Clicking a "Scroll to bottom" indicator if scrolled up.
   - Avoid smooth scrolling on initial history load, conversation switching, or cache hydration.

3. **Scroll Container Alignment**:
   - Ensure `message-stream-scroll-viewport` cleanly anchors to the bottom message without layout shifts as images, code blocks, or markdown components mount.

## Acceptance criteria

- [ ] Loading an existing conversation history renders the screen starting immediately at the bottom without animating from the top.
- [ ] Switching between conversations in the sidebar instantly positions the message viewport at the latest message without smooth-scrolling transit.
- [ ] User submitting a new message or receiving assistant streaming responses continues to smoothly follow new message content.
- [ ] Zero visible jump or scroll flash occurs when switching between conversations of varying history lengths.
- [ ] Vitest tests in `chat-workspace.test.tsx` verify that initial conversation load applies instant scroll positioning (`behavior: 'instant'` or synchronous scroll height anchoring) rather than smooth scroll.

## Blocked by

None — can start immediately.
