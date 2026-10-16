## What to build

Replace the spinning Lucide icon loading state in `ChatWorkspace` with animated, structured skeleton placeholder rows during conversation history retrieval (`loadingHistory === true`).

Currently, when switching conversations or loading chat history, `ChatWorkspace` renders a small generic centered spinner (`<Sparkles className="h-4 w-4 animate-spin text-primary" /> Loading messages...`). This causes visual stutter, noticeable layout shift, and fails to communicate the shape and density of the incoming conversation.

## Proposed Solution

1. **Structured Skeleton Placeholders**:
   - Render a sequence of alternating message skeleton rows (e.g. 2 user message skeletons and 2 assistant message skeletons) inside the scrollable message list viewport.
   - Skeletons should mirror real message bubble geometry:
     - User skeletons aligned to the right with rounded corners.
     - Assistant skeletons aligned to the left with avatar circular placeholder, multiline shimmer bars of varying realistic widths (80%, 65%, 90%), and metadata timestamps.
   - Use Tailwind shimmer pulse animations (`animate-pulse bg-muted/60 dark:bg-muted/40 rounded`).

2. **Zero Layout Shifts**:
   - Constrain skeletons to the shared container bounds (`mx-auto max-w-4xl lg:max-w-5xl w-full`).
   - Match exact padding and vertical margins with rendered messages to eliminate layout jumps when messages resolve.

3. **Accessibility**:
   - Provide `aria-busy="true"` and an accessible `role="status"` with screen-reader text (`<span className="sr-only">Loading conversation history...</span>`).

## Acceptance criteria

- [ ] Replaces generic centered spinning icon in `ChatWorkspace` with structured skeleton placeholder rows when `loadingHistory` is true.
- [ ] Skeleton placeholders render alternating user and assistant message rows with avatar and multiline shimmer blocks.
- [ ] Message skeleton container respects the medium max-width centered bounds (`max-w-4xl lg:max-w-5xl`) without visual layout shifts.
- [ ] Accessible status attributes (`aria-busy="true"` and screen-reader status text) are preserved for assistive technologies.
- [ ] Vitest unit tests in `chat-workspace.test.tsx` verify skeleton placeholder rows render properly during loading state.
