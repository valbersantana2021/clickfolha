import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { UserCog, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const ROLE_LABEL: Record<'admin' | 'operator', string> = { admin: 'Admin', operator: 'Operador' }

export function EquipePage() {
  const { profile, loading: authLoading } = useAuth()
  const { teamMembers, inviteTeamMember, updateTeamMemberActive } = useData()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'operator'>('operator')
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { document.title = 'Equipe | ClickFolha' }, [])

  if (!authLoading && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  const resetForm = () => { setName(''); setEmail(''); setRole('operator') }

  const handleInvite = async () => {
    const fullName = name.trim()
    const mail = email.trim()
    if (!fullName || !mail) return
    setSaving(true)
    try {
      await inviteTeamMember({ full_name: fullName, email: mail, role })
      toast.success(`Convite enviado para ${mail}.`)
      resetForm()
      setShowForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar convite.')
    }
    setSaving(false)
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    setPendingId(id)
    try {
      await updateTeamMemberActive(id, !active)
      toast.success(active ? 'Usuário desativado.' : 'Usuário reativado.')
    } catch {
      toast.error('Erro ao atualizar o usuário.')
    }
    setPendingId(null)
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-fg-brand" />
          <div>
            <h1 className="font-display text-xl font-semibold text-fg-cream">Equipe</h1>
            <p className="mt-0.5 text-sm text-fg-muted">
              Usuários da sua empresa. Só administradores gerenciam clientes e convidam pessoas.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2"
        >
          <Plus className="h-4 w-4" />
          Convidar
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-fg-cream">Convidar usuário</p>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">Nome completo *</label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Maria Silva"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">E-mail *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="pessoa@empresa.com.br"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">Cargo</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'admin' | 'operator')}
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              >
                <option value="operator">Operador</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="rounded-lg border px-4 py-2 text-sm text-fg-muted transition hover:bg-fg-ink-3"
            >
              Cancelar
            </button>
            <button
              onClick={handleInvite}
              disabled={!name.trim() || !email.trim() || saving}
              className="rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2 disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar convite'}
            </button>
          </div>
        </div>
      )}

      {teamMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white py-16 text-center">
          <UserCog className="mb-3 h-10 w-10 text-fg-hairline" />
          <p className="font-medium text-fg-cream">Nenhum usuário ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teamMembers.map(member => (
            <div key={member.id} className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-fg-cream">{member.full_name}</p>
                  <span className="rounded bg-fg-ink-3 px-1.5 py-0.5 text-xs font-medium text-fg-muted">
                    {ROLE_LABEL[member.role]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${member.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {member.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                  <span>{member.email}</span>
                  <span>Desde {formatDateTime(member.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => handleToggleActive(member.id, member.active)}
                disabled={pendingId === member.id}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
                  member.active ? 'bg-red-500 hover:bg-red-600' : 'bg-fg-brand hover:bg-fg-brand-2'
                }`}
              >
                {pendingId === member.id ? 'Salvando...' : member.active ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
