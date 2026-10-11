## Problem Statement

Users of the Hepozy AI workspace currently interact through a monolithic vanilla HTML/CSS/JavaScript client (`frontend/` with ~44 KB of imperative code in `home.js`). This client lacks type safety, component modularity, and accessibility standards. Authentication relies on manual client-side token renewal in `localStorage`, UI interactions suffer from fragile DOM mutations, and there is no support for theme customization (such as light mode). Extending features or verifying UI behaviors requires manual browser testing, increasing regression risk.

## Solution

Build a modern, type-safe frontend in `frontend-next/` using the Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, and TanStack Query. It preserves direct integration with the existing FastAPI backend and Supabase infrastructure while introducing cookie-based Supabase SSR sessions, accessible UI primitives, dual dark/light theming with Hepozy's signature orange accent (`#ff7300`), client typewriter animations, and automated testing at the component/view boundary.

## User Stories

1. As an unauthenticated user, I want to be redirected to the login page when accessing the workspace, so that unauthorized access is prevented.
2. As a user, I want to sign in using my email and password with instant client-side validation, so that I can securely access my conversations.
3. As a new user, I want to register for a new account with password confirmation and format validation, so that I can create a Hepozy account.
4. As a registered user with email confirmation enabled, I want to see a verification pending screen, so that I know to check my email before signing in.
5. As an authenticated user, I want to sign out from the profile menu, so that my session is cleared across cookies and client state.
6. As an authenticated user, I want my session token to be silently passed to the FastAPI backend on every request, so that I remain authenticated without manual token refresh logic.
7. As a user, I want to view my past conversations in a collapsible sidebar, so that I can switch between chat threads.
8. As a user, I want to filter and search my conversation history in real time, so that I can find past discussions quickly.
9. As a user, I want to start a new conversation at any time, so that I can start a fresh topic.
10. As a user, I want my conversation title to be automatically generated and updated from my first prompt, so that my sidebar remains organized.
11. As a user, I want to delete a conversation from the sidebar with a single action, so that I can remove unwanted history.
12. As a user, I want to send text prompts and receive assistant responses with smooth typewriter animation, so that the interaction feels responsive and conversational.
13. As a user, I want the ability to skip the typewriter animation or stop assistant generation mid-flight, so that I can quickly read the full text or cancel unwanted generation.
14. As a user, I want assistant responses to render rich GitHub-flavored Markdown (headers, tables, lists, blockquotes), so that structured content is easy to read.
15. As a user, I want code blocks to have syntax highlighting and a one-click copy button, so that I can easily extract code snippets.
16. As a user, I want tables in responses to be horizontally scrollable and formatted cleanly, so that dense data displays properly on all screen widths.
17. As a user, I want to stage document attachments (.pdf, .docx, .txt, .csv, .xlsx) up to 5MB, so that the assistant can extract and analyze their text.
18. As a user, I want to stage image attachments (.png, .jpg, .jpeg, .webp), so that the vision models can inspect them.
19. As a user, I want to see visual preview chips with remove buttons for all staged attachments before sending, so that I can review what will be uploaded.
20. As a user, I want to see downloadable cards for any generated documents (.docx, .pdf, .xlsx, .csv) with their filename and a download link, so that I can retrieve generated files.
21. As a user, I want to receive interactive clarification prompt chips and freeform input when an inquiry is ambiguous, so that I can quickly disambiguate my intent.
22. As a user, I want to see a clear quota exceeded modal indicating when my message quota will reset, so that I know when I can send messages again.
23. As a user, I want to edit a previously sent message inline, so that I can refine my question and regenerate the response.
24. As a user, I want to retry a failed or unsatisfactory message with one click, so that I don't have to retype my prompt.
25. As a user, I want to reply to/quote a specific message in the conversation, so that the assistant understands context for follow-up questions.
26. As a user, I want to toggle between dark theme and light theme, so that the application adapts to my visual preference while keeping Hepozy's brand orange accent.
27. As a mobile user, I want a responsive slide-out navigation drawer with touch overlay, so that the interface is fully usable on mobile screens.

## Implementation Decisions

- **Framework & Directory**: Build the application in `frontend-next/` using Next.js 15+ App Router, TypeScript, and pnpm. The legacy `frontend/` directory remains untouched until full parity is verified.
- **Backend Communication**: Configure Next.js rewrites in `next.config.ts` to route `/api/:path*` to `http://localhost:8000/:path*`.
- **Type Safety**: Maintain contract synchronization with FastAPI using `openapi-typescript` against `http://localhost:8000/openapi.json` to generate strongly typed models (`ChatRequest`, `ChatResponse`, etc.).
- **Authentication**: Utilize `@supabase/ssr` with cookie-based session management in middleware, forwarding bearer JWTs in HTTP headers to FastAPI. Forms use `react-hook-form` with `zod` schemas.
- **State Management**: Use TanStack Query for server state caching (conversations, quotas, user profile) and Zustand (`useChatStore`) for ephemeral chat interactions (staged attachments, drafts, active AbortController, reply quotes).
- **Markdown & Code UI**: Use `react-markdown` with `remark-gfm` and syntax highlighting. Wrap code blocks with copy-to-clipboard buttons and tables with scrollable wrappers.
- **Design Tokens & Theming**: Style accessible Base UI primitives (`@base-ui/react`) with Tailwind CSS and Hepozy's brand orange (`#ff7300`) as primary accent, supporting dark and light themes through `next-themes`.

## Testing Decisions

- **Single High-Level Seam**: Tests will be written at the **Page & Component Behavioral Seam** using Vitest and React Testing Library (with mock network handlers for `/api/*`).
- **Good Test Criteria**: Tests must verify user-visible inputs and outputs (e.g. submitting form -> redirect, clicking stop -> abort signal emitted, typing markdown -> formatted DOM elements displayed). No testing of internal component state or implementation details.
- **Key Test Suites**:
  1. Auth flow: Login, validation errors, and redirect upon successful session.
  2. Chat workspace: Sending messages, typewriter rendering, stop generation, and error retry.
  3. Attachments: File staging, size/extension rejection, and preview strip removal.
  4. Theming: Theme toggle switching dark and light class names and preserving accent styles.

## Out of Scope

- Rewriting the Python FastAPI orchestrator or modifying its endpoints.
- Introducing tRPC routers, Prisma ORM, or Node.js database connections.
- Altering Supabase SQL schema migrations (`schema.sql`).
- Native mobile applications (iOS/Android).

## Further Notes

- Refer to `CONTEXT.md` for domain glossary definitions (`Conversation`, `Assistant`, `Message`, `Attachment`, `Generated Document`, `Clarification Prompt`).
- Refer to `docs/adr/` (ADR 0001, ADR 0002, ADR 0003) for architectural rationales.
