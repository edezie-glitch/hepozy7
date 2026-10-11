# Hepozy

Hepozy is an AI workspace assistant integrating multi-model LLM routing, real-time file generation, semantic search, and document understanding.

## Language

**Conversation**:
A persistent sequence of user and assistant messages belonging to an authenticated user.
_Avoid_: Chat session, thread, dialog

**Assistant**:
The AI persona responding to user inquiries, generating structured documents, and coordinating multimodal tools.
_Avoid_: Bot, agent, model

**Message**:
A single communication unit within a conversation, containing text and optional attachments or generated files.
_Avoid_: Prompt, entry, post

**Attachment**:
A user-uploaded document or image accompanying a message for text extraction or visual understanding.
_Avoid_: File upload, asset, payload

**Generated Document**:
A downloadable Word, PDF, Excel, or CSV document produced by the system from structured response data.
_Avoid_: Export, output file, artifact

**Clarification Prompt**:
Interactive suggested options presented to the user when an inquiry requires additional disambiguation before proceeding.
_Avoid_: Follow-up chips, quick replies, disambiguation buttons
