# Research: Authentication and Tenant Creation

**Date**: 2026-07-23
**Feature**: 001-auth-tenant-creation

## Decision 1: Tenant Creation Strategy at Sign-Up

**Decision**: Use a PostgreSQL `AFTER INSERT` trigger on `auth.users` (`handle_new_user`),
implemented as a `SECURITY DEFINER` function, to atomically create the Tenant and
Profile rows when Supabase Auth creates a new user.

**Rationale**:
- Atomic: Tenant and Profile creation happen in the same transaction as the auth user
  creation. No orphaned users are possible.
- No extra round-trip: The client calls only `supabase.auth.signUp()`. No second RPC
  call needed after sign-up.
- Standard pattern: Supabase officially documents this approach in their Row Level
  Security and User Management guides.
- Organization name and full name are passed via `signUp({ options: { data: { ... } } })`
  and are readable inside the trigger as `NEW.raw_user_meta_data`.

**Alternatives considered**:
- Client-side RPC after sign-up: Requires a second network call; risks race conditions
  or failure between auth creation and Tenant creation, leaving an orphaned auth user
  with no Tenant. Rejected.
- Supabase Edge Function webhook on `auth.users` insert: More infrastructure to
  maintain; adds latency. Rejected for V1 simplicity.

## Decision 2: RLS Policy Design for `tenants` Table

**Decision**: No direct `INSERT` permission granted to authenticated users on `tenants`.
The trigger handles all inserts. `SELECT` is scoped via a join through `profiles`:
users may only see the Tenant row whose `id` matches their profile's `tenant_id`.

**Rationale**:
- Prevents clients from inserting arbitrary Tenant rows (only the trigger does this).
- Prevents cross-tenant data leakage at the database layer, not just the application
  layer.
- The `profiles` join is the single source of truth for "which tenant does this user
  belong to?" and will be reused across all future RLS policies in the application.

**Alternatives considered**:
- Storing `tenant_id` in JWT claims via a Supabase Auth hook: More powerful but
  requires additional configuration and adds complexity. Deferred to a future
  performance optimization if needed at scale.

## Decision 3: `profiles` Table vs. User Metadata Only

**Decision**: Create a dedicated `profiles` table in the public schema to store
`full_name`, `role`, and `tenant_id` per user. Do not rely on
`auth.users.raw_user_meta_data` for role and tenant membership.

**Rationale**:
- `raw_user_meta_data` is mutable by the client via `updateUser()`; storing security-
  relevant data (role, tenant membership) there would allow privilege escalation.
- A `profiles` row protected by RLS is the authoritative source for role and tenant
  context, readable by other tables' RLS policies.
- Allows the future Operator invite feature to insert a new `profiles` row for an
  existing auth user without modifying the `tenants` table.

**Alternatives considered**:
- Storing role in `auth.users.app_metadata` (server-controlled): Requires service_role
  key or an Edge Function to write. More secure in theory, but overcomplicated for V1.
  Accepted trade-off: role stored in `profiles` with RLS protection is sufficient for
  the V1 two-role model (Admin / Operator).

## Decision 4: React Router v6 Protected Route Pattern

**Decision**: Create a `ProtectedRoute` wrapper component that reads auth state from
`AuthContext`. If no session exists, redirect to `/login` via `<Navigate replace
state={{ from: location }} />`. After login, the login page reads `location.state.from`
and forwards the user to the originally requested route.

**Rationale**:
- Declarative and composable: protected routes are defined once in the `App.tsx`
  route tree.
- Preserves the intended destination URL across the login redirect (good UX).
- `AuthContext` holds the Supabase `onAuthStateChange` subscription, making auth
  state reactive across all components without prop drilling.

## Decision 5: Password Reset Flow

**Decision**: Two-step flow using Supabase's built-in email delivery:
1. `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<app>/reset-password' })`
2. User lands on `/reset-password`; Supabase injects the session from the URL hash
   automatically. The page calls `supabase.auth.updateUser({ password: newPassword })`.

**Rationale**:
- Zero custom email infrastructure needed for V1 (Supabase SMTP handles delivery).
- The `redirectTo` URL is validated against the list of allowed redirect URLs
  configured in the Supabase project dashboard, preventing open-redirect attacks.
- The reset link is single-use and time-limited by Supabase (default expiry: 1 hour),
  satisfying FR-012.

**No NEEDS CLARIFICATION markers remain. All decisions resolved.**
