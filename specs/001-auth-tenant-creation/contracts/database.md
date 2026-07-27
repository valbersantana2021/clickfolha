# Contract: Database Schema, RLS, and Trigger

**Feature**: 001-auth-tenant-creation

This contract defines the SQL objects that must exist in Supabase before the
application can function. Apply these via the Supabase SQL Editor or migrations.

---

## Tables

```sql
-- cf_tenants: one row per BPO/accounting firm
CREATE TABLE public.cf_tenants (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  plan_id            TEXT        NOT NULL DEFAULT 'starter',
  stripe_customer_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- cf_profiles: one row per registered user; links auth.users to cf_tenants
CREATE TABLE public.cf_profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES public.cf_tenants(id),
  full_name  TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

All application tables use the `cf_` prefix. `cf_tenants` and `cf_profiles` are
part of a wider V1 schema that also includes `cf_sub_tenants`, `cf_layouts`, and
`cf_conversions_log` — see `supabase/migrations/20260727194836_init_schema.sql`
for the full schema, already applied to the `clickfolha` Supabase project.

---

## Trigger: Atomic Tenant + Profile Creation on Sign-Up

```sql
CREATE OR REPLACE FUNCTION public.cf_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  INSERT INTO public.cf_tenants (name)
  VALUES (NEW.raw_user_meta_data ->> 'organization_name')
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.cf_profiles (id, tenant_id, full_name, role)
  VALUES (
    NEW.id,
    new_tenant_id,
    NEW.raw_user_meta_data ->> 'full_name',
    'admin'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.cf_handle_new_user();
```

SECURITY DEFINER allows the function to bypass RLS for the initial INSERT.
This is the only intentional RLS bypass in the application (Constitution Principle II).
`EXECUTE` on `cf_handle_new_user()` is revoked from `PUBLIC`/`anon`/`authenticated`
so it can only run as the trigger, never as a direct RPC call.

---

## Row Level Security (RLS)

### Enable RLS

```sql
ALTER TABLE public.cf_tenants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_profiles ENABLE ROW LEVEL SECURITY;
```

A helper function `public.cf_current_tenant_id()` (STABLE, SECURITY DEFINER, granted
to `authenticated` only) wraps the `SELECT tenant_id FROM cf_profiles WHERE id =
auth.uid()` subquery so it isn't repeated across every table's policies (also used
by `cf_sub_tenants`, `cf_layouts`, `cf_conversions_log` — see
`supabase/migrations/20260727194836_init_schema.sql`).

### `cf_tenants` Policies

```sql
CREATE POLICY "cf_tenants: select own"
ON public.cf_tenants
FOR SELECT
TO authenticated
USING (id = public.cf_current_tenant_id());
-- No INSERT, UPDATE, or DELETE policies: trigger handles creation; no edits in V1.
```

### `cf_profiles` Policies

```sql
CREATE POLICY "cf_profiles: select own"
ON public.cf_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "cf_profiles: update own"
ON public.cf_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
-- No INSERT policy: trigger handles creation.
-- No DELETE policy in V1.
```

---

## Supabase Project Settings Required

- **Auth > URL Configuration > Redirect URLs**: Add the app's `/reset-password` URL
  to the allowlist (e.g., `http://localhost:5173/reset-password` for dev,
  `https://app.clickfolha.com.br/reset-password` for production).
- **Auth > Password**: Set minimum password length to 8 characters.
- **Auth > Email Templates** (optional): Customize subject and body to Portuguese
  (pt-BR) for better user experience.
