## Parent

Part of #2

## What to build

Initialize the new Next.js 15+ App Router application in `frontend-next/` with TypeScript, Tailwind CSS, and shadcn/ui. Configure the design token system with Hepozy's brand orange (`#ff7300`) as the primary accent, supporting both dark and light modes via `next-themes`. Configure Next.js rewrites to proxy `/api/:path*` to the FastAPI backend (`http://localhost:8000/:path*`) and add the `openapi-typescript` script to generate backend types from OpenAPI schema.

## Acceptance criteria

- [ ] Next.js 15+ app is initialized in `frontend-next/` using pnpm and TypeScript without touching `frontend/`.
- [ ] Tailwind CSS and shadcn/ui are configured with CSS variables mapping `primary` to `#ff7300`.
- [ ] Theme toggling between dark and light modes works without flash of unstyled content via `next-themes`.
- [ ] `next.config.ts` includes rewrites proxying `/api/:path*` to `http://localhost:8000/:path*`.
- [ ] Package script `pnpm codegen:api` generates TypeScript types from FastAPI's OpenAPI specification.
- [ ] Smoke test passes confirming the app compiles, renders a home shell, and toggles theme cleanly.

## Blocked by

None — can start immediately.
