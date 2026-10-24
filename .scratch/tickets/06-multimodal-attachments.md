## Parent

Part of #2

## What to build

Implement attachment staging and multimodal uploads. Allow users to select or drag-and-drop document files (`.pdf`, `.docx`, `.txt`, `.csv`, `.xlsx` up to 5MB) and images (`.png`, `.jpg`, `.jpeg`, `.webp`). Render a staged preview strip above the chat input with image thumbnails or file icons and interactive remove buttons. On submission, convert files to base64 attachment payloads required by FastAPI `/chat`. In message history, render image thumbnails in user message rows and file attachment tags.

## Acceptance criteria

- [ ] File selector and drag-and-drop reject unaccepted extensions or files exceeding 5MB with clear error notifications.
- [ ] Staged attachments appear in a preview strip with remove buttons (`×`) to dismiss items before sending.
- [ ] Sending a message encodes attachments into `{ name, type, data }` base64 structures in `ChatRequest`.
- [ ] Image attachments render as rounded thumbnails in the user message bubble history.
- [ ] Document attachments render with file icons and filenames in message bubbles.
- [ ] Component integration tests verify validation limits, preview strip removal, and payload serialization.

## Blocked by

#6
