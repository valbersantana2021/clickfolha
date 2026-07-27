-- ClickFolha V1 schema: tenants, profiles, sub-tenants, layouts, conversion audit log.
-- All tables use the cf_ prefix. See CLAUDE.md section "5. Supabase Data Model".

-- ── Tables ──────────────────────────────────────────────────────────────────────

CREATE TABLE public.cf_tenants (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  plan_id            TEXT        NOT NULL DEFAULT 'starter',
  stripe_customer_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cf_profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES public.cf_tenants(id),
  full_name  TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cf_sub_tenants (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.cf_tenants(id),
  name         TEXT        NOT NULL,
  cod_empresa  TEXT        NOT NULL,
  cnpj         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cf_layouts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_tenant_id UUID        NOT NULL REFERENCES public.cf_sub_tenants(id),
  name          TEXT        NOT NULL,
  config_json   JSONB       NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cf_conversions_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.cf_tenants(id),
  sub_tenant_id  UUID        NOT NULL REFERENCES public.cf_sub_tenants(id),
  layout_id      UUID        NOT NULL REFERENCES public.cf_layouts(id),
  file_name      TEXT        NOT NULL,
  records_count  INTEGER     NOT NULL,
  total_value    NUMERIC     NOT NULL,
  status         TEXT        NOT NULL CHECK (status IN ('success', 'error')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Helper: current user's tenant_id ───────────────────────────────────────────
-- Used by RLS policies below to avoid repeating the profiles subquery.

CREATE OR REPLACE FUNCTION public.cf_current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.cf_profiles WHERE id = auth.uid();
$$;

-- ── Trigger: atomic Tenant + Profile creation on sign-up ───────────────────────

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

-- ── Row Level Security ──────────────────────────────────────────────────────────

ALTER TABLE public.cf_tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_sub_tenants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_layouts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_conversions_log ENABLE ROW LEVEL SECURITY;

-- cf_tenants: read-only own tenant; trigger handles creation, no edits in V1.
CREATE POLICY "cf_tenants: select own"
ON public.cf_tenants
FOR SELECT
TO authenticated
USING (id = public.cf_current_tenant_id());

-- cf_profiles: read/update own row only; trigger handles creation.
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

-- cf_sub_tenants: any tenant member can read; only Tenant Admins can write.
CREATE POLICY "cf_sub_tenants: select in tenant"
ON public.cf_sub_tenants
FOR SELECT
TO authenticated
USING (tenant_id = public.cf_current_tenant_id());

CREATE POLICY "cf_sub_tenants: admin insert"
ON public.cf_sub_tenants
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.cf_current_tenant_id()
  AND (SELECT role FROM public.cf_profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "cf_sub_tenants: admin update"
ON public.cf_sub_tenants
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.cf_current_tenant_id()
  AND (SELECT role FROM public.cf_profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (tenant_id = public.cf_current_tenant_id());

CREATE POLICY "cf_sub_tenants: admin delete"
ON public.cf_sub_tenants
FOR DELETE
TO authenticated
USING (
  tenant_id = public.cf_current_tenant_id()
  AND (SELECT role FROM public.cf_profiles WHERE id = auth.uid()) = 'admin'
);

-- cf_layouts: any tenant member can read/write layouts of their own sub-tenants.
CREATE POLICY "cf_layouts: select in tenant"
ON public.cf_layouts
FOR SELECT
TO authenticated
USING (
  sub_tenant_id IN (
    SELECT id FROM public.cf_sub_tenants WHERE tenant_id = public.cf_current_tenant_id()
  )
);

CREATE POLICY "cf_layouts: insert in tenant"
ON public.cf_layouts
FOR INSERT
TO authenticated
WITH CHECK (
  sub_tenant_id IN (
    SELECT id FROM public.cf_sub_tenants WHERE tenant_id = public.cf_current_tenant_id()
  )
);

CREATE POLICY "cf_layouts: update in tenant"
ON public.cf_layouts
FOR UPDATE
TO authenticated
USING (
  sub_tenant_id IN (
    SELECT id FROM public.cf_sub_tenants WHERE tenant_id = public.cf_current_tenant_id()
  )
)
WITH CHECK (
  sub_tenant_id IN (
    SELECT id FROM public.cf_sub_tenants WHERE tenant_id = public.cf_current_tenant_id()
  )
);

CREATE POLICY "cf_layouts: delete in tenant"
ON public.cf_layouts
FOR DELETE
TO authenticated
USING (
  sub_tenant_id IN (
    SELECT id FROM public.cf_sub_tenants WHERE tenant_id = public.cf_current_tenant_id()
  )
);

-- cf_conversions_log: append-only audit trail; any tenant member can read/insert,
-- nobody can update or delete (no UPDATE/DELETE policies defined).
CREATE POLICY "cf_conversions_log: select in tenant"
ON public.cf_conversions_log
FOR SELECT
TO authenticated
USING (tenant_id = public.cf_current_tenant_id());

CREATE POLICY "cf_conversions_log: insert in tenant"
ON public.cf_conversions_log
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.cf_current_tenant_id());
