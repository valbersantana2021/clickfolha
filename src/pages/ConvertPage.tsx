import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Upload, CheckCircle2, Download, RefreshCw, ChevronRight,
  Loader2, Plus, FileSpreadsheet, Table, X,
} from 'lucide-react'
import { AppLayout } from '@/components/AppLayout'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  parseExcel, autoDetect, processLayout, generateCsv, downloadCsv, buildCsvFileName, totalValue,
  type ParsedExcel, type OutputRow,
} from '@/lib/rule-engine'
import type { LayoutConfig, TransformType, Layout } from '@/types/database'

// ── Local state types ────────────────────────────────────────────────────────────

type Step = 'setup' | 'map' | 'preview'

interface EventRuleState {
  id: string
  event_code: string
  source_column: string
  transform: TransformType
  output_field: 'reference' | 'value'
  skip_if_zero: boolean
}

interface SheetRuleState {
  sheetIndex: number
  headers: string[]
  employeeCodeColumn: string
  employeeCodeTransform: TransformType
  events: EventRuleState[]
}

const TRANSFORMS: { value: TransformType; label: string }[] = [
  { value: 'direct', label: 'Texto direto' },
  { value: 'padLeft6', label: 'Zerar até 6 dígitos' },
  { value: 'hoursToDecimal', label: 'Horas → Decimal' },
  { value: 'numberBR', label: 'Número (R$ BR)' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────────

const validHeaders = (headers: (string | null)[]) =>
  headers.filter((h): h is string => !!h)

function newEvent(): EventRuleState {
  return {
    id: Math.random().toString(36).slice(2),
    event_code: '',
    source_column: '',
    transform: 'numberBR',
    output_field: 'value',
    skip_if_zero: true,
  }
}

function buildConfig(sheetRules: SheetRuleState[]): LayoutConfig {
  return {
    sheets: sheetRules.map(sr => ({
      sheet_index: sr.sheetIndex,
      employee_code_column: sr.employeeCodeColumn,
      employee_code_transform: sr.employeeCodeTransform,
      events: sr.events.map(e => ({
        event_code: e.event_code,
        source_column: e.source_column,
        transform: e.transform,
        output_field: e.output_field,
        skip_if_zero: e.skip_if_zero,
      })),
    })),
  }
}

// ── Step indicator ───────────────────────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'setup', label: '1. Configurar' },
    { id: 'map', label: '2. Regras de Conversão' },
    { id: 'preview', label: '3. Prévia e Download' },
  ]
  const idx = steps.findIndex(s => s.id === current)
  return (
    <div className="mb-8 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <span className={`text-sm font-medium ${i <= idx ? 'text-fg-ice' : 'text-fg-muted'}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-fg-hairline" />}
        </div>
      ))}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────────

