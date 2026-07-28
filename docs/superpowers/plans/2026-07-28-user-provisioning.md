# User Provisioning Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace open self-service signup with an invite-only model: the platform admin (`valbersantana@gmail.com`) creates BPO companies (tenants) and invites their first admin; that tenant admin invites additional admins/operators into their own company only.

**Architecture:** A new Supabase Edge Function (`invite-user`) holds the `service_role` key server-side and is the only thing that can create Auth users on someone else's behalf. It checks the caller's own permissions (platform admin vs. tenant admin) via a request-scoped, RLS-bound Supabase client before doing anything privileged. The frontend gains a "Nova Empresa" form on the existing admin page and a new "Equipe" page for tenant admins; `/register` is removed.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres + Auth + Edge Functions/Deno), Tailwind, `@supabase/supabase-js` v2.

**Spec:** `docs/superpowers/specs/2026-07-28-user-provisioning-design.md`

## Global Constraints

- No automated test suite exists in this repo (no vitest/jest, no `test` script in `package.json`). "Test" for every task in this plan means: `npm run build` (runs `tsc` then `vite build`) to catch type errors, plus the real end-to-end browser verification in Task 10. Do not introduce a new test framework.
- Excel/CSV content must never leave the browser (LGPD guarantee, unrelated to this feature but do not violate it while touching shared files like `DataContext.tsx`).
- All Supabase writes must go through RLS-respecting paths from the client; the only code allowed to use the `service_role` key is the Edge Function, and that key must never be added to `.env.local`, `VITE_*` vars, or any client-bundled file.
- Follow existing SQL migration conventions exactly: comment above each new object explaining *why*, `SECURITY DEFINER` helper functions get `SET search_path = public` and an explicit `REVOKE ... FROM PUBLIC, anon` + `GRANT ... TO authenticated` pair (see `supabase/migrations/20260727195001_lock_down_security_definer_functions.sql` and `20260728130000_platform_admin_and_tenant_status.sql`).
- Follow existing frontend conventions exactly: Tailwind utility classes and `fg-*` color tokens (never hardcode hex), Portuguese UI copy, `sonner` `toast.success`/`toast.error` for feedback, page components import `AppLayout`, forms use plain controlled `useState` (not `react-hook-form`) on pages that already do so (`ClientsPage.tsx`, `PlatformAdminPage.tsx`) — match the file you're editing.
- The Supabase project is `clickfolha` (ref `beqyouscptjnrdxxegiq`, region us-east-2). The Supabase CLI (v2.106.0) is already authenticated on this machine (`supabase projects list` succeeds) but this repo directory is not yet linked.
- Commit after every task. Do not push/deploy until Task 10 explicitly says to.

---

### Task 1: Link the Supabase CLI to this project

**Files:** none (CLI state only, writes `supabase/.temp/` and updates `.gitignore` if needed — `.gitignore` already covers `.env*`; confirm `supabase/.temp` gets ignored too).

**Interfaces:**
- Produces: a linked local Supabase project so later tasks can run `supabase functions deploy` / `supabase secrets set` / `supabase db push` without re-linking.

- [ ] **Step 1: Link the project**

Run:
```bash
cd "d:/Consultoria/Contabilidade/ClickFolha"
supabase link --project-ref beqyouscptjnrdxxegiq
```
If it prompts for a database password interactively and none is available in this environment, that's fine — linking still succeeds for Management API operations (functions, secrets); only `db push` (Task 2) needs the DB password, and Task 2 has a fallback that doesn't need it.

- [ ] **Step 2: Confirm the link**

Run: `supabase projects list`
Expected: the `clickfolha` row (ref `beqyouscptjnrdxxegiq`) shows `"linked":true`.

- [ ] **Step 3: Ensure CLI-generated local state is git-ignored**

Check `git status --short`. If `supabase/.temp/` or similar CLI-local files appear as untracked, add `supabase/.temp` to `.gitignore` (append the line; do not remove existing entries). If nothing appeared, skip this step.

- [ ] **Step 4: Commit (only if `.gitignore` changed)**

```bash
git add .gitignore
git commit -m "chore: ignore Supabase CLI local link state"
```

---

### Task 2: Database migration — profiles columns, drop signup trigger, tenant-admin RLS

**Files:**
- Create: `supabase/migrations/20260728150000_user_provisioning.sql`

**Interfaces:**
- Produces: `cf_profiles.email TEXT NOT NULL`, `cf_profiles.active BOOLEAN NOT NULL DEFAULT true`, SQL function `public.cf_is_tenant_admin() RETURNS BOOLEAN`, RLS policies `cf_profiles: admin select in tenant` and `cf_profiles: admin update in tenant`. Removes trigger `on_auth_user_created` and function `public.cf_handle_new_user()`.
- Consumes: existing `public.cf_current_tenant_id()` helper (from `20260727194836_init_schema.sql`).

