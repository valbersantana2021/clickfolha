import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ShieldCheck, Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Tenant } from '@/types/database'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function PlatformAdminPage() {
  const { isPlatformAdmin, loading: authLoading } = useAuth()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { document.title = 'Admin da Plataforma | ClickFolha' }, [])

  const loadTenants = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('cf_tenants').select('*').order('created_at', { ascending: false })
    setTenants(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isPlatformAdmin) void loadTenants()
  }, [isPlatformAdmin, loadTenants])

  const toggleActive = async (t: Tenant) => {
    setPendingId(t.id)
    const { error } = await supabase.from('cf_tenants').update({ active: !t.active }).eq('id', t.id)
    if (error) {
      toast.error('Erro ao atualizar o status da empresa.')
    } else {
      setTenants(prev => prev.map(x => x.id === t.id ? { ...x, active: !t.active } : x))
      toast.success(t.active ? `"${t.name}" foi inativada.` : `"${t.name}" foi reativada.`)
    }
    setPendingId(null)
  }

  if (!authLoading && !isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-fg-brand" />
        <div>
          <h1 className="font-display text-xl font-semibold text-fg-cream">Admin da Plataforma</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            Ative ou inative empresas (ex.: pendência de pagamento). Conversões ficam bloqueadas enquanto a empresa estiver inativa.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-fg-brand" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white py-16 text-center">
          <Building2 className="mb-3 h-10 w-10 text-fg-hairline" />
          <p className="font-medium text-fg-cream">Nenhuma empresa cadastrada ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-fg-ink-3 px-1.5 py-0.5 font-mono text-xs text-fg-muted">#{t.code}</span>
                  <p className="font-medium text-fg-cream">{t.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {t.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                  <span>{t.razao_social}</span>
                  <span>{t.cnpj}</span>
                  <span className="rounded bg-fg-ink-3 px-1.5 py-0.5 font-mono">{t.plan_id}</span>
                  <span>Criada em {formatDateTime(t.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => toggleActive(t)}
                disabled={pendingId === t.id}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
                  t.active ? 'bg-red-500 hover:bg-red-600' : 'bg-fg-brand hover:bg-fg-brand-2'
                }`}
              >
                {pendingId === t.id ? 'Salvando...' : t.active ? 'Inativar' : 'Reativar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
