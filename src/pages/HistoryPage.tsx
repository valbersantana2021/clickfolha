import { useEffect, useState } from 'react'
import { History, CheckCircle2, XCircle, Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/AppLayout'
import { useData } from '@/contexts/DataContext'
import { downloadCsv, buildCsvFileName } from '@/lib/rule-engine'
import type { ConversionLog } from '@/types/database'

export function HistoryPage() {
  const { conversionLogs, subTenants, layouts, deleteConversion } = useData()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { document.title = 'Histórico | ClickFolha' }, [])

  const clientName = (id: string) => subTenants.find(s => s.id === id)?.name ?? '—'
  const layoutName = (id: string) => layouts.find(l => l.id === id)?.name ?? '—'

  const handleRedownload = (log: ConversionLog) => {
    if (!log.csv_content) { toast.error('CSV não disponível para este registro.'); return }
    downloadCsv(log.csv_content, buildCsvFileName(layoutName(log.layout_id), new Date(log.created_at)))
    toast.success('CSV baixado novamente.')
  }

  const handleDelete = (id: string) => {
    deleteConversion(id)
    setConfirmDelete(null)
    toast.success('Conversão removida do histórico.')
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-fg-cream">Histórico de Conversões</h1>
        <p className="mt-0.5 text-sm text-fg-muted">
          Registro de auditoria de todas as conversões realizadas nesta conta.
        </p>
      </div>

      {conversionLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white py-16 text-center">
          <History className="mb-3 h-10 w-10 text-fg-hairline" />
          <p className="font-medium text-fg-cream">Nenhuma conversão realizada ainda</p>
          <p className="mt-1 text-sm text-fg-muted">
            As conversões aparecerão aqui após o download do primeiro CSV.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-fg-ink-3 text-xs font-medium uppercase tracking-wide text-fg-muted">
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Layout</th>
                  <th className="px-4 py-3 text-left">Arquivo</th>
                  <th className="px-4 py-3 text-right">Registros</th>
                  <th className="px-4 py-3 text-right">Valor Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {conversionLogs.map(log => (
                  <tr key={log.id} className="hover:bg-fg-ink-3">
                    <td className="px-4 py-3 text-fg-muted whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-fg-cream">{clientName(log.sub_tenant_id)}</td>
                    <td className="px-4 py-3 text-fg-muted">{layoutName(log.layout_id)}</td>
                    <td className="px-4 py-3 text-fg-muted max-w-[180px] truncate" title={log.file_name}>
                      {log.file_name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-fg-cream">{log.records_count}</td>
                    <td className="px-4 py-3 text-right font-mono text-fg-cream">
                      R$ {log.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3 w-3" /> Sucesso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          <XCircle className="h-3 w-3" /> Erro
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleRedownload(log)}
                          disabled={!log.csv_content}
                          title="Baixar CSV novamente"
                          className="rounded p-1.5 text-fg-muted transition hover:bg-fg-brand/10 hover:text-fg-ice disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Download className="h-4 w-4" />
                        </button>

                        {confirmDelete === log.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(log.id)}
                              className="rounded-lg bg-red-500 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-600"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-lg border px-2 py-1 text-xs text-fg-muted transition hover:bg-fg-ink-3"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(log.id)}
                            title="Excluir conversão"
                            className="rounded p-1.5 text-fg-muted transition hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