- [ ] **Step 1: Write the migration file**

```sql
-- ── User provisioning: invite-only signup ─────────────────────────────────
-- Self-service /register is going away. From now on, tenant + profile
-- creation happens exclusively inside the invite-user Edge Function (using
-- the service-role key), so the old on-signup trigger would otherwise
-- double-create a tenant whenever the function invites a brand new admin.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.cf_handle_new_user();

-- cf_profiles.email: denormalized copy of the Auth email. auth.users isn't
-- queryable by the regular authenticated client/RLS, and the team list
-- (EquipePage) needs to show each teammate's email. Written once by the
-- invite-user Edge Function at invite time; end users never edit it.
ALTER TABLE public.cf_profiles ADD COLUMN email TEXT;

-- One-time backfill for profiles created before this column existed
-- (e.g. valbersantana@gmail.com's own profile).
UPDATE public.cf_profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

ALTER TABLE public.cf_profiles ALTER COLUMN email SET NOT NULL;

-- cf_profiles.active: mirrors cf_tenants.active. Lets a tenant admin
-- deactivate a teammate (e.g. someone who left) without deleting their
-- account or losing their history.
ALTER TABLE public.cf_profiles ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

-- cf_is_tenant_admin: policy helper analogous to cf_is_platform_admin().
-- Used both by the new cf_profiles RLS policies below and by the
-- invite-user Edge Function to check whether the caller may invite
-- teammates into their own tenant.
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

REVOKE EXECUTE ON FUNCTION public.cf_is_tenant_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cf_is_tenant_admin() TO authenticated;

-- cf_profiles previously only allowed "select own" / "update own" (a user
-- could only see/edit their own row). Tenant admins now also need to list
-- and manage (activate/deactivate, change role of) everyone in their own
-- tenant, for the Equipe page.
CREATE POLICY "cf_profiles: admin select in tenant"
ON public.cf_profiles
FOR SELECT
TO authenticated
USING (tenant_id = public.cf_current_tenant_id() AND public.cf_is_tenant_admin());

CREATE POLICY "cf_profiles: admin update in tenant"
ON public.cf_profiles
FOR UPDATE
TO authenticated
USING (tenant_id = public.cf_current_tenant_id() AND public.cf_is_tenant_admin())
WITH CHECK (tenant_id = public.cf_current_tenant_id());
```

- [ ] **Step 2: Apply the migration — try the CLI first**

Run:
```bash
cd "d:/Consultoria/Contabilidade/ClickFolha"
supabase db push
```
If this succeeds (no password prompt, or you have the DB password), skip Step 3.

- [ ] **Step 3: Fallback — apply via the Supabase SQL Editor if the CLI needs a DB password you don't have**

Using the chrome-devtools browser tools already available in this environment, open `https://supabase.com/dashboard/project/beqyouscptjnrdxxegiq/sql/new`, paste the full contents of the migration file from Step 1 into the editor, and run it. This is the same approach used successfully for prior migrations in this project (see project memory: "Testado via SQL direto").

- [ ] **Step 4: Verify**

