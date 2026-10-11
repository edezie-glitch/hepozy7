# Use OpenAPI TypeScript Codegen for End-to-End Type Safety

Instead of introducing tRPC routers on the Next.js server to proxy backend calls, we will generate TypeScript types directly from FastAPI's OpenAPI specification (`/openapi.json`) using `openapi-typescript`.

## Status
Accepted

## Context
A primary value proposition of the T3 Stack is end-to-end type safety via tRPC. However, because our backend is written in Python with FastAPI and Pydantic models, introducing tRPC would require either maintaining duplicate schemas or wrapping FastAPI endpoints with Node.js tRPC procedures.

## Considered Options
1. **tRPC Proxy Routers**: Next.js server defines tRPC procedures that forward requests to FastAPI. Rejected due to redundant maintenance overhead and double serialization.
2. **Manual TypeScript Interfaces**: Handcrafted types in `types/api.ts`. Rejected due to risk of silent schema drift between FastAPI and the frontend.
3. **OpenAPI TypeScript Generation (Chosen)**: Run `openapi-typescript` against FastAPI's live or exported OpenAPI schema to produce strictly typed client models (`ChatRequest`, `ChatResponse`, etc.).

## Consequences
- Preserves T3-grade type safety directly against the Python backend.
- Simplifies client calls: standard `fetch` wrappers remain lightweight with full auto-completion and compile-time type verification.
