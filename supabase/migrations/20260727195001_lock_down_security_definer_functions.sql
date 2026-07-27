-- Supabase security advisor flagged cf_handle_new_user() and cf_current_tenant_id()
-- as callable directly via PostgREST RPC by anon/authenticated roles, since
-- SECURITY DEFINER functions in the public schema are exposed by default.

-- cf_handle_new_user is only meant to run as the on_auth_user_created trigger.
REVOKE EXECUTE ON FUNCTION public.cf_handle_new_user() FROM PUBLIC, anon, authenticated;

-- cf_current_tenant_id is a policy helper; only authenticated users need it,
-- and only implicitly via RLS policies, not as a direct RPC call.
REVOKE EXECUTE ON FUNCTION public.cf_current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cf_current_tenant_id() TO authenticated;
