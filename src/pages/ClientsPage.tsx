import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus, Trash2, LayoutTemplate, ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/contexts/DataContext'
import { AppLayout } from '@/components/AppLayout'

export function ClientsPage() {
  const { subTenants, createSubTenant, deleteSubTenant, getLayoutsForClient } = useData()
  const [newName, setNewName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { document.title = 'Clientes | ClickFolha' }, [])

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    createSubTenant(name)
    setNewName('')
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
          <p className="mb-3 text-sm font-medium text-fg-cream">Nome do cliente</p>
          <div className="flex gap-3">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowForm(false) }}
              placeholder="Ex: Padaria São João Ltda"
              className="flex-1 rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-fg-brand-2 disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              onClick={() => { setShowForm(false); setNewName('') }}
              className="rounded-lg border px-4 py-2 text-sm text-fg-muted transition hover:bg-fg-ink-3"
            >
              Cancelar
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fg-ink-3">
                    <Building2 className="h-5 w-5 text-fg-muted" />
                  </div>
                  <div>
                    <p className="font-medium text-fg-cream">{client.name}</p>
                    <p className="text-xs text-fg-muted">
                      {clientLayouts.length} layout{clientLayouts.length !== 1 ? 's' : ''} configurado{clientLayouts.length !== 1 ? 's' : ''}
                    </p>
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
