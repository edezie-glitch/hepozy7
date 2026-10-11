# Adopt Next.js App Router and Supabase SSR for Frontend Migration

To modernize the legacy vanilla JavaScript interface (`frontend/`), we will build a Next.js (App Router) application in a parallel directory (`frontend-next/`) using TypeScript, Tailwind CSS, shadcn/ui, and TanStack Query, while retaining the existing FastAPI backend and Supabase infrastructure.

## Status
Accepted

## Context
The existing frontend consists of monolithic vanilla HTML/CSS/JS (`home.js` ~44 KB) with imperative DOM manipulation and manual token refresh loops. The backend is a Python FastAPI orchestrator with LangChain/Groq/Gemini routing, Supabase database, and `pgvector`.

## Considered Options
1. **Full T3 Stack with tRPC and Prisma**: Next.js server acts as a BFF proxying to FastAPI. Rejected due to dual-schema maintenance and unnecessary proxy latency.
2. **Full Rewrite in Node.js**: Reimplementing FastAPI in Next.js server routes. Rejected due to high migration cost and discarding working Python AI pipelines.
3. **Next.js App Router + Supabase SSR + TanStack Query (Chosen)**: Direct integration with FastAPI REST endpoints, cookie-based Supabase auth, and type-safe React UI.

## Consequences
- The Next.js application will live in `frontend-next/` during development to allow side-by-side verification with `frontend/`.
- FastAPI remains the single source of truth for chat execution, document generation, and rate limiting.
- Supabase SSR manages authentication cookies, forwarding JWT bearer tokens to FastAPI.