In the same SQL editor (or via `psql`/CLI if linked with a password), run:
```sql
SELECT id, email, active, role FROM public.cf_profiles;
```
Expected: every existing row has a non-null `email` matching its `auth.users` row, and `active = true`. Also confirm the trigger is gone:
```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```
Expected: zero rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260728150000_user_provisioning.sql
git commit -m "feat: add cf_profiles.email/active, drop signup trigger, add tenant-admin RLS"
```

---

### Task 3: `invite-user` Edge Function

**Files:**
- Create: `supabase/functions/invite-user/index.ts`

**Interfaces:**
- Produces: `POST /functions/v1/invite-user`, request body `{ full_name: string; email: string; role?: 'admin' | 'operator'; organization_name?: string; razao_social?: string; cnpj?: string }`, response `200 { ok: true; tenant_id: string }` or error `{ message: string }` with status `400 | 401 | 403 | 409 | 500`.
- Consumes: Supabase built-in Edge Function env vars `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injected, no manual secret needed), plus a manually-set `APP_URL` secret.

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/invite-user/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitePayload {
  full_name: string
  email: string
  role?: 'admin' | 'operator'
  organization_name?: string
  razao_social?: string
  cnpj?: string
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ message: 'Missing authorization header.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const appUrl = Deno.env.get('APP_URL')!

    // Caller-scoped client: subject to RLS, tells us who is really calling —
    // never trust a role/tenant the client claims in the request body.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    if (userError || !user) return json({ message: 'Invalid session.' }, 401)

    const payload = (await req.json()) as InvitePayload
    const fullName = payload.full_name?.trim()
    const email = payload.email?.trim()
    if (!fullName || !email) return json({ message: 'Nome e e-mail são obrigatórios.' }, 400)

    // Privileged client: bypasses RLS. Only used after the permission checks below.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: platformAdminRow } = await callerClient
      .from('cf_platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let tenantId: string
    let role: 'admin' | 'operator'

    if (platformAdminRow) {
      const organizationName = payload.organization_name?.trim()
      const razaoSocial = payload.razao_social?.trim()
      const cnpj = payload.cnpj?.trim()
      if (!organizationName || !razaoSocial || !cnpj) {
        return json({ message: 'Nome, razão social e CNPJ da empresa são obrigatórios.' }, 400)
      }
      const { data: newTenant, error: tenantError } = await adminClient
        .from('cf_tenants')
        .insert({ name: organizationName, razao_social: razaoSocial, cnpj })
        .select('id')
        .single()
      if (tenantError || !newTenant) return json({ message: 'Erro ao criar a empresa.' }, 500)
      tenantId = newTenant.id
      role = 'admin' // first user of a brand new tenant is always its admin
    } else {
      const { data: callerProfile } = await callerClient
        .from('cf_profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single()
      if (!callerProfile || callerProfile.role !== 'admin') {
        return json({ message: 'Sem permissão para convidar usuários.' }, 403)
      }
      tenantId = callerProfile.tenant_id
      role = payload.role === 'admin' ? 'admin' : 'operator'
    }

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${appUrl}/reset-password`, data: { full_name: fullName } },
    )

    if (inviteError || !invited?.user) {
      const alreadyExists = (inviteError?.message ?? '').toLowerCase().includes('already')
      return json(
        { message: alreadyExists ? 'Este e-mail já está cadastrado.' : 'Erro ao enviar convite.' },
        alreadyExists ? 409 : 500,
      )
    }

    const { error: profileError } = await adminClient.from('cf_profiles').insert({
      id: invited.user.id,
      tenant_id: tenantId,
      full_name: fullName,
      email,
      role,
      active: true,
    })

    if (profileError) {
      return json({ message: 'Convite enviado, mas houve erro ao vincular o perfil.' }, 500)
    }

    return json({ ok: true, tenant_id: tenantId }, 200)
  } catch {
    return json({ message: 'Erro inesperado ao processar o convite.' }, 500)
  }
})
```

- [ ] **Step 2: Set the `APP_URL` secret**

Run:
```bash
supabase secrets set APP_URL=https://clickfolha.vercel.app
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` do not need to be set manually — Supabase injects them into every Edge Function automatically.

- [ ] **Step 3: Deploy the function**

Run:
```bash
supabase functions deploy invite-user
```
Expected: CLI reports a successful deploy and prints the function URL.

- [ ] **Step 4: Smoke-test unauthorized access**

Run:
```bash
curl -s -X POST "https://beqyouscptjnrdxxegiq.supabase.co/functions/v1/invite-user" \
  -H "Content-Type: application/json" -d '{}'
```
Expected: HTTP 401 with `{"message":"Missing authorization header."}` (no crash, no 500). Full end-to-end testing (real invite as platform admin / tenant admin) happens in Task 10 once the frontend can call this authenticated.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/invite-user/index.ts
git commit -m "feat: add invite-user Edge Function for platform/tenant-admin invites"
```

---

### Task 4: Update types and AuthContext (profile shape, remove signUp, deactivate-on-login-check)

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/contexts/AuthContext.tsx`

**Interfaces:**
- Produces: `Profile` type gains `email: string` and `active: boolean`. `AuthContextValue` no longer has `signUp`.
- Consumes: nothing new.

- [ ] **Step 1: Update the `Profile` type**

In `src/types/database.ts`, replace:
```ts
export interface Profile {
  id: string
  tenant_id: string
  full_name: string
  role: 'admin' | 'operator'
  created_at: string
}
```
with:
```ts
export interface Profile {
  id: string
  tenant_id: string
  full_name: string
  email: string
  role: 'admin' | 'operator'
  active: boolean
  created_at: string
}
```

- [ ] **Step 2: Remove `signUp` from `AuthContext.tsx`**

Remove the `signUp` entry from the `AuthContextValue` interface (the line starting `signUp: (params: ...`), remove the `signUp` callback implementation (the `const signUp = useCallback(...)` block), and remove `signUp` from the value passed to `AuthContext.Provider`.

- [ ] **Step 3: Sign out immediately if the profile is deactivated**

In `loadProfileAndTenant`, the existing code is:
```ts
    if (!profileData) {
      // ... comment ...
      setProfile(null)
      setTenant(null)
      setIsPlatformAdmin(false)
      await supabase.auth.signOut()
      return
    }
    setProfile(profileData)
```
Change it to:
```ts
    if (!profileData) {
      // ... comment ... (unchanged)
      setProfile(null)
      setTenant(null)
      setIsPlatformAdmin(false)
      await supabase.auth.signOut()
      return
    }
    if (!profileData.active) {
      // A tenant admin deactivated this user (see EquipePage) — an existing
      // session must stop working on its next load, not just new logins.
      setProfile(null)
      setTenant(null)
      setIsPlatformAdmin(false)
      await supabase.auth.signOut()
      return
    }
    setProfile(profileData)
```

- [ ] **Step 4: Verify types compile**

Run: `npm run build`
Expected: fails only on `src/pages/RegisterPage.tsx` (which calls the now-removed `signUp`) — that failure is expected here and gets fixed in Task 5. If there are any *other* errors, fix them before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/contexts/AuthContext.tsx
git commit -m "feat: add email/active to Profile, remove signUp, sign out deactivated users"
```

---

### Task 5: Close public registration

**Files:**
- Delete: `src/pages/RegisterPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `Navigate` from `react-router-dom` (already used elsewhere in `App.tsx`).

- [ ] **Step 1: Delete the register page**

```bash
git rm src/pages/RegisterPage.tsx
```

- [ ] **Step 2: Update routing in `App.tsx`**

Remove the line `import { RegisterPage } from '@/pages/RegisterPage'`.

Replace:
```tsx
            <Route path="/register" element={<RegisterPage />} />
```
with:
```tsx
            <Route path="/register" element={<Navigate to="/login" replace />} />
```
(`Navigate` is already imported in this file.)

- [ ] **Step 3: Remove the "Criar conta" link from `LoginPage.tsx`**

Remove this block entirely:
```tsx
      <p className="mt-6 text-center text-sm text-fg-muted">
        Nao tem conta?{' '}
        <Link to="/register" className="font-semibold text-fg-ice transition hover:text-fg-cream">
          Criar conta
        </Link>
      </p>
```
After removing it, check whether `Link` is still used elsewhere in `LoginPage.tsx` (it is — the "Esqueceu?" link to `/forgot-password`), so keep the `Link` import.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: close public registration, /register redirects to /login"
```

---

### Task 6: Invite helper + DataContext team-member state

**Files:**
- Create: `src/lib/invite.ts`
- Modify: `src/contexts/DataContext.tsx`

**Interfaces:**
- Produces: `inviteUser(payload: InviteUserPayload): Promise<{ tenant_id: string }>` (throws `Error` with a user-facing message on failure). `DataContextValue` gains `teamMembers: Profile[]`, `inviteTeamMember(data: { full_name: string; email: string; role: 'admin' | 'operator' }): Promise<void>`, `updateTeamMemberActive(id: string, active: boolean): Promise<void>`.
- Consumes: `supabase` client from `@/lib/supabase`, `Profile` type from `@/types/database`.

- [ ] **Step 1: Write `src/lib/invite.ts`**

```ts
import { supabase } from '@/lib/supabase'

export interface InviteUserPayload {
  full_name: string
  email: string
  role?: 'admin' | 'operator'
  organization_name?: string
  razao_social?: string
  cnpj?: string
}

export async function inviteUser(payload: InviteUserPayload): Promise<{ tenant_id: string }> {
  const { data, error } = await supabase.functions.invoke('invite-user', { body: payload })
  if (error) {
    let message = 'Erro ao enviar convite. Tente novamente.'
    const context = (error as { context?: Response }).context
    if (context instanceof Response) {
      try {
        const body = await context.json()
        if (body?.message) message = body.message
      } catch { /* keep default message */ }
    }
    throw new Error(message)
  }
  return data as { tenant_id: string }
}
```

- [ ] **Step 2: Add `teamMembers` to `DataContext.tsx`**

Add the import: `import { inviteUser } from '@/lib/invite'` (alongside the existing imports at the top).

Update the existing type import to include `Profile`. Change:
```ts
import type { SubTenant, Layout, LayoutConfig, ConversionLog } from '@/types/database'
```
to:
```ts
import type { SubTenant, Layout, LayoutConfig, ConversionLog, Profile } from '@/types/database'
```

Add `teamMembers: Profile[]` to the `DataContextValue` interface, next to `subTenants`:
```ts
  subTenants: SubTenant[]
  createSubTenant: (data: { name: string; cod_empresa: string; cnpj?: string }) => Promise<SubTenant>
  updateSubTenant: (id: string, data: { name: string; cod_empresa: string; cnpj?: string }) => Promise<void>
  deleteSubTenant: (id: string) => Promise<void>

  teamMembers: Profile[]
  inviteTeamMember: (data: { full_name: string; email: string; role: 'admin' | 'operator' }) => Promise<void>
  updateTeamMemberActive: (id: string, active: boolean) => Promise<void>
```

Add the state: `const [teamMembers, setTeamMembers] = useState<Profile[]>([])`, next to the other `useState` declarations.

In the main loading `useEffect`, add a fourth query alongside the existing three (`cf_sub_tenants`, `cf_layouts`, `cf_conversions_log`) — extend the `Promise.all` array and destructuring:
```ts
      const [{ data: st }, { data: lay }, { data: logs }, { data: limitRow }, { data: team }] = await Promise.all([
        supabase.from('cf_sub_tenants').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
        supabase.from('cf_layouts').select('*'),
        supabase.from('cf_conversions_log').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
        supabase.from('cf_plan_limits').select('monthly_conversions').eq('plan_id', tenant.plan_id).maybeSingle(),
        supabase.from('cf_profiles').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: true }),
      ])
```
And add `setTeamMembers(team ?? [])` alongside the other `set*` calls in that block. Also add `setTeamMembers([])` to the early-return branch at the top of the effect (the `if (!tenant) { ... }` block), next to the other resets.

Add the two new callbacks, next to `deleteSubTenant` (same section, after the sub-tenant callbacks):
```ts
  // ── Team members ─────────────────────────────────────────────────────────────

  const refreshTeamMembers = useCallback(async () => {
    if (!tenant) return
    const { data } = await supabase
      .from('cf_profiles')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true })
    setTeamMembers(data ?? [])
  }, [tenant])

  const inviteTeamMember = useCallback(async ({ full_name, email, role }: { full_name: string; email: string; role: 'admin' | 'operator' }) => {
    await inviteUser({ full_name, email, role })
    await refreshTeamMembers()
  }, [refreshTeamMembers])

  const updateTeamMemberActive = useCallback(async (id: string, active: boolean) => {
    const { data, error } = await supabase
      .from('cf_profiles')
      .update({ active })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setTeamMembers(prev => prev.map(m => m.id === id ? data : m))
  }, [])
