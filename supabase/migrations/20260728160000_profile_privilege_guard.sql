-- ── Close a privilege-escalation gap in cf_profiles RLS ────────────────────
-- The original "cf_profiles: update own" policy (20260727194836_init_schema.sql)
-- let any authenticated user update *any* column on their own row, including
-- role/active/tenant_id — before this plan, that was harmless (every user was
-- the sole admin of their own freshly-minted tenant). Now those columns are
-- the entire authorization boundary for tenant-admin/operator distinction,
-- account deactivation, and tenant isolation, so a self-update must never be
-- able to touch them. Only the invite-user Edge Function (service_role,
-- auth.uid() is NULL there) or another admin acting through the separate
-- "cf_profiles: admin update in tenant" policy (which only ever targets a
-- DIFFERENT row, never their own) may change these columns.
CREATE OR REPLACE FUNCTION public.cf_guard_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id = auth.uid() AND (
       NEW.role      IS DISTINCT FROM OLD.role
    OR NEW.active    IS DISTINCT FROM OLD.active
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.email     IS DISTINCT FROM OLD.email
  ) THEN
    RAISE EXCEPTION 'cannot modify own privileges'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Only meant to run as the trigger below, not as a direct RPC call.
REVOKE EXECUTE ON FUNCTION public.cf_guard_profile_privileges() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER cf_profiles_guard_privileges
  BEFORE UPDATE ON public.cf_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cf_guard_profile_privileges();

-- ── Make tenant-scoped RLS collapse for deactivated users ──────────────────
-- cf_current_tenant_id() previously ignored cf_profiles.active, so a
-- deactivated user's still-valid access token retained full read/write on
-- their former tenant's data via every policy that calls this helper — the
-- client-side sign-out in AuthContext was the only thing stopping them.
-- Adding "AND active" makes the helper return NULL for a deactivated user,
-- so every "tenant_id = cf_current_tenant_id()" policy evaluates to false
-- for them. cf_profiles' own "select own"/"update own" policies check
-- id = auth.uid() directly (not this helper), so a deactivated user can
-- still read their own row — required for AuthContext to see active=false
-- and sign them out via the existing branch (unaffected by this change).
CREATE OR REPLACE FUNCTION public.cf_current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.cf_profiles WHERE id = auth.uid() AND active;
$$;
