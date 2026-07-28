-- Billing limit: caps monthly conversions per plan (V1 scope item 8 in
-- CLAUDE.md). No Stripe integration yet — plan_id currently only ever
-- defaults to 'starter', but this is designed to extend to future plans.

CREATE TABLE public.cf_plan_limits (
  plan_id             TEXT    PRIMARY KEY,
  monthly_conversions INTEGER NOT NULL
);

INSERT INTO public.cf_plan_limits (plan_id, monthly_conversions) VALUES ('starter', 50);

ALTER TABLE public.cf_plan_limits ENABLE ROW LEVEL SECURITY;

-- Every authenticated user can read plan limits (needed client-side to show
-- "X / limit" and to warn before processing); only managed via SQL/dashboard.
CREATE POLICY "cf_plan_limits: select all"
ON public.cf_plan_limits
FOR SELECT
TO authenticated
USING (true);

-- ── Trigger: reject conversion log inserts past the tenant's monthly limit ────
-- This is the actual enforcement point — the client-side check in ConvertPage
-- is UX only and can be bypassed by calling the REST API directly, so the
-- real limit has to live here.

CREATE OR REPLACE FUNCTION public.cf_enforce_conversion_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_plan   TEXT;
  plan_limit    INTEGER;
  current_count INTEGER;
BEGIN
  SELECT plan_id INTO tenant_plan FROM public.cf_tenants WHERE id = NEW.tenant_id;
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

CREATE TRIGGER enforce_conversion_limit
  BEFORE INSERT ON public.cf_conversions_log
  FOR EACH ROW
  EXECUTE PROCEDURE public.cf_enforce_conversion_limit();

-- Same lockdown pattern as the other SECURITY DEFINER functions: only meant
-- to run as this trigger, never as a direct RPC call.
REVOKE EXECUTE ON FUNCTION public.cf_enforce_conversion_limit() FROM PUBLIC, anon, authenticated;
