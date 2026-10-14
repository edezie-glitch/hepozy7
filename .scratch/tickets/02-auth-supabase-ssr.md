## Parent

Part of #2

## What to build

Implement full user authentication replacing `login.html`, `register.html`, and `verifypend.html` using `@supabase/ssr` cookies and Next.js middleware. Create login and registration pages using `react-hook-form` and `zod` validation matching Supabase credentials requirements. Protect private routes so unauthenticated requests redirect to `/login`. Ensure authenticated requests pass the session's JWT bearer token in the `Authorization` header to the `/api` client for FastAPI verification.

## Acceptance criteria

- [x] Supabase SSR client is configured for server components, client components, and route middleware using `@supabase/ssr`.
- [x] Next.js middleware guards protected routes (`/`) and redirects unauthenticated users to `/login`.
- [x] Login screen validates email and password fields, signs in via Supabase, and redirects to `/` on success.
- [x] Registration screen validates matching passwords, signs up via Supabase, and redirects to `/verifypend` if email confirmation is enabled.
- [x] Verification pending screen displays guidance and link back to login.
- [x] API client helper automatically attaches `Authorization: Bearer <token>` from active session on requests to FastAPI.
- [x] Integration tests verify route redirection for unauthenticated sessions and successful login flow.

## Blocked by

#3
