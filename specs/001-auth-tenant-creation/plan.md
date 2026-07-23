# Implementation Plan: Authentication and Tenant Creation

**Branch**: `001-auth-tenant-creation` | **Date**: 2026-07-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-auth-tenant-creation/spec.md`

## Summary

Enable new BPO/accounting firm representatives to register on ClickFolha, which
automatically creates their personal account and a Tenant record in one atomic
operation. Existing users can log back in and have their session restored. Users who
forgot their password can recover access via an email reset link.

The core implementation challenge is the **Tenant creation at sign-up**: a database
trigger running with elevated privileges creates both the Tenant row and the user
profile row atomically when Supabase Auth creates the user, using organization
metadata passed during registration. RLS then scopes all subsequent access.

## Technical Context

**Language/Version**: TypeScript (strict mode), React 18

**Primary Dependencies**:
- `@supabase/supabase-js` v2 — Auth, database queries, RPC
- `react-router-dom` v6 — SPA routing and route guards
- `react-hook-form` + `zod` — Form state management and schema validation
- `shadcn/ui` (Radix primitives + Tailwind) — UI components
- `sonner` — Toast notifications

**Storage**: Supabase PostgreSQL — `tenants` and `profiles` tables; Supabase Auth
manages the `auth.users` table internally.

**Testing**: Vitest + React Testing Library for unit/component tests

**Target Platform**: Modern web browsers (Chrome, Firefox, Edge, Safari — latest two
major versions each)

**Project Type**: Web application (React SPA backed by Supabase BaaS)

**Performance Goals**:
- Registration flow (form submit to dashboard) under 90 seconds (SC-001)
- Login flow (form submit to dashboard) under 30 seconds (SC-002)
- Password reset email delivered and actionable within 2 minutes (SC-004)

**Constraints**:
- No MFA, no social login (V1 scope)
- Supabase Auth manages sessions; no custom session logic
- Tenant creation MUST be atomic with user creation (no orphaned users)
- RLS MUST isolate Tenant data from the moment of first login

**Scale/Scope**: Single-region Supabase project; V1 handles tens to low hundreds of
concurrent Tenants. No horizontal scaling concerns at this stage.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Client-Side Processing | Pass | Auth feature sends only email/password credentials to Supabase Auth. No file data is involved. |
| II. Multi-Tenant Data Isolation | Pass (with care) | Tenant creation uses a SECURITY DEFINER trigger that bypasses RLS during the initial atomic INSERT. RLS is then enabled on tenants and profiles tables to scope all subsequent access to the authenticated user's own Tenant. The privileged trigger is the only intentional RLS bypass and is scoped to the handle_new_user function. |
| III. Config-Driven Rule Engine | N/A | This feature does not involve the processing rule engine. |
| IV. Metadata-Only Audit Trail | N/A | No payroll conversions occur in this feature. |
| V. V1 Scope Discipline | Pass | Spec explicitly excludes MFA, social login, Stripe integration, and Operator invite. Those are separate features. |

**Post-design re-check**: All principles still pass after Phase 1 design. The
SECURITY DEFINER function is the only privileged operation and is justified: it is
the standard Supabase pattern for atomic post-signup row creation and does not grant
any persistent privilege escalation.

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-tenant-creation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── database.md      # SQL schema, RLS policies, trigger
│   └── auth-flows.md    # Supabase Auth API call patterns
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── supabase.ts            # Supabase client singleton
├── types/
│   └── database.ts            # TypeScript types for DB tables
├── contexts/
│   └── AuthContext.tsx        # Auth state (session, user, tenant) provider
├── hooks/
│   └── useAuth.ts             # Auth hook consuming AuthContext
├── components/
│   └── ProtectedRoute.tsx     # Route guard; redirects unauthenticated users
├── pages/
│   ├── LoginPage.tsx          # Email + password login form
│   ├── RegisterPage.tsx       # Registration form (name, org, email, password)
│   ├── ForgotPasswordPage.tsx # Email entry for password reset request
│   └── ResetPasswordPage.tsx  # New password entry after clicking reset link
└── App.tsx                    # Router setup with public/protected route split
```

**Structure Decision**: Single web application structure under `src/`. No backend
directory needed since Supabase is the BaaS; all server-side logic lives in database
functions, and the client-side React app handles the UI.

## Complexity Tracking

> No constitution violations to justify. All principles pass cleanly.