export function ConvertPage() {
  const [searchParams] = useSearchParams()
  const { tenant } = useAuth()
  const { subTenants, createSubTenant, getLayoutsForClient, saveLayout, logConversion } = useData()

  const [step, setStep] = useState<Step>('setup')

  // Step 1 state
  const [clientId, setClientId] = useState(searchParams.get('client') ?? '')
  const [newClientName, setNewClientName] = useState('')
  const [newClientCodEmpresa, setNewClientCodEmpresa] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [selectedSheet, setSelectedSheet] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedExcel | null>(null)

  // Step 2 state
  const [selectedLayoutId, setSelectedLayoutId] = useState('')
  const [layoutName, setLayoutName] = useState('Layout Padrão')
  const [sheetRules, setSheetRules] = useState<SheetRuleState[]>([])
  const [sheetHeadersCache, setSheetHeadersCache] = useState<Record<number, string[]>>({})
  const [loadingSheetIdx, setLoadingSheetIdx] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)

  // Step 3 state
  const [outputRows, setOutputRows] = useState<OutputRow[]>([])
  const [savedLayoutId, setSavedLayoutId] = useState('')

  useEffect(() => { document.title = 'Nova Conversão | ClickFolha' }, [])

  const clientLayouts = clientId ? getLayoutsForClient(clientId) : []

  // ── File handling ─────────────────────────────────────────────────────────────

  const processFile = useCallback(async (f: File, sheetIdx = 0) => {
    if (!f.name.match(/\.xlsx?$/i)) {
      toast.error('Somente arquivos .xlsx são suportados.')
      return
    }
    setFile(f)
    setSelectedSheet(sheetIdx)
    setParsing(true)
    try {
      const result = await parseExcel(f, sheetIdx)
      setParsed(result)
      // Reset sheet rules when a new file is loaded
      setSheetRules([])
      setSheetHeadersCache({})
    } catch {
      toast.error('Erro ao ler o arquivo Excel.')
      setFile(null)
    }
    setParsing(false)
  }, [])

  const handleSheetChange = useCallback(async (idx: number) => {
    if (!file) return
    setSelectedSheet(idx)
    setParsing(true)
    try {
      const result = await parseExcel(file, idx)
      setParsed(result)
    } catch {
      toast.error('Erro ao ler a aba selecionada.')
    }
    setParsing(false)
  }, [file])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  const inputRef = useRef<HTMLInputElement>(null)

  // ── Load existing layout ──────────────────────────────────────────────────────

  const loadLayout = useCallback((layout: Layout) => {
    // Layouts saved by older, incompatible schema versions may lack `sheets` entirely.
    if (!Array.isArray(layout.config_json?.sheets)) {
      toast.error('Este layout está em um formato incompatível e não pode ser carregado.')
      return
    }
    setSelectedLayoutId(layout.id)
    setLayoutName(layout.name)
    // Convert LayoutConfig → SheetRuleState[] (headers loaded on-demand in Step 2)
    setSheetRules(layout.config_json.sheets.map(sr => ({
      sheetIndex: sr.sheet_index,
      headers: [],
      employeeCodeColumn: sr.employee_code_column,
      employeeCodeTransform: sr.employee_code_transform,
      events: sr.events.map(e => ({
        id: Math.random().toString(36).slice(2),
        event_code: e.event_code,
        source_column: e.source_column,
        transform: e.transform,
        output_field: e.output_field,
        skip_if_zero: e.skip_if_zero,
      })),
    })))
  }, [])

  // ── Create client ─────────────────────────────────────────────────────────────

  const handleCreateClient = () => {
    const name = newClientName.trim()
    const codEmpresa = newClientCodEmpresa.trim()
    if (!name || !codEmpresa) return
    const st = createSubTenant({ name, cod_empresa: codEmpresa })
    setClientId(st.id)
    setNewClientName('')
    setNewClientCodEmpresa('')
    setShowNewClient(false)
    toast.success(`Cliente "${name}" criado.`)
  }

  // ── Step 1 → Step 2 ──────────────────────────────────────────────────────────

  const goToMap = useCallback(async () => {
    if (!clientId) { toast.error('Selecione ou crie um cliente.'); return }
    if (!parsed) { toast.error('Faça upload de uma planilha .xlsx.'); return }

    let rules = sheetRules
    const cache: Record<number, string[]> = { ...sheetHeadersCache }

    if (rules.length === 0) {
      // Start with the current previewed sheet
      const headers = validHeaders(parsed.headers)
      const det = autoDetect(parsed.headers)
      rules = [{
        sheetIndex: parsed.sheetIndex,
        headers,
        employeeCodeColumn: det.employee_code ?? headers[0] ?? '',
        employeeCodeTransform: 'padLeft6',
        events: [],
      }]
      cache[parsed.sheetIndex] = headers
    } else if (file) {
      // Populate any empty headers from saved layouts
      const updated = [...rules]
      for (let i = 0; i < updated.length; i++) {
        const sr = updated[i]
        if (sr.headers.length === 0) {
          if (cache[sr.sheetIndex]) {
            updated[i] = { ...sr, headers: cache[sr.sheetIndex] }
          } else {
            try {
              const r = await parseExcel(file, sr.sheetIndex)
              const h = validHeaders(r.headers)
              cache[sr.sheetIndex] = h
              updated[i] = { ...sr, headers: h }
            } catch { /* leave empty */ }
          }
        }
      }
      rules = updated
    }

    setSheetRules(rules)
    setSheetHeadersCache(cache)
    setStep('map')
  }, [clientId, parsed, sheetRules, sheetHeadersCache, file])

  // ── Add a sheet to the layout rules ──────────────────────────────────────────

  const addSheet = useCallback(async (sheetIdx: number) => {
    if (!file) return

    if (sheetHeadersCache[sheetIdx]) {
      const h = sheetHeadersCache[sheetIdx]
      setSheetRules(prev => [...prev, {
        sheetIndex: sheetIdx,
        headers: h,
        employeeCodeColumn: h[0] ?? '',
        employeeCodeTransform: 'padLeft6',
        events: [],
      }])
      return
    }

    setLoadingSheetIdx(sheetIdx)
    try {
      const result = await parseExcel(file, sheetIdx)
      const h = validHeaders(result.headers)
      const det = autoDetect(result.headers)
      setSheetHeadersCache(prev => ({ ...prev, [sheetIdx]: h }))
      setSheetRules(prev => [...prev, {
        sheetIndex: sheetIdx,
        headers: h,
        employeeCodeColumn: det.employee_code ?? h[0] ?? '',
        employeeCodeTransform: 'padLeft6',
        events: [],
      }])
    } catch {
      toast.error('Erro ao ler a aba.')
    }
    setLoadingSheetIdx(null)
  }, [file, sheetHeadersCache])

  // ── Step 2 → Step 3 ──────────────────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    if (!file) return

    if (sheetRules.length === 0) {
      toast.error('Adicione pelo menos uma aba para processar.')
      return
    }
    const totalEvents = sheetRules.reduce((s, sr) => s + sr.events.length, 0)
    if (totalEvents === 0) {
      toast.error('Adicione pelo menos um evento de folha.')
      return
    }
    if (sheetRules.some(sr => !sr.employeeCodeColumn)) {
      toast.error('Selecione a coluna de matrícula em todas as abas.')
      return
    }
    if (sheetRules.some(sr => sr.events.some(e => !e.event_code || !e.source_column))) {
      toast.error('Preencha o código e a coluna em todos os eventos.')
      return
    }

    const config = buildConfig(sheetRules)

    let lid = savedLayoutId || selectedLayoutId
    if (!lid) {
      const layout = saveLayout({ sub_tenant_id: clientId, name: layoutName, config_json: config })
      lid = layout.id
      setSavedLayoutId(lid)
    }

    setProcessing(true)
    try {
      const rows = await processLayout(file, config)
      if (rows.length === 0) {
        toast.error('Nenhuma linha válida encontrada. Verifique o mapeamento de colunas.')
        setProcessing(false)
        return
      }
      setOutputRows(rows)
      setStep('preview')
    } catch {
      toast.error('Erro ao processar a planilha.')
    }
    setProcessing(false)
  }, [file, sheetRules, savedLayoutId, selectedLayoutId, clientId, layoutName, saveLayout])

  // ── Download ─────────────────────────────────────────────────────────────────

  const handleDownload = () => {
    if (!file || !tenant) return
    const codEmpresa = subTenants.find(s => s.id === clientId)?.cod_empresa ?? ''
    const csv = generateCsv(outputRows, codEmpresa)
    downloadCsv(csv, buildCsvFileName(layoutName))
    logConversion({
      tenant_id: tenant.id,
      sub_tenant_id: clientId,
      layout_id: savedLayoutId || selectedLayoutId,
      file_name: file.name,
      records_count: outputRows.length,
      total_value: totalValue(outputRows),
      status: 'success',
      csv_content: csv,
    })
    toast.success('CSV baixado e conversão registrada.')
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStep('setup')
    setFile(null)
    setParsed(null)
    setOutputRows([])
    setSavedLayoutId('')
    setSelectedLayoutId('')
    setSelectedSheet(0)
    setSheetRules([])
    setSheetHeadersCache({})
  }

  // ── Computed ──────────────────────────────────────────────────────────────────

  const previewHeaders = parsed ? validHeaders(parsed.headers) : []
  const total = totalValue(outputRows)
  const totalBR = total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const availableSheets = parsed
    ? parsed.sheets
        .map((name, i) => ({ name, i }))
        .filter(({ i }) => !sheetRules.some(sr => sr.sheetIndex === i))
    : []

  return (
    <AppLayout>
      <StepBar current={step} />

      {/* ── STEP 1: SETUP ──────────────────────────────────────────────────────── */}
      {step === 'setup' && (
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Client selection */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-display font-semibold text-fg-cream">Cliente</h2>
            <p className="mb-4 text-sm text-fg-muted">Selecione a empresa que será processada</p>

            {!showNewClient ? (
              <>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full rounded-lg border border-fg-hairline px-3 py-2.5 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
                >
                  <option value="">— Selecione um cliente —</option>
                  {subTenants.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                  onClick={() => setShowNewClient(true)}
                  className="mt-3 flex items-center gap-1.5 text-sm text-fg-ice hover:text-fg-brand"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo cliente
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <input
                  autoFocus
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateClient()
                    if (e.key === 'Escape') setShowNewClient(false)
                  }}
                  placeholder="Nome da empresa"
                  className="w-full rounded-lg border border-fg-hairline px-3 py-2.5 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
                />
                <input
                  value={newClientCodEmpresa}
                  onChange={e => setNewClientCodEmpresa(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateClient()
                    if (e.key === 'Escape') setShowNewClient(false)
                  }}
                  placeholder="Código da Empresa (ex: 0006)"
                  className="w-full rounded-lg border border-fg-hairline px-3 py-2.5 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateClient} disabled={!newClientName.trim() || !newClientCodEmpresa.trim()}
                    className="rounded-lg bg-fg-brand px-4 py-2 text-sm font-medium text-white hover:bg-fg-brand-2 disabled:opacity-50">
                    Criar
                  </button>
                  <button onClick={() => setShowNewClient(false)}
                    className="rounded-lg border px-4 py-2 text-sm text-fg-muted hover:bg-fg-ink-3">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {clientId && clientLayouts.length > 0 && (
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
                  Layouts salvos
                </p>
                <div className="space-y-1">
                  {clientLayouts.map(l => (
                    <button
                      key={l.id}
                      onClick={() => loadLayout(l)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                        selectedLayoutId === l.id
                          ? 'bg-fg-brand/10 text-fg-brand'
                          : 'text-fg-cream hover:bg-fg-ink-3'
                      }`}
                    >
                      <span>{l.name}</span>
                      <span className="text-xs text-fg-muted">
                        {l.config_json?.sheets?.length ?? 0} aba(s)
                      </span>
                      {selectedLayoutId === l.id && <CheckCircle2 className="h-4 w-4 text-fg-brand" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* File drop zone */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-display font-semibold text-fg-cream">Planilha Excel</h2>
            <p className="mb-4 text-sm text-fg-muted">Arraste o arquivo .xlsx ou clique para selecionar</p>

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition ${
                dragging ? 'border-fg-brand bg-fg-brand/10' : 'border-fg-hairline hover:border-fg-brand/40 hover:bg-fg-ink-3'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
              />
              {parsing ? (
                <Loader2 className="h-8 w-8 animate-spin text-fg-brand" />
              ) : file ? (
                <>
                  <FileSpreadsheet className="h-8 w-8 text-green-500" />
                  <p className="mt-2 text-sm font-medium text-fg-cream">{file.name}</p>
                  <p className="text-xs text-fg-muted">
                    {parsed?.rows.length ?? 0} linhas · {parsed?.sheets.length ?? 0} aba(s)
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-fg-hairline" />
                  <p className="mt-2 text-sm text-fg-muted">Clique ou arraste o arquivo aqui</p>
                  <p className="text-xs text-fg-muted">.xlsx, .xls</p>
                </>
              )}
            </div>

            {/* Sheet preview selector */}
            {parsed && parsed.sheets.length > 1 && (
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-fg-muted">Aba em prévia</label>
                <select
                  value={selectedSheet}
                  onChange={e => handleSheetChange(Number(e.target.value))}
                  disabled={parsing}
                  className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
                >
                  {parsed.sheets.map((name, i) => <option key={i} value={i}>{name}</option>)}
                </select>
              </div>
            )}

            {/* Column chips */}
            {parsed && previewHeaders.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-fg-muted">Colunas nesta aba:</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewHeaders.slice(0, 8).map(h => (
                    <span key={h} className="rounded bg-fg-ink-3 px-2 py-0.5 text-xs text-fg-muted">{h}</span>
                  ))}
                  {previewHeaders.length > 8 && (
                    <span className="text-xs text-fg-muted">+{previewHeaders.length - 8} mais</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 flex justify-end">
            <button
              onClick={goToMap}
              disabled={!clientId || !parsed}
              className="flex items-center gap-2 rounded-lg bg-fg-brand px-6 py-2.5 text-sm font-medium text-white transition hover:bg-fg-brand-2 disabled:opacity-50"
            >
              Configurar regras
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: RULES ──────────────────────────────────────────────────────── */}
      {step === 'map' && parsed && (
        <div className="mx-auto max-w-3xl space-y-4">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-fg-cream">Regras de Conversão</h2>
              <p className="mt-0.5 text-sm text-fg-muted">
                Configure as abas e eventos que serão gerados no CSV
              </p>
            </div>

            {availableSheets.length > 0 && (
              <div className="flex items-center gap-2">
                {loadingSheetIdx !== null && <Loader2 className="h-4 w-4 animate-spin text-fg-brand" />}
                <select
                  value=""
                  onChange={e => {
                    const idx = Number(e.target.value)
                    if (!isNaN(idx) && e.target.value !== '') addSheet(idx)
                  }}
                  className="rounded-lg border border-fg-hairline px-3 py-2 text-sm text-fg-cream focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
                >
                  <option value="">+ Adicionar aba</option>
                  {availableSheets.map(({ name, i }) => (
                    <option key={i} value={i}>{name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Empty state */}
          {sheetRules.length === 0 && (
            <div className="rounded-xl border border-dashed bg-white py-12 text-center">
              <Table className="mx-auto mb-3 h-8 w-8 text-fg-hairline" />
              <p className="text-sm font-medium text-fg-cream">Nenhuma aba configurada</p>
              <p className="mt-1 text-xs text-fg-muted">
                Use "+ Adicionar aba" acima para começar
              </p>
            </div>
          )}

          {/* Sheet rule cards */}
          {sheetRules.map((sr, sidx) => (
            <SheetRuleCard
              key={`${sr.sheetIndex}-${sidx}`}
              sheetName={parsed.sheets[sr.sheetIndex] ?? `Aba ${sr.sheetIndex}`}
              rule={sr}
              onUpdate={updated =>
                setSheetRules(prev => prev.map((r, i) => i === sidx ? updated : r))
              }
              onRemove={() =>
                setSheetRules(prev => prev.filter((_, i) => i !== sidx))
              }
            />
          ))}

          {/* Layout name */}
          <div className="rounded-xl border bg-white px-5 py-4 shadow-sm">
            <label className="mb-1.5 block text-sm font-medium text-fg-cream">Salvar layout como</label>
            <input
              value={layoutName}
              onChange={e => setLayoutName(e.target.value)}
              placeholder="Nome do layout"
              className="w-full rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
            />
            <p className="mt-1 text-xs text-fg-muted">
              O layout será salvo automaticamente para conversões futuras.
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('setup')}
              className="text-sm text-fg-muted hover:text-fg-cream"
            >
              ← Voltar
            </button>
            <button
              onClick={handleProcess}
              disabled={processing || sheetRules.length === 0}
              className="flex items-center gap-2 rounded-lg bg-fg-brand px-6 py-2.5 text-sm font-medium text-white transition hover:bg-fg-brand-2 disabled:opacity-50"
            >
              {processing && <Loader2 className="h-4 w-4 animate-spin" />}
              Processar planilha
              {!processing && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: PREVIEW & DOWNLOAD ────────────────────────────────────────── */}
      {step === 'preview' && (
        <div>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Registros" value={String(outputRows.length)} />
            <StatCard label="Valor Total" value={totalBR} highlight />
            <StatCard label="Arquivo" value={file?.name ?? ''} small />
            <StatCard
              label="Cliente"
              value={subTenants.find(s => s.id === clientId)?.name ?? ''}
              small
            />
          </div>

          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-lg bg-fg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-fg-brand-2"
            >
              <Download className="h-4 w-4" />
              Baixar CSV
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium text-fg-muted transition hover:bg-fg-ink-3"
            >
              <RefreshCw className="h-4 w-4" />
              Nova conversão
            </button>
          </div>

          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b px-5 py-3">
              <p className="text-sm font-medium text-fg-cream">
                Prévia — primeiros {Math.min(20, outputRows.length)} de {outputRows.length} registros
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-fg-ink-3 text-xs font-medium uppercase tracking-wide text-fg-muted">
                    <th className="px-4 py-3 text-left">Cód. Empregado</th>
                    <th className="px-4 py-3 text-left">Cód. Evento</th>
                    <th className="px-4 py-3 text-left">Referência</th>
                    <th className="px-4 py-3 text-right">Valor do Evento</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {outputRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="hover:bg-fg-ink-3">
                      <td className="px-4 py-2.5 font-mono text-fg-cream">{row.employee_code}</td>
                      <td className="px-4 py-2.5 font-mono text-fg-cream">{row.event_code}</td>
                      <td className="px-4 py-2.5 text-fg-muted">{row.reference || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-fg-cream">
                        {row.value || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-fg-ink-3 font-medium">
                    <td className="px-4 py-2.5 font-mono text-xs text-fg-muted">Z</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-fg-muted">{outputRows.length}</td>
                    <td />
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-fg-cream">{totalBR}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-fg-muted hover:text-fg-muted">
              Ver CSV bruto
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg border bg-gray-900 p-4 text-xs text-green-400">
              {generateCsv(outputRows.slice(0, 5), subTenants.find(s => s.id === clientId)?.cod_empresa ?? '')}
              {outputRows.length > 5 ? '\n...' : ''}
            </pre>
          </details>
        </div>
      )}
    </AppLayout>
  )
}

// ── SheetRuleCard ────────────────────────────────────────────────────────────────

interface SheetRuleCardProps {
  sheetName: string
  rule: SheetRuleState
  onUpdate: (updated: SheetRuleState) => void
  onRemove: () => void
}

function SheetRuleCard({ sheetName, rule, onUpdate, onRemove }: SheetRuleCardProps) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b bg-fg-ink-3 px-5 py-3">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-fg-brand flex-shrink-0" />
          <span className="font-medium text-fg-cream">{sheetName}</span>
          <span className="rounded-full bg-fg-brand/10 px-2 py-0.5 text-xs text-fg-ice">
            {rule.events.length} evento{rule.events.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onRemove}
          className="rounded p-1 text-fg-muted transition hover:bg-red-50 hover:text-red-500"
          title="Remover aba"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Employee code column */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-muted">
            Coluna de Matrícula
          </label>
          <div className="flex gap-2">
            <select
              value={rule.employeeCodeColumn}
              onChange={e => onUpdate({ ...rule, employeeCodeColumn: e.target.value })}
              className="flex-1 rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
            >
              <option value="">— Selecione a coluna —</option>
              {rule.headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select
              value={rule.employeeCodeTransform}
              onChange={e =>
                onUpdate({ ...rule, employeeCodeTransform: e.target.value as TransformType })
              }
              className="w-44 rounded-lg border border-fg-hairline px-3 py-2 text-sm focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand"
            >
              {TRANSFORMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Events */}
        {rule.events.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
              Eventos de Folha
            </p>
            <div className="space-y-2">
              {rule.events.map((event, eidx) => (
                <EventRuleRow
                  key={event.id}
                  event={event}
                  headers={rule.headers}
                  onUpdate={updated =>
                    onUpdate({
                      ...rule,
                      events: rule.events.map((e, i) => i === eidx ? updated : e),
                    })
                  }
                  onRemove={() =>
                    onUpdate({
                      ...rule,
                      events: rule.events.filter((_, i) => i !== eidx),
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => onUpdate({ ...rule, events: [...rule.events, newEvent()] })}
          className="flex items-center gap-1.5 text-sm text-fg-ice hover:text-fg-brand"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar evento
        </button>
      </div>
    </div>
  )
}

// ── EventRuleRow ─────────────────────────────────────────────────────────────────

interface EventRuleRowProps {
  event: EventRuleState
  headers: string[]
  onUpdate: (updated: EventRuleState) => void
  onRemove: () => void
}

function EventRuleRow({ event, headers, onUpdate, onRemove }: EventRuleRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fg-hairline bg-fg-ink-3 px-3 py-2">
      {/* Event code */}
      <input
        value={event.event_code}
        onChange={e => onUpdate({ ...event, event_code: e.target.value })}
        placeholder="Cód."
        className="w-14 rounded border border-fg-hairline bg-white px-2 py-1.5 text-center text-sm font-mono focus:border-fg-brand focus:outline-none"
      />

      {/* Source column */}
      <select
        value={event.source_column}
        onChange={e => onUpdate({ ...event, source_column: e.target.value })}
        className="min-w-0 flex-1 rounded border border-fg-hairline bg-white px-2 py-1.5 text-sm focus:border-fg-brand focus:outline-none"
      >
        <option value="">— Coluna —</option>
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>

      {/* Transform */}
      <select
        value={event.transform}
        onChange={e => onUpdate({ ...event, transform: e.target.value as TransformType })}
        className="w-36 rounded border border-fg-hairline bg-white px-2 py-1.5 text-sm focus:border-fg-brand focus:outline-none"
      >
        {TRANSFORMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {/* Output field toggle */}
      <div className="flex overflow-hidden rounded border border-fg-hairline text-xs font-medium">
        <button
          onClick={() => onUpdate({ ...event, output_field: 'value' })}
          className={`px-2.5 py-1.5 transition ${
            event.output_field === 'value'
              ? 'bg-fg-brand-2 text-white'
              : 'bg-white text-fg-muted hover:bg-fg-ink-3'
          }`}
        >
          Valor
        </button>
        <button
          onClick={() => onUpdate({ ...event, output_field: 'reference' })}
          className={`border-l border-fg-hairline px-2.5 py-1.5 transition ${
            event.output_field === 'reference'
              ? 'bg-fg-brand-2 text-white'
              : 'bg-white text-fg-muted hover:bg-fg-ink-3'
          }`}
        >
          Ref.
        </button>
      </div>

      {/* Skip if zero */}
      <label
        className="flex cursor-pointer items-center gap-1 text-xs text-fg-muted"
        title="Pular linha se valor for zero ou vazio"
      >
        <input
          type="checkbox"
          checked={event.skip_if_zero}
          onChange={e => onUpdate({ ...event, skip_if_zero: e.target.checked })}
          className="h-3.5 w-3.5 rounded"
        />
        ≠ 0
      </label>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 rounded p-0.5 text-fg-hairline transition hover:text-red-400"
        title="Remover evento"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────────────────────────

interface StatCardProps { label: string; value: string; highlight?: boolean; small?: boolean }
function StatCard({ label, value, highlight, small }: StatCardProps) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${highlight ? 'border-fg-brand/30 bg-fg-brand/10' : ''}`}>
      <p className="mb-1 text-xs text-fg-muted">{label}</p>
      <p className={`truncate font-semibold ${small ? 'text-sm' : 'text-lg'} ${highlight ? 'text-fg-brand' : 'text-fg-cream'}`}>
        {value}
      </p>
    </div>
  )
}
