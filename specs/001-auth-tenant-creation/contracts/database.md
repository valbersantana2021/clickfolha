# Contract: Database Schema, RLS, and Trigger

**Feature**: 001-auth-tenant-creation

This contract defines the SQL objects that must exist in Supabase before the
application can function. Apply these via the Supabase SQL Editor or migrations.

---

## Tables

```sql
-- tenants: one row per BPO/accounting firm
CREATE TABLE public.tenants (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  plan_id            TEXT        NOT NULL DEFAULT 'starter',
  stripe_customer_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- profiles: one row per registered user; links auth.users to tenants
CREATE TABLE public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id),
  full_name  TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Trigger: Atomic Tenant + Profile Creation on Sign-Up

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  INSERT INTO public.tenants (name)
  VALUES (NEW.raw_user_meta_data ->> 'organization_name')
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, full_name, role)
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
  EXECUTE PROCEDURE public.handle_new_user();
```

SECURITY DEFINER allows the function to bypass RLS for the initial INSERT.
This is the only intentional RLS bypass in the application (Constitution Principle II).

---

## Row Level Security (RLS)

### Enable RLS

```sql
ALTER TABLE public.tenants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

### `tenants` Policies

```sql
CREATE POLICY "tenants: select own"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id = (
    SELECT tenant_id FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  )
);
-- No INSERT, UPDATE, or DELETE policies: trigger handles creation; no edits in V1.
```

### `profiles` Policies

```sql
CREATE POLICY "profiles: select own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles: update own"
ON public.profiles
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
