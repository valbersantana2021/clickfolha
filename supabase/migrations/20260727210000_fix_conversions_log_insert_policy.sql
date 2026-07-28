-- cf_conversions_log INSERT policy only checked tenant_id = current tenant,
-- not that sub_tenant_id/layout_id actually belong to that tenant. Foreign
-- keys only require existence, not ownership, so a client could log a
-- conversion referencing another tenant's sub_tenant_id or layout_id.

DROP POLICY "cf_conversions_log: insert in tenant" ON public.cf_conversions_log;

CREATE POLICY "cf_conversions_log: insert in tenant"
ON public.cf_conversions_log
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.cf_current_tenant_id()
  AND sub_tenant_id IN (
    SELECT id FROM public.cf_sub_tenants WHERE tenant_id = public.cf_current_tenant_id()
  )
  AND layout_id IN (
    SELECT l.id FROM public.cf_layouts l
    JOIN public.cf_sub_tenants st ON st.id = l.sub_tenant_id
    WHERE st.tenant_id = public.cf_current_tenant_id()
  )
);
