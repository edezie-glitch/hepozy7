## Parent

Part of #2

## What to build

Build the main chat workspace layout consisting of a topbar and a conversation history sidebar. Integrate TanStack Query to manage server state: fetch past conversations (`GET /api/chat/conversations`), filter/search conversation titles locally, start a new conversation, auto-update titles (`PATCH /api/chat/conversations/:id/title`), and delete conversations (`DELETE /api/chat/conversations/:id`). Provide a user profile dropdown with sign-out action and theme switcher. Include full mobile responsiveness with a collapsible slide-over drawer and backdrop.

## Acceptance criteria

- [ ] Topbar displays current conversation title, user profile avatar, settings modal trigger, and theme toggle.
- [ ] Sidebar fetches and displays conversations with skeleton loading states.
- [ ] Real-time search input filters the conversation list without server round-trips.
- [ ] Clicking "New Chat" resets active conversation state and clears the view.
- [ ] Deleting a conversation sends a `DELETE` request and updates the local cache optimistically.
- [ ] Mobile view toggles a slide-out drawer with backdrop overlay on viewport widths <= 640px.
- [ ] Component integration tests verify conversation listing, search filtering, and deletion.

## Blocked by

#4
