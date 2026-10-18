## What to build

Enforce a unified, consistent maximum width constraint and column alignment across `ChatWorkspace` (`frontend-next/src/components/chat/chat-workspace.tsx`), aligning the message stream, sticky bottom input bar, loading skeleton, and floating scroll controls.

Currently:
1. In `ChatWorkspace`, the message stream content container (`MessageScrollerContent`) has `className="mx-auto flex min-h-full max-w-4xl lg:max-w-5xl w-full flex-col space-y-2"`.
2. The sticky bottom input bar container (`chat-input-bounds`) has `className="mx-auto max-w-4xl w-full space-y-2"`. On large displays (`lg` breakpoint and above), the message stream widens to `max-w-5xl` (1024px) while the input bar remains locked to `max-w-4xl` (896px), causing horizontal visual misalignment.
3. The floating Base UI "Scroll to bottom" button (`MessageScrollerButton`) is anchored to the far right edge of the full-width viewport (`absolute bottom-4 right-6`) rather than aligned with the centered conversation column, causing it to float far away on ultrawide monitors.
4. Assistant message text and markdown formatting lack a consistent reading measure constraint across wide viewports.

## Proposed Solution

1. **Standardize Max-Width Column Across Chat Workspace**:
   - Harmonize `MessageScrollerContent`, `MessageStreamSkeleton`, and `chat-input-bounds` to share the exact same max-width constraint (e.g. `max-w-4xl lg:max-w-5xl` or consistent `max-w-4xl` across both).
   - Ensure `empty-conversation-card`, `ClarificationPrompt`, and staged attachments align seamlessly within this unified column without layout jumps or horizontal overflow.

2. **Align Floating Scroll Button to Chat Column**:
   - Anchor `MessageScrollerButton` within the centered column container or constrain its position relative to the max-width chat bounds so that on large/ultrawide displays, the "Scroll to bottom" indicator remains adjacent to the conversation messages and input bar rather than floating at the screen perimeter.

3. **Verify Reading Measure & Responsive Spacing**:
   - Ensure assistant messages maintain optimal typography and readability without unbounded line stretching on wide viewports.
   - Maintain appropriate mobile padding (`px-4 py-3 sm:px-6 sm:py-4`).

4. **Update Component Tests**:
   - Verify in `chat-workspace.test.tsx` and `message-scroller.test.tsx` that `message-stream-container` and `chat-input-bounds` share matching max-width constraints.
   - Verify layout stability and proper rendering of empty state, skeletons, and message items within the unified width.

## Acceptance criteria

- [ ] `MessageScrollerContent` and `chat-input-bounds` share identical max-width constraints and horizontal alignment across all viewport breakpoints (`sm`, `md`, `lg`, `xl`).
- [ ] `MessageStreamSkeleton` matches the exact max-width bounds of the live message stream to prevent layout shift during conversation history loading.
- [ ] The floating "Scroll to bottom" button is positioned predictably in relation to the conversation reading column on ultrawide viewports.
- [ ] Clarification prompts and input controls remain neatly centered and aligned with the message stream.
- [ ] Component integration tests in `chat-workspace.test.tsx` pass cleanly with all assertions verified.

## Blocked by

None — ready to implement in next session.
