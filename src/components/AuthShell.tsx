import { FileSpreadsheet } from 'lucide-react'

interface AuthShellProps {
  headline: string
  subtitle: string
  features: string[]
  panelLabel: string
  panelTitle: string
  panelDescription: string
  children: React.ReactNode
}

export function AuthShell({
  headline,
  subtitle,
  features,
  panelLabel,
  panelTitle,
  panelDescription,
  children,
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen bg-fg-ink font-sans">
      {/* ── Left: brand panel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[460px] xl:w-[520px] flex-col border-r border-fg-hairline bg-fg-ink-2 p-12 relative overflow-hidden">
        <div className="fg-grid-bg absolute inset-0" />
        <div
          className="fg-glow absolute -right-16 top-16 h-72 w-72 rounded-full bg-fg-brand-2 opacity-[0.16]"
          aria-hidden
        />
        <div
          className="fg-glow absolute -left-20 bottom-0 h-64 w-64 rounded-full opacity-[0.12]"
          style={{ background: '#2DD4BF' }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col">
          {/* badge */}
          <div className="fg-pill mb-12">
            <span className="fg-pill-dot animate-pulse" />
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-fg-ice">
              ClickFolha
            </span>
          </div>

          {/* logo */}
          <div
            className="mb-10 flex items-center gap-3"
            style={{ filter: 'drop-shadow(0 0 20px rgba(217, 119, 87, 0.33))' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fg-brand">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold leading-none text-fg-cream">ClickFolha</p>
              <p className="mt-0.5 text-xs text-fg-muted">Folha de Pagamento</p>
            </div>
          </div>

          {/* headline */}
          <h1 className="mb-4 font-display text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.03em] text-fg-cream">
            {headline}
          </h1>
          <p className="mb-10 text-sm leading-relaxed text-fg-muted">{subtitle}</p>

          {/* feature list */}
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-fg-cream/90">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-fg-ice" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Right: form panel ─────────────────────────────── */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="fg-grid-bg absolute inset-0 lg:opacity-60" />
        <div className="relative z-10 w-full max-w-md">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-fg-ice">
            {panelLabel}
          </p>
          <h2 className="mb-1 font-display text-3xl font-semibold tracking-[-0.01em] text-fg-cream">
            {panelTitle}
          </h2>
          <p className="mb-2 text-sm text-fg-muted">{panelDescription}</p>
          <div className="mb-8 h-0.5 w-12 bg-fg-brand" />

          {children}
        </div>
      </div>
    </div>
  )
}
