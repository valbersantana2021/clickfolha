import { memo, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRightLeft, Building2, CreditCard, History, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { AppLayout } from '@/components/AppLayout'

interface StatCardProps {
  label: string
  value: number | string
  hint: string
}

const StatCard = memo(function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-xl border border-fg-hairline bg-fg-ink-2 p-5 shadow-sm">
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-fg-cream">{value}</p>
      <p className="mt-1 text-xs text-fg-muted/70">{hint}</p>
    </div>
  )
})

export function DashboardPage() {
  const { tenant, profile } = useAuth()
  const { subTenants, layouts, conversionLogs, conversionLimit } = useData()
  const navigate = useNavigate()

  useEffect(() => { document.title = 'Dashboard | ClickFolha' }, [])

  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthConversions = conversionLogs.filter(l => l.created_at.startsWith(thisMonth))
  const monthTotal = monthConversions.reduce((s, l) => s + l.total_value, 0)

  const recentLogs = conversionLogs.slice(0, 5)

  const handleConvert = useCallback(() => navigate('/convert'), [navigate])

  return (
    <AppLayout>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-fg-cream">
          Bem-vindo, {profile?.full_name?.split(' ')[0]}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-muted">
          <Building2 className="h-4 w-4" />
          {tenant?.name}
          <span className="ml-2 rounded-full bg-fg-ink-3 px-2 py-0.5 font-mono text-xs font-medium capitalize text-fg-muted">
            {tenant?.plan_id}
          </span>
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Conversões este mês"
          value={monthConversions.length}
          hint={conversionLimit !== null ? `Limite: ${conversionLimit} / mês (${tenant?.plan_id})` : 'Sem limite configurado'}
        />
        <StatCard
          label="Valor processado (mês)"
          value={`R$ ${monthTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          hint="Soma dos eventos convertidos"
        />
        <StatCard
          label="Clientes cadastrados"
          value={subTenants.length}
          hint={subTenants.length === 0 ? 'Nenhum cliente ainda' : `${layouts.length} layout(s) configurados`}
        />
        <StatCard
          label="Total de conversões"
          value={conversionLogs.length}
          hint="Desde o início da conta"
        />
      </div>

      {/* Quick actions */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <button
          onClick={handleConvert}
          className="group flex items-start gap-4 rounded-xl border border-fg-hairline bg-fg-ink-2 p-5 text-left shadow-sm transition hover:border-fg-brand/40 hover:shadow"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fg-brand/10 text-fg-brand group-hover:bg-fg-brand/15">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display font-semibold text-fg-cream">Nova Conversão</p>
            <p className="mt-0.5 text-sm text-fg-muted">
              Faça upload de uma planilha Excel e gere o CSV de folha de pagamento
            </p>
          </div>
        </button>

        <Link
          to="/clients"
          className="group flex items-start gap-4 rounded-xl border border-fg-hairline bg-fg-ink-2 p-5 text-left shadow-sm transition hover:border-fg-brand/40 hover:shadow"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fg-ink-3 text-fg-muted group-hover:bg-fg-hairline">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display font-semibold text-fg-cream">Gerenciar Clientes</p>
            <p className="mt-0.5 text-sm text-fg-muted">
              Cadastre as empresas que você atende e configure seus layouts de conversão
            </p>
          </div>
        </Link>
      </div>

      {/* Recent activity */}
      {recentLogs.length > 0 && (
        <div className="rounded-xl border border-fg-hairline bg-fg-ink-2 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-fg-hairline px-5 py-3">
            <p className="text-sm font-medium text-fg-cream flex items-center gap-2">
              <History className="h-4 w-4 text-fg-muted" />
              Atividade recente
            </p>
            <Link to="/history" className="text-xs text-fg-ice hover:text-fg-brand">
              Ver tudo →
            </Link>
          </div>
          <div className="divide-y divide-fg-hairline">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-fg-cream">{log.file_name}</p>
                    <p className="text-xs text-fg-muted">
                      {new Date(log.created_at).toLocaleDateString('pt-BR')} · {log.records_count} registros
                    </p>
                  </div>
                </div>
                <p className="text-sm font-mono text-fg-cream">
                  R$ {log.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan info */}
      <div className="mt-6 rounded-xl border border-fg-hairline bg-fg-ink-3 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-fg-muted" />
          <div>
            <p className="text-sm font-medium text-fg-cream">Plano Starter</p>
            <p className="text-xs text-fg-muted">{conversionLimit ?? '—'} conversões/mês · 1 operador · 5 layouts</p>
          </div>
        </div>
        <button disabled className="rounded-lg border border-fg-hairline px-3 py-1.5 text-xs font-medium text-fg-muted cursor-not-allowed">
          Fazer upgrade
        </button>
      </div>
    </AppLayout>
  )
}