```

Add `teamMembers, inviteTeamMember, updateTeamMemberActive,` to the value object passed to `DataContext.Provider`.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/invite.ts src/contexts/DataContext.tsx
git commit -m "feat: add invite-user client helper and team-member state to DataContext"
```

---

### Task 7: Equipe page, route, and nav link

**Files:**
- Create: `src/pages/EquipePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`profile`), `useData()` (`teamMembers`, `inviteTeamMember`, `updateTeamMemberActive`) from Task 6.

- [ ] **Step 1: Write `src/pages/EquipePage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { UserCog, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const ROLE_LABEL: Record<'admin' | 'operator', string> = { admin: 'Admin', operator: 'Operador' }

export function EquipePage() {
  const { profile, loading: authLoading } = useAuth()
  const { teamMembers, inviteTeamMember, updateTeamMemberActive } = useData()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'operator'>('operator')
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { document.title = 'Equipe | ClickFolha' }, [])

  if (!authLoading && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  const resetForm = () => { setName(''); setEmail(''); setRole('operator') }

  const handleInvite = async () => {
    const fullName = name.trim()
    const mail = email.trim()
    if (!fullName || !mail) return
    setSaving(true)
    try {
      await inviteTeamMember({ full_name: fullName, email: mail, role })
      toast.success(`Convite enviado para ${mail}.`)
      resetForm()
      setShowForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar convite.')
    }
    setSaving(false)
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    setPendingId(id)
    try {
      await updateTeamMemberActive(id, !active)
      toast.success(active ? 'Usuário desativado.' : 'Usuário reativado.')
    } catch {
      toast.error('Erro ao atualizar o usuário.')
    }
    setPendingId(null)
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-fg-brand" />
          <div>
            <h1 className="font-display text-xl font-semibold text-fg-cream">Equipe</h1>
            <p className="mt-0.5 text-sm text-fg-muted">
              Usuários da sua empresa. Só administradores gerenciam clientes e convidam pessoas.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2"
        >
          <Plus className="h-4 w-4" />
          Convidar
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-fg-cream">Convidar usuário</p>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">Nome completo *</label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Maria Silva"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">E-mail *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="pessoa@empresa.com.br"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">Cargo</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'admin' | 'operator')}
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              >
                <option value="operator">Operador</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="rounded-lg border px-4 py-2 text-sm text-fg-muted transition hover:bg-fg-ink-3"
            >
              Cancelar
            </button>
            <button
              onClick={handleInvite}
              disabled={!name.trim() || !email.trim() || saving}
              className="rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2 disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar convite'}
            </button>
          </div>
        </div>
      )}

      {teamMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white py-16 text-center">
          <UserCog className="mb-3 h-10 w-10 text-fg-hairline" />
          <p className="font-medium text-fg-cream">Nenhum usuário ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teamMembers.map(member => (
            <div key={member.id} className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-fg-cream">{member.full_name}</p>
                  <span className="rounded bg-fg-ink-3 px-1.5 py-0.5 text-xs font-medium text-fg-muted">
                    {ROLE_LABEL[member.role]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${member.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {member.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                  <span>{member.email}</span>
                  <span>Desde {formatDateTime(member.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => handleToggleActive(member.id, member.active)}
                disabled={pendingId === member.id}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
                  member.active ? 'bg-red-500 hover:bg-red-600' : 'bg-fg-brand hover:bg-fg-brand-2'
                }`}
              >
                {pendingId === member.id ? 'Salvando...' : member.active ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
```

- [ ] **Step 2: Add the route in `App.tsx`**

Add the import: `import { EquipePage } from '@/pages/EquipePage'` (next to the other page imports).

Add the route next to `/clients`:
```tsx
            <Route path="/team" element={<ProtectedApp><EquipePage /></ProtectedApp>} />
```

- [ ] **Step 3: Add the nav link in `AppLayout.tsx`**

Add `UserCog` to the `lucide-react` import list (alongside `FileSpreadsheet, LogOut, History, Users, LayoutDashboard, ArrowRightLeft, ShieldCheck`).

Change `const { profile, isPlatformAdmin, signOut } = useAuth()` — it already destructures `profile`, no change needed there.

Add, right after the closing of the `navItems.map(...)` block and before the `isPlatformAdmin &&` block:
```tsx
              {profile?.role === 'admin' && (
                <NavLink
                  to="/team"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-fg-ink-3 text-fg-cream'
                        : 'text-fg-muted hover:bg-fg-ink-3 hover:text-fg-cream'
                    }`
                  }
                >
                  <UserCog className="h-3.5 w-3.5" />
                  Equipe
                </NavLink>
              )}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/EquipePage.tsx src/App.tsx src/components/AppLayout.tsx
git commit -m "feat: add Equipe page for tenant admins to invite/manage teammates"
```

---

### Task 8: "Nova Empresa" form on the Platform Admin page

**Files:**
- Modify: `src/pages/PlatformAdminPage.tsx`

**Interfaces:**
- Consumes: `inviteUser` from `@/lib/invite` (Task 6), `formatCNPJ` from `@/lib/utils` (already used in `ClientsPage.tsx`).

- [ ] **Step 1: Add imports**

Add to the top of `PlatformAdminPage.tsx`:
```ts
import { inviteUser } from '@/lib/invite'
import { formatCNPJ } from '@/lib/utils'
```
Add `Plus` to the existing `lucide-react` import (`ShieldCheck, Building2, Loader2` → `ShieldCheck, Building2, Loader2, Plus`).

- [ ] **Step 2: Add form state and handler**

Inside `PlatformAdminPage()`, after the existing `pendingId` state, add:
```ts
  const [showForm, setShowForm] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [creating, setCreating] = useState(false)

  const resetForm = () => {
    setOrgName(''); setRazaoSocial(''); setCnpj(''); setAdminName(''); setAdminEmail('')
  }

  const handleCreateTenant = async () => {
    const name = orgName.trim()
    const razao = razaoSocial.trim()
    const doc = cnpj.trim()
    const fullName = adminName.trim()
    const email = adminEmail.trim()
    if (!name || !razao || !doc || !fullName || !email) return
    setCreating(true)
    try {
      await inviteUser({ organization_name: name, razao_social: razao, cnpj: doc, full_name: fullName, email })
      toast.success(`Empresa "${name}" criada e convite enviado para ${email}.`)
      resetForm()
      setShowForm(false)
      await loadTenants()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar empresa.')
    }
    setCreating(false)
  }
```

- [ ] **Step 3: Add the "Nova Empresa" button and form to the JSX**

Change the header block from:
```tsx
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-fg-brand" />
        <div>
          <h1 className="font-display text-xl font-semibold text-fg-cream">Admin da Plataforma</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            Ative ou inative empresas (ex.: pendência de pagamento). Conversões ficam bloqueadas enquanto a empresa estiver inativa.
          </p>
        </div>
      </div>
```
to:
```tsx
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-fg-brand" />
          <div>
            <h1 className="font-display text-xl font-semibold text-fg-cream">Admin da Plataforma</h1>
            <p className="mt-0.5 text-sm text-fg-muted">
              Ative ou inative empresas (ex.: pendência de pagamento). Conversões ficam bloqueadas enquanto a empresa estiver inativa.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2"
        >
          <Plus className="h-4 w-4" />
          Nova Empresa
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-fg-cream">Nova empresa</p>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">Nome (fantasia) *</label>
              <input
                autoFocus
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Contabilidade Exemplo Ltda"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">Razão social *</label>
              <input
                value={razaoSocial}
                onChange={e => setRazaoSocial(e.target.value)}
                placeholder="Contabilidade Exemplo Ltda ME"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">CNPJ *</label>
              <input
                value={cnpj}
                onChange={e => setCnpj(formatCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">Nome do admin *</label>
              <input
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                placeholder="Maria Silva"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">E-mail do admin *</label>
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="admin@empresa.com.br"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="rounded-lg border px-4 py-2 text-sm text-fg-muted transition hover:bg-fg-ink-3"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateTenant}
              disabled={!orgName.trim() || !razaoSocial.trim() || !cnpj.trim() || !adminName.trim() || !adminEmail.trim() || creating}
              className="rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2 disabled:opacity-50"
            >
              {creating ? 'Criando...' : 'Criar e convidar admin'}
            </button>
          </div>
        </div>
      )}
```
(Keep the rest of the existing JSX — the loading/empty/list states — unchanged below this.)

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PlatformAdminPage.tsx
git commit -m "feat: platform admin can create a new tenant and invite its first admin"
```

---

### Task 9: Role-gate client management for operators

**Files:**
- Modify: `src/pages/ClientsPage.tsx`
- Modify: `src/pages/ConvertPage.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`profile`) — RLS (`cf_sub_tenants: admin insert/update/delete`, unchanged, already in `20260727194836_init_schema.sql`) is the real enforcement; this task only hides the corresponding buttons for a clean UX.

- [ ] **Step 1: Gate `ClientsPage.tsx`**

Add the import: `import { useAuth } from '@/contexts/AuthContext'`.

Inside `ClientsPage()`, add: `const { profile } = useAuth()`.

Wrap the "Novo Cliente" header button:
```tsx
        {profile?.role === 'admin' && (
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2"
          >
            <Plus className="h-4 w-4" />
            Novo Cliente
          </button>
        )}
```

Wrap the empty-state "Adicionar cliente" button the same way:
```tsx
          {profile?.role === 'admin' && (
            <button
              onClick={openCreateForm}
              className="mt-4 flex items-center gap-2 rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar cliente
            </button>
          )}
```

Wrap the per-row edit and delete controls. The existing block is:
```tsx
                <div className="flex items-center gap-2">
                  <Link to={`/convert?client=${client.id}`} ...>
                    ...Converter
                  </Link>
                  <Link to={`/convert?client=${client.id}&step=layout`} ...>
                    ...Layouts...
                  </Link>

                  <button onClick={() => openEditForm(client)} ...>
                    <Pencil className="h-4 w-4" />
                  </button>

                  {confirmDelete === client.id ? (
                    ... Confirmar / Cancelar ...
                  ) : (
                    <button onClick={() => setConfirmDelete(client.id)} ...>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
```
Keep the two `Link`s (Converter / Layouts — operators still need those) unwrapped. Wrap only the edit button and the delete button/confirm block in `{profile?.role === 'admin' && (...)}`, e.g.:
```tsx
                  {profile?.role === 'admin' && (
                    <button
                      onClick={() => openEditForm(client)}
                      className="rounded-lg p-1.5 text-fg-muted transition hover:bg-fg-ink-3 hover:text-fg-cream"
                      title="Editar cliente"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}

                  {profile?.role === 'admin' && (
                    confirmDelete === client.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(client.id)} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600">
                          Confirmar
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="rounded-lg border px-3 py-1.5 text-xs text-fg-muted transition hover:bg-fg-ink-3">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(client.id)} className="rounded-lg p-1.5 text-fg-muted transition hover:bg-red-50 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  )}
```

- [ ] **Step 2: Gate `ConvertPage.tsx`**

`ConvertPage` already calls `const { tenant } = useAuth()` — change it to also destructure `profile`: `const { tenant, profile } = useAuth()`.

Wrap the "Novo cliente" toggle button (inside the `!showNewClient` branch):
```tsx
                <select ...>...</select>
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => setShowNewClient(true)}
                    className="mt-3 flex items-center gap-1.5 text-sm text-fg-ice hover:text-fg-brand"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo cliente
                  </button>
                )}
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ClientsPage.tsx src/pages/ConvertPage.tsx
git commit -m "feat: hide client management controls from operators"
```

---

### Task 10: End-to-end verification, push, and deploy

**Files:** none (verification only).

**Interfaces:** none — this task exercises everything built in Tasks 1–9 together.

- [ ] **Step 1: Local build check**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 2: Start the dev server**

Run in the background: `npm run dev` (Vite on `http://localhost:5173`).

- [ ] **Step 3: Verify `/register` is gone**

Using chrome-devtools, navigate to `http://localhost:5173/register`.
Expected: redirected to `/login`, no "Criar conta" link visible on the login page.

- [ ] **Step 4: Platform admin creates a test tenant**

Log in as `valbersantana@gmail.com` (the known platform admin). Navigate to `/admin`, click "Nova Empresa", fill in a disposable test company (e.g. name "Teste Provisionamento", razão social "Teste Provisionamento LTDA", CNPJ `98.765.432/0001-10`) and a disposable admin email you control (e.g. a `+alias` on an inbox you can check, or reuse the pattern from the earlier CRUD test: `teste.provisionamento.clickfolha@example.com` if email delivery isn't verifiable in this environment — see Step 5 fallback).
Expected: success toast, new tenant appears in the `/admin` list.

- [ ] **Step 5: Verify the invited admin's rows exist (fallback if email isn't checkable here)**

Via the Supabase SQL Editor (same approach as Task 2 Step 3):
```sql
SELECT p.email, p.role, p.active, t.name
FROM public.cf_profiles p
JOIN public.cf_tenants t ON t.id = p.tenant_id
WHERE p.email = 'teste.provisionamento.clickfolha@example.com';
```
Expected: one row, `role = 'admin'`, `active = true`, `name = 'Teste Provisionamento'`.

- [ ] **Step 6: Tenant admin invites an operator, verify role gating**

If email delivery can be verified end-to-end (invite link clicked, password set via `/reset-password`), log in as the new tenant admin, go to `/team`, invite an operator with a second disposable email, and confirm:
- The operator appears in the list as "Operador" / "Ativo".
- Logged in as that operator (after accepting their own invite), `/clients` shows no "Novo Cliente" button, no edit/delete icons, and the nav bar has no "Equipe" link.
- Attempting `POST` directly to `cf_sub_tenants` as the operator (optional, via browser console using the already-authenticated `supabase` client) is rejected by RLS — this is expected to already work since the policy predates this feature; skip if time-constrained, since Task 9 relies on an existing, previously-shipped policy.

If email delivery cannot be verified in this environment, skip live login as the invited users and instead verify via SQL that `cf_profiles` rows were created correctly with the right `tenant_id`/`role`/`active`, and separately confirm the deactivate-on-login logic (Step 7) using the existing `valbersantana@gmail.com` session by temporarily setting `active = false` on a disposable test profile (not on the real admin account) and reloading.

- [ ] **Step 7: Verify deactivation signs a user out**

Pick the disposable test operator/admin profile created above. As the tenant admin, click "Desativar" on `/team`. Then, via SQL Editor, confirm `active = false` on that row. If that user has an active browser session in this environment, reload their page and confirm they're bounced to `/login`. If not directly testable live, this is already covered by the code review of `AuthContext.loadProfileAndTenant` in Task 4 — note in your final report that live verification was skipped and why.

- [ ] **Step 8: Clean up test data**

Delete the disposable test tenant(s)/profile(s)/auth users created during this verification, the same way prior sessions in this project cleaned up test data (via SQL Editor `DELETE FROM public.cf_profiles WHERE email = '...'`, `DELETE FROM public.cf_tenants WHERE name = 'Teste Provisionamento'`, and `DELETE FROM auth.users WHERE email = '...'` — note `cf_profiles` rows must be deleted before the corresponding `auth.users` row, or deleted via `ON DELETE CASCADE` if that's how the FK is defined; check `supabase/migrations/20260727194836_init_schema.sql` for the FK definition on `cf_profiles.id` before deciding whether an explicit `cf_profiles` delete is needed first).

- [ ] **Step 9: Stop the dev server**

Same approach as prior sessions: find the PID listening on port 5173 and kill it (`netstat -ano | grep ':5173' | grep LISTENING`, then `taskkill //F //PID <pid>` on Windows).

- [ ] **Step 10: Push and deploy**

Ask the user for explicit confirmation before pushing/deploying (per this project's established pattern in this conversation — every prior push/deploy in this session was confirmed first). Once confirmed:
```bash
git push origin main
vercel deploy --prod
```

- [ ] **Step 11: Final production smoke check**

Using chrome-devtools, open `https://clickfolha.vercel.app/login`, confirm no "Criar conta" link, and confirm `https://clickfolha.vercel.app/register` redirects to `/login`. Check console for errors (`list_console_messages`).
