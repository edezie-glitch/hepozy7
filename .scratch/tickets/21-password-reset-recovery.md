## What to build

Implement a complete self-service password reset and recovery workflow in `frontend-next/` using Supabase Auth.

Currently, the login page (`/login` and `LoginForm` in `frontend-next/src/components/auth/login-form.tsx`) only provides email/password entry and a "Create account" link. If a user forgets their password, there is no UI pathway to request a password reset email or update their credentials.

## Proposed Solution

1. **Forgot Password Entrypoint**:
   - Add an accessible "Forgot password?" link next to or below the password input in `LoginForm` pointing to `/reset-password`.
   - Maintain the existing card styling, typography, and responsive spacing.

2. **Password Reset Request View (`/reset-password`)**:
   - Create a clean card layout matching `/login` and `/register` with an email input and a "Send recovery link" button.
   - On submission, invoke `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password/update` })`.
   - Display a clear confirmation banner instructing the user to check their inbox, or clear error messages if the request fails or rate-limits.
   - Provide a "Back to login" link.

3. **Password Update View (`/reset-password/update`)**:
   - Dedicated route reached after clicking the email recovery link (authenticated via recovery token in session).
   - Form requesting a new password and confirm password.
   - Enforce Hepozy password requirements (at least 20 characters matching registration standards, and matching confirmation).
   - On submit, call `supabase.auth.updateUser({ password: newPassword })`.
   - On success, redirect the user to `/login` with an alert/toast indicating their password was updated successfully.

4. **Middleware & Route Safeguards**:
   - Ensure `/reset-password` and `/reset-password/update` are permitted public/recovery routes in `middleware.ts`.

## Acceptance criteria

- [ ] `LoginForm` renders a "Forgot password?" link directing users to `/reset-password`.
- [ ] `/reset-password` renders an accessible form requesting email and validates format with Zod and React Hook Form.
- [ ] Submitting a valid email initiates `supabase.auth.resetPasswordForEmail` with the correct redirect URL and displays confirmation instructions.
- [ ] `/reset-password/update` enforces the 20-character minimum password rule and matching confirmation validation.
- [ ] Submitting the update form calls `supabase.auth.updateUser` and redirects to `/login` with success feedback.
- [ ] Unauthenticated access to public reset routes is allowed by Supabase SSR auth middleware.
- [ ] Vitest unit and integration tests verify form validation, recovery email triggers, password updates, and error handling.

## Blocked by

None — can start immediately.
