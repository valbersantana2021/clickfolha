import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus, Trash2, LayoutTemplate, ArrowRightLeft, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/contexts/DataContext'
import { AppLayout } from '@/components/AppLayout'

function formatCNPJ(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function ClientsPage() {
  const { subTenants, createSubTenant, deleteSubTenant, getLayoutsForClient } = useData()
  const [newName, setNewName] = useState('')
  const [newCnpj, setNewCnpj] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { document.title = 'Clientes | ClickFolha' }, [])

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    createSubTenant({ name, cnpj: newCnpj.trim() || undefined })
    setNewName('')
    setNewCnpj('')
    setShowForm(false)
    toast.success(`Cliente "${name}" criado.`)
  }

  const handleDelete = (id: string) => {
    const client = subTenants.find(s => s.id === id)
    deleteSubTenant(id)
    setConfirmDelete(null)
    toast.success(`"${client?.name}" removido.`)
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-fg-cream">Clientes</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            Empresas que você atende. Cada cliente tem seus próprios layouts de conversão.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-fg-cream">Novo cliente</p>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">Nome do cliente *</label>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowForm(false); setNewCnpj('') } }}
                placeholder="Ex: Padaria São João Ltda"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-muted">CNPJ</label>
              <input
                value={newCnpj}
                onChange={e => setNewCnpj(formatCNPJ(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowForm(false); setNewCnpj('') } }}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowForm(false); setNewName(''); setNewCnpj('') }}
              className="rounded-lg border px-4 py-2 text-sm text-fg-muted transition hover:bg-fg-ink-3"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {subTenants.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white py-16 text-center">
          <Building2 className="mb-3 h-10 w-10 text-fg-hairline" />
          <p className="font-medium text-fg-cream">Nenhum cliente cadastrado ainda</p>
          <p className="mt-1 text-sm text-fg-muted">
            Adicione seu primeiro cliente para começar a configurar layouts de conversão.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 flex items-center gap-2 rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar cliente
          </button>
        </div>
      )}

      {/* Client list */}
      {subTenants.length > 0 && (
        <div className="space-y-3">
          {subTenants.map(client => {
            const clientLayouts = getLayoutsForClient(client.id)
            return (
              <div key={client.id} className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fg-ink-3">
                    <Building2 className="h-5 w-5 text-fg-muted" />
                  </div>
                  <div>
                    <p className="font-medium text-fg-cream">{client.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {client.cnpj && (
                        <span className="text-xs text-fg-muted">{client.cnpj}</span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-fg-muted">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(client.created_at)}
                      </span>
                      <span className="text-xs text-fg-muted">
                        {clientLayouts.length} layout{clientLayouts.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/convert?client=${client.id}`}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-fg-muted transition hover:bg-fg-ink-3"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Converter
                  </Link>
                  <Link
                    to={`/convert?client=${client.id}&step=layout`}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-fg-muted transition hover:bg-fg-ink-3"
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    Layouts ({clientLayouts.length})
                  </Link>

                  {confirmDelete === client.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-lg border px-3 py-1.5 text-xs text-fg-muted transition hover:bg-fg-ink-3"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(client.id)}
                      className="rounded-lg p-1.5 text-fg-muted transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}
