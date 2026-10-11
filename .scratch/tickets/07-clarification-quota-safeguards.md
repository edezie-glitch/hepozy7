## Parent

Part of #2

## What to build

Implement interactive clarification prompt chips and quota exceeded safeguards. When FastAPI responds with `needs_clarification: true`, render clickable suggested reply pills above the input along with a freeform input field so the user can quickly disambiguate intent. When `quota_exceeded: true` is returned, show a backdrop modal overlay detailing when message quota resets (`quota_reset_at`), disabling send controls until dismissal via Escape key or backdrop click.

## Acceptance criteria

- [ ] Clarification prompt component displays suggested reply pills when `needs_clarification` is active.
- [ ] Clicking a suggested reply pill or entering freeform clarification submits the answer into the current conversation.
- [ ] Quota exceeded response triggers a modal dialog with human-readable reset countdown time.
- [ ] Quota overlay is dismissible via close button, Escape key, or clicking the background backdrop.
- [ ] Component integration tests verify clarification submission and quota dialog lifecycle.

## Blocked by

#6
