// supabase/functions/invite-user/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitePayload {
  full_name: string
  email: string
  role?: 'admin' | 'operator'
  organization_name?: string
  razao_social?: string
  cnpj?: string
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ message: 'Missing authorization header.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const appUrl = Deno.env.get('APP_URL')!

    // Caller-scoped client: subject to RLS, tells us who is really calling —
    // never trust a role/tenant the client claims in the request body.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    if (userError || !user) return json({ message: 'Invalid session.' }, 401)

    const payload = (await req.json()) as InvitePayload
    const fullName = payload.full_name?.trim()
    const email = payload.email?.trim()
    if (!fullName || !email) return json({ message: 'Nome e e-mail são obrigatórios.' }, 400)

    // Privileged client: bypasses RLS. Only used after the permission checks below.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: platformAdminRow } = await callerClient
      .from('cf_platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let tenantId: string
    let role: 'admin' | 'operator'

    if (platformAdminRow) {
      const organizationName = payload.organization_name?.trim()
      const razaoSocial = payload.razao_social?.trim()
      const cnpj = payload.cnpj?.trim()
      if (!organizationName || !razaoSocial || !cnpj) {
        return json({ message: 'Nome, razão social e CNPJ da empresa são obrigatórios.' }, 400)
      }
      const { data: newTenant, error: tenantError } = await adminClient
        .from('cf_tenants')
        .insert({ name: organizationName, razao_social: razaoSocial, cnpj })
        .select('id')
        .single()
      if (tenantError || !newTenant) return json({ message: 'Erro ao criar a empresa.' }, 500)
      tenantId = newTenant.id
      role = 'admin' // first user of a brand new tenant is always its admin
    } else {
      const { data: callerProfile } = await callerClient
        .from('cf_profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single()
      if (!callerProfile || callerProfile.role !== 'admin') {
        return json({ message: 'Sem permissão para convidar usuários.' }, 403)
      }
      tenantId = callerProfile.tenant_id
      role = payload.role === 'admin' ? 'admin' : 'operator'
    }

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${appUrl}/reset-password`, data: { full_name: fullName } },
    )

    if (inviteError || !invited?.user) {
      const alreadyExists = (inviteError?.message ?? '').toLowerCase().includes('already')
      return json(
        { message: alreadyExists ? 'Este e-mail já está cadastrado.' : 'Erro ao enviar convite.' },
        alreadyExists ? 409 : 500,
      )
    }

    const { error: profileError } = await adminClient.from('cf_profiles').insert({
      id: invited.user.id,
      tenant_id: tenantId,
      full_name: fullName,
      email,
      role,
      active: true,
    })

    if (profileError) {
      return json({ message: 'Convite enviado, mas houve erro ao vincular o perfil.' }, 500)
    }

    return json({ ok: true, tenant_id: tenantId }, 200)
  } catch {
    return json({ message: 'Erro inesperado ao processar o convite.' }, 500)
  }
})
