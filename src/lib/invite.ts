import { supabase } from '@/lib/supabase'

export interface InviteUserPayload {
  full_name: string
  email: string
  role?: 'admin' | 'operator'
  organization_name?: string
  razao_social?: string
  cnpj?: string
}

export async function inviteUser(payload: InviteUserPayload): Promise<{ tenant_id: string }> {
  const { data, error } = await supabase.functions.invoke('invite-user', { body: payload })
  if (error) {
    let message = 'Erro ao enviar convite. Tente novamente.'
    const context = (error as { context?: Response }).context
    if (context instanceof Response) {
      try {
        const body = await context.json()
        if (body?.message) message = body.message
      } catch { /* keep default message */ }
    }
    throw new Error(message)
  }
  return data as { tenant_id: string }
}
