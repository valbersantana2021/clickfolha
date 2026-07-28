-- Platform admin: a SaaS-level role (distinct from a tenant's own 'admin'
-- profile) that can activate/deactivate any tenant, e.g. while a monthly
-- payment is overdue. Membership is granted manually (insert a row into
-- cf_platform_admins) — there is no self-service signup for this role.

ALTER TABLE public.cf_tenants ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE public.cf_platform_admins (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cf_platform_admins ENABLE ROW LEVEL SECURITY;

-- Each user can only see whether *they themselves* are a platform admin
-- (used client-side to show/hide the admin panel). No INSERT/UPDATE/DELETE
-- policy — membership is only ever granted via SQL/dashboard.
CREATE POLICY "cf_platform_admins: select own"
ON public.cf_platform_admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.cf_is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.cf_platform_admins WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.cf_is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cf_is_platform_admin() TO authenticated;

-- cf_tenants had no INSERT/UPDATE policy at all (trigger-only creation, "no
-- edits in V1" per the original schema comment). Platform admins can now see
-- and flip `active` on any tenant; regular tenant members still only see
-- their own tenant (existing "select own" policy) and still can't write to
-- cf_tenants at all.

CREATE POLICY "cf_tenants: platform admin select all"
ON public.cf_tenants
FOR SELECT
TO authenticated
USING (public.cf_is_platform_admin());

CREATE POLICY "cf_tenants: platform admin update"
ON public.cf_tenants
FOR UPDATE
TO authenticated
USING (public.cf_is_platform_admin())
WITH CHECK (public.cf_is_platform_admin());

-- ── Extend the conversion-limit trigger to also block inactive tenants ────────
-- Distinct error code (P0002) so the client can tell "tenant deactivated"
-- apart from "monthly limit reached" (P0001) and show the right message.

CREATE OR REPLACE FUNCTION public.cf_enforce_conversion_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_plan   TEXT;
  tenant_active BOOLEAN;
  plan_limit    INTEGER;
  current_count INTEGER;
BEGIN
  SELECT plan_id, active INTO tenant_plan, tenant_active FROM public.cf_tenants WHERE id = NEW.tenant_id;

  IF tenant_active IS FALSE THEN
    RAISE EXCEPTION 'tenant_inactive'
      USING ERRCODE = 'P0002',
            DETAIL = format('Tenant %s is deactivated', NEW.tenant_id);
  END IF;

  SELECT monthly_conversions INTO plan_limit FROM public.cf_plan_limits WHERE plan_id = tenant_plan;

  IF plan_limit IS NOT NULL THEN
    SELECT count(*) INTO current_count
    FROM public.cf_conversions_log
    WHERE tenant_id = NEW.tenant_id
      AND date_trunc('month', created_at) = date_trunc('month', now());

    IF current_count >= plan_limit THEN
      RAISE EXCEPTION 'monthly_conversion_limit_reached'
        USING ERRCODE = 'P0001',
              DETAIL = format('Tenant %s has reached its %s-plan limit of %s conversions this month', NEW.tenant_id, tenant_plan, plan_limit);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
