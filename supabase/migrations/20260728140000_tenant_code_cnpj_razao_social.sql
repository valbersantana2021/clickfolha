-- Tenant registration now collects legal company info: CNPJ, razão social
-- (legal name — `name` remains the display/trade name shown across the UI),
-- and a system-assigned sequential code.

CREATE SEQUENCE public.cf_tenants_code_seq START 1;

ALTER TABLE public.cf_tenants
  ADD COLUMN code         INTEGER NOT NULL DEFAULT nextval('public.cf_tenants_code_seq'),
  ADD COLUMN cnpj         TEXT,
  ADD COLUMN razao_social TEXT;

ALTER SEQUENCE public.cf_tenants_code_seq OWNED BY public.cf_tenants.code;
ALTER TABLE public.cf_tenants ADD CONSTRAINT cf_tenants_code_key UNIQUE (code);

-- Backfill the one pre-existing tenant (created before these fields existed)
-- before making them NOT NULL.
UPDATE public.cf_tenants
SET cnpj = '66.498.547/0001-77', razao_social = name
WHERE id = '0d84efb4-3b05-4261-a18f-6be0c4a05f30';

ALTER TABLE public.cf_tenants ALTER COLUMN cnpj SET NOT NULL;
ALTER TABLE public.cf_tenants ALTER COLUMN razao_social SET NOT NULL;

-- Sign-up now collects cnpj and razao_social alongside organization_name.
CREATE OR REPLACE FUNCTION public.cf_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  INSERT INTO public.cf_tenants (name, cnpj, razao_social)
  VALUES (
    NEW.raw_user_meta_data ->> 'organization_name',
    NEW.raw_user_meta_data ->> 'cnpj',
    NEW.raw_user_meta_data ->> 'razao_social'
  )
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
