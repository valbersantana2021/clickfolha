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
