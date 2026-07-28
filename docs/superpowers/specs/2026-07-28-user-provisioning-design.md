# User Provisioning Hierarchy — Design

**Date:** 2026-07-28
**Status:** Approved for planning

## Problem

Today the only way to get an account is the public `/register` page: anyone can
sign up and a Postgres trigger (`cf_handle_new_user`) atomically creates a brand
new tenant (BPO company) + an `admin` profile for them. There is no concept of
inviting someone into an *existing* company, and no way for the platform owner
to provision a company on a customer's behalf.

We're moving to a closed, invite-only model with two provisioning levels:

1. **Platform admin** (`valbersantana@gmail.com`, via `cf_platform_admins`)
   creates a new tenant (BPO company) and invites its first `admin` user.
2. **Tenant admin** (a company's `admin` profile) invites additional users —
   `admin` or `operator` — into their own company only.

## Non-goals

- Per-sub-tenant operator permissions (already out of scope per `CLAUDE.md`).
- Stripe / billing (explicitly deferred).
- Managing platform admins from the UI (stays SQL-only, as today).
- Custom SMTP setup (dashboard config, not code — noted as a rollout risk below).

## Architecture

### Why an Edge Function

Creating a Supabase Auth user *on behalf of someone else* requires the
`service_role` key (`auth.admin.inviteUserByEmail`). That key must never reach
the browser bundle — any authenticated user could then mint accounts at will.
The only safe place to hold it is server-side: a Supabase Edge Function
(Deno), deployed via the Supabase CLI (already installed, v2.106.0) and
configured with `SUPABASE_SERVICE_ROLE_KEY` as a function secret.

### Data model changes

New migration `supabase/migrations/<timestamp>_user_provisioning.sql`:

- `cf_profiles` gains:
  - `email TEXT NOT NULL` — denormalized copy of the Auth email. Needed
    because `auth.users` isn't queryable by the regular authenticated
    client/RLS, and the team list needs to show emails. Source of truth is
    still `auth.users`; this column is written once at invite time by the
    Edge Function (service-role client) and never edited by end users.
  - `active BOOLEAN NOT NULL DEFAULT true` — mirrors `cf_tenants.active`.
  - One-time backfill in the same migration:
    `UPDATE cf_profiles SET email = (SELECT email FROM auth.users WHERE id = cf_profiles.id) WHERE email IS NULL` — covers `valbersantana@gmail.com` and any other pre-existing profile. Runs with migration privileges, no RLS concerns.
- **Drop** `on_auth_user_created` trigger and `cf_handle_new_user()` function.
  Tenant + profile creation now happens explicitly and exclusively inside the
  Edge Function's service-role client — no implicit behavior on `auth.users`
  inserts. (This trigger is exactly what would otherwise double-create a
  tenant when the Edge Function invites a brand new admin.)
- New helper function `cf_is_tenant_admin()` (SQL, `SECURITY DEFINER`,
  mirrors the existing `cf_is_platform_admin()` shape):
  ```sql
  CREATE OR REPLACE FUNCTION public.cf_is_tenant_admin()
  RETURNS BOOLEAN
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.cf_profiles
      WHERE id = auth.uid() AND role = 'admin'
    );
  $$;
  ```
- New RLS policies on `cf_profiles` (in addition to the existing "select
  own" / "update own"):
  - `cf_profiles: admin select in tenant` — `FOR SELECT TO authenticated`,
    `USING (tenant_id = cf_current_tenant_id() AND cf_is_tenant_admin())`.
  - `cf_profiles: admin update in tenant` — `FOR UPDATE TO authenticated`,
    `USING (tenant_id = cf_current_tenant_id() AND cf_is_tenant_admin())`,
    `WITH CHECK (tenant_id = cf_current_tenant_id())`. Client-side usage is
    restricted to toggling `active` and `role` from the new Team page; no
    other column needs to change from the client.
  - No new INSERT policy needed on `cf_tenants` or `cf_profiles` — all inserts
    for provisioning go through the Edge Function's service-role client,
    which bypasses RLS entirely.

### Edge Function: `invite-user`

Single POST endpoint (`supabase/functions/invite-user/index.ts`). Request
body:

```ts
{ full_name: string; email: string; role?: 'admin' | 'operator' } &
(
  | {}                                                          // invite into caller's own tenant
  | { organization_name: string; razao_social: string; cnpj: string } // platform admin creating a new tenant
)
```

Server-side flow:

1. Build a Supabase client from the incoming request's `Authorization` header
   (forwarded automatically by `supabase.functions.invoke()` on the client)
   using the **anon key** — this client is subject to RLS and lets us learn
   who the caller actually is without trusting anything the client claims.
2. Look up the caller: `cf_platform_admins` row present? → platform-admin
   path. Otherwise look up the caller's own `cf_profiles` row: `role ===
   'admin'`? → tenant-admin path. Otherwise → `403`.
3. **Platform-admin path** (payload must include `organization_name` /
   `razao_social` / `cnpj`): using a second client built with the
   `service_role` key, insert a new `cf_tenants` row, then invite the given
   email as `admin` of that new tenant (step 4).
4. **Tenant-admin path**: invite the given email into the caller's own
   `tenant_id`, with the requested `role` (default `operator` if omitted).
5. Common invite step (service-role client): `auth.admin.inviteUserByEmail(email, { redirectTo: `${APP_URL}/reset-password`, data: { full_name } })`, then insert the
   `cf_profiles` row (`id` = returned user id, `tenant_id`, `full_name`,
   `email`, `role`, `active: true`).
6. Error handling: if `inviteUserByEmail` reports the email already exists,
   respond `409` with a message the UI surfaces directly ("Este e-mail já
   está cadastrado."). Any other Auth/DB error → `500` with a generic
   message; specifics are logged server-side (Edge Function logs) only.

### Frontend changes

- **Remove `/register`**: delete the route in `App.tsx` and `RegisterPage.tsx`;
  add a redirect from `/register` to `/login` (catch-all already redirects
  unknown paths to `/login`, but an explicit redirect avoids a dead link if
  anything still references `/register`).
- **`PlatformAdminPage` (`/admin`)**: add a "Nova Empresa" form (organization
  name, razão social, CNPJ, admin full name, admin email) that calls
  `supabase.functions.invoke('invite-user', { body: {...} })`. On success,
  toast + refresh the tenant list (new tenant shows with 0 conversions, as
  today).
- **New page `EquipePage.tsx` at `/team`**, gated the same way
  `PlatformAdminPage` gates on `isPlatformAdmin` — here gated on
  `profile.role === 'admin'`, redirecting to `/dashboard` otherwise:
  - Lists `cf_profiles` filtered to `tenant_id = cf_current_tenant_id()`
    (name, email, role badge, active/inactive badge) — same visual language
    as the tenant list in `/admin`.
  - "Convidar" form (name, email, role radio/select) → calls the same Edge
    Function (no `organization_name`/`cnpj`/`razao_social` in the payload).
  - Per-row toggle button to deactivate/reactivate — direct
    `supabase.from('cf_profiles').update({ active: !active }).eq('id', id)`,
    permitted by the new RLS policy. Same interaction pattern as
    `PlatformAdminPage`'s tenant toggle.
- **`AppLayout` nav**: add an "Equipe" link (Users icon, already imported),
  visible only when `profile?.role === 'admin'`.
- **Operator UI gating**: hide "Novo Cliente" / edit / delete affordances in
  `ClientsPage.tsx` and the inline "+ Novo cliente" in `ConvertPage.tsx`'s
  Step 1 when `profile?.role !== 'admin'`. This is a UX nicety — the RLS
  policies (`cf_sub_tenants: admin insert/update/delete`, unchanged) already
  enforce the restriction server-side.
- **`AuthContext.loadProfileAndTenant`**: after loading `profileData`, if
  `profileData.active === false`, sign the user out immediately (extends the
  existing branch that already signs out on a missing profile row) so a
  deactivated teammate's existing session stops working on next load.
- **Password-set screen**: no changes. Supabase's invite link establishes an
  authenticated session via URL fragment exactly like the password-recovery
  link does, so `ResetPasswordPage` (reached via the same
  `redirectTo: /reset-password`) already handles it.

## Error handling

- Edge Function returns typed errors (`403` unauthorized, `409` duplicate
  email, `500` other) with a plain-text `message` the frontend shows via
  `toast.error(...)`, matching the existing error-handling style in
  `DataContext`/`ConvertPage`.
- If the Edge Function is unreachable (network/deploy issue), the invoke call
  rejects and the UI shows a generic "Erro ao enviar convite. Tente
  novamente." — same fallback style already used elsewhere (e.g.
  `ClientsPage.handleCreate`).

## Rollout risk

Supabase's built-in email sending has a low rate limit (a handful of emails
per hour) without custom SMTP configured in the dashboard
(Authentication → Settings → SMTP). Fine for onboarding the first few
companies; flagged to the user as a follow-up if bulk onboarding is needed
later. This is a dashboard setting, not a code change, so it doesn't block
this design.

## Testing plan

Same validation style used for prior features in this project: build/typecheck,
then exercise the real flow against the live Supabase project via the browser
(chrome-devtools), using disposable test accounts cleaned up afterward:

1. As the real platform admin, create a test tenant + invite its admin.
2. Accept the invite (via the emailed link or, if email delivery is slow to
   verify, by confirming the `cf_profiles`/`auth.users` rows were created
   correctly and testing the reset-password flow's session handling
   separately) and set a password.
3. As that tenant admin, invite an operator into the same tenant; confirm the
   operator cannot create/edit/delete clients (RLS-level) and doesn't see
   those buttons (UI-level) or the "Equipe" nav link.
4. Deactivate the operator as admin; confirm their session is signed out on
   next load and they can no longer log in.
5. Clean up test tenants/users afterward.
