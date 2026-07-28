import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ShieldCheck, Building2, Loader2, Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { inviteUser } from '@/lib/invite'
import { formatCNPJ } from '@/lib/utils'
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
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [creating, setCreating] = useState(false)

  const resetForm = () => {
    setOrgName(''); setRazaoSocial(''); setCnpj(''); setAdminName(''); setAdminEmail('')
  }

  const openCreateForm = () => {
    resetForm()
    setEditingId(null)
    setShowForm(true)
  }

  const openEditForm = (t: Tenant) => {
    setOrgName(t.name)
    setRazaoSocial(t.razao_social)
    setCnpj(t.cnpj)
    setEditingId(t.id)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    resetForm()
  }

  const handleSaveTenant = async () => {
    const name = orgName.trim()
    const razao = razaoSocial.trim()
    const doc = cnpj.trim()

    if (editingId) {
      if (!name || !razao || !doc) return
      setCreating(true)
      try {
        const { error } = await supabase
          .from('cf_tenants')
          .update({ name, razao_social: razao, cnpj: doc })
          .eq('id', editingId)
        if (error) throw error
        toast.success(`Empresa "${name}" atualizada.`)
        closeForm()
        await loadTenants()
      } catch {
        toast.error('Erro ao atualizar empresa. Tente novamente.')
      }
      setCreating(false)
      return
    }

    const fullName = adminName.trim()
    const email = adminEmail.trim()
    if (!name || !razao || !doc || !fullName || !email) return
    setCreating(true)
    try {
      await inviteUser({ organization_name: name, razao_social: razao, cnpj: doc, full_name: fullName, email })
      toast.success(`Empresa "${name}" criada e convite enviado para ${email}.`)
      closeForm()
      await loadTenants()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar empresa.')
    }
    setCreating(false)
  }

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
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-fg-brand" />
          <div>
            <h1 className="font-display text-xl font-semibold text-fg-cream">Admin da Plataforma</h1>
            <p className="mt-0.5 text-sm text-fg-muted">
              Ative ou inative empresas (ex.: pendência de pagamento). Conversões ficam bloqueadas enquanto a empresa estiver inativa.
            </p>
          </div>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2"
        >
          <Plus className="h-4 w-4" />
          Nova Empresa
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-fg-cream">
            {editingId ? 'Editar empresa' : 'Nova empresa'}
          </p>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">Nome (fantasia) *</label>
              <input
                autoFocus
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Contabilidade Exemplo Ltda"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">Razão social *</label>
              <input
                value={razaoSocial}
                onChange={e => setRazaoSocial(e.target.value)}
                placeholder="Contabilidade Exemplo Ltda ME"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">CNPJ *</label>
              <input
                value={cnpj}
                onChange={e => setCnpj(formatCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            {!editingId && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-fg-muted">Nome do admin *</label>
                  <input
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder="Maria Silva"
                    className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-fg-muted">E-mail do admin *</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="admin@empresa.com.br"
                    className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={closeForm}
              className="rounded-lg border px-4 py-2 text-sm text-fg-muted transition hover:bg-fg-ink-3"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveTenant}
              disabled={
                !orgName.trim() || !razaoSocial.trim() || !cnpj.trim() ||
                (!editingId && (!adminName.trim() || !adminEmail.trim())) ||
                creating
              }
              className="rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2 disabled:opacity-50"
            >
              {creating ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar e convidar admin'}
            </button>
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditForm(t)}
                  className="rounded-lg p-2 text-fg-muted transition hover:bg-fg-ink-3 hover:text-fg-cream"
                  title="Editar empresa"
                >
                  <Pencil className="h-4 w-4" />
                </button>
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
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
