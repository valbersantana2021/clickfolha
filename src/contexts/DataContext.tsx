import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { SubTenant, Layout, LayoutConfig, ConversionLog } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

// ── CSV local cache ─────────────────────────────────────────────────────────────
// Excel/CSV content must never leave the browser (LGPD guarantee, see
// CLAUDE.md). cf_conversions_log only stores metadata server-side, so the
// generated CSV is cached locally per conversion for same-browser re-download;
// a cache miss (different device/session) just disables the re-download button.

const csvCacheKey = (logId: string) => `cf_csv_${logId}`
const cacheCsv = (logId: string, csv: string) => {
  try { localStorage.setItem(csvCacheKey(logId), csv) } catch { /* storage full or unavailable */ }
}
const readCachedCsv = (logId: string): string => {
  try { return localStorage.getItem(csvCacheKey(logId)) ?? '' } catch { return '' }
}

// ── Context types ───────────────────────────────────────────────────────────────

// Thrown by logConversion when the DB trigger rejects the insert because the
// tenant already hit its plan's monthly conversion limit (see migration
// 20260728120000_billing_conversion_limit.sql). Distinct from other errors so
// callers can show a specific "limit reached" message.
export class MonthlyLimitReachedError extends Error {
  constructor() { super('MONTHLY_LIMIT_REACHED') }
}

// Thrown when the DB trigger rejects the insert because a platform admin
// deactivated the tenant (e.g. overdue payment).
export class TenantInactiveError extends Error {
  constructor() { super('TENANT_INACTIVE') }
}

interface DataContextValue {
  loading: boolean

  // Monthly conversion limit for the tenant's current plan; null while
  // loading or if the plan has no configured limit.
  conversionLimit: number | null

  subTenants: SubTenant[]
  createSubTenant: (data: { name: string; cod_empresa: string; cnpj?: string }) => Promise<SubTenant>
  deleteSubTenant: (id: string) => Promise<void>

  layouts: Layout[]
  getLayoutsForClient: (subTenantId: string) => Layout[]
  saveLayout: (data: { sub_tenant_id: string; name: string; config_json: LayoutConfig }) => Promise<Layout>
  updateLayout: (id: string, config: LayoutConfig) => Promise<void>
  deleteLayout: (id: string) => Promise<void>

  // cf_conversions_log is an append-only audit trail (no UPDATE/DELETE RLS
  // policy by design) — there is no deleteConversion.
  conversionLogs: ConversionLog[]
  logConversion: (data: {
    tenant_id: string
    sub_tenant_id: string
    layout_id: string
    file_name: string
    records_count: number
    total_value: number
    status: 'success' | 'error'
    csv_content: string
  }) => Promise<ConversionLog>
}

const DataContext = createContext<DataContextValue | null>(null)

// ── Provider ────────────────────────────────────────────────────────────────────

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useAuth()

  const [loading, setLoading] = useState(true)
  const [conversionLimit, setConversionLimit] = useState<number | null>(null)
  const [subTenants, setSubTenants] = useState<SubTenant[]>([])
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [conversionLogs, setConversionLogs] = useState<ConversionLog[]>([])

  useEffect(() => {
    if (!tenant) {
      setConversionLimit(null)
      setSubTenants([])
      setLayouts([])
      setConversionLogs([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      const [{ data: st }, { data: lay }, { data: logs }, { data: limitRow }] = await Promise.all([
        supabase.from('cf_sub_tenants').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
        supabase.from('cf_layouts').select('*'),
        supabase.from('cf_conversions_log').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
        supabase.from('cf_plan_limits').select('monthly_conversions').eq('plan_id', tenant.plan_id).maybeSingle(),
      ])
      if (cancelled) return
      setSubTenants(st ?? [])
      setLayouts(lay ?? [])
      setConversionLogs((logs ?? []).map(l => ({ ...l, csv_content: readCachedCsv(l.id) })))
      setConversionLimit(limitRow?.monthly_conversions ?? null)
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [tenant])

  // ── Sub-tenants ───────────────────────────────────────────────────────────────

  const createSubTenant = useCallback(async ({ name, cod_empresa, cnpj }: { name: string; cod_empresa: string; cnpj?: string }): Promise<SubTenant> => {
    if (!tenant) throw new Error('No tenant in session')
    const { data, error } = await supabase
      .from('cf_sub_tenants')
      .insert({ tenant_id: tenant.id, name, cod_empresa, cnpj: cnpj ?? null })
      .select()
      .single()
    if (error) throw error
    setSubTenants(prev => [data, ...prev])
    return data
  }, [tenant])

  const deleteSubTenant = useCallback(async (id: string) => {
    const { error } = await supabase.from('cf_sub_tenants').delete().eq('id', id)
    if (error) throw error
    setSubTenants(prev => prev.filter(s => s.id !== id))
  }, [])

  // ── Layouts ───────────────────────────────────────────────────────────────────

  const getLayoutsForClient = useCallback(
    (subTenantId: string) => layouts.filter(l => l.sub_tenant_id === subTenantId),
    [layouts],
  )

  const saveLayout = useCallback(async ({ sub_tenant_id, name, config_json }: { sub_tenant_id: string; name: string; config_json: LayoutConfig }): Promise<Layout> => {
    const { data, error } = await supabase
      .from('cf_layouts')
      .insert({ sub_tenant_id, name, config_json })
      .select()
      .single()
    if (error) throw error
    setLayouts(prev => [...prev, data])
    return data
  }, [])

  const updateLayout = useCallback(async (id: string, config: LayoutConfig) => {
    const { data, error } = await supabase
      .from('cf_layouts')
      .update({ config_json: config })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setLayouts(prev => prev.map(l => l.id === id ? data : l))
  }, [])

  const deleteLayout = useCallback(async (id: string) => {
    const { error } = await supabase.from('cf_layouts').delete().eq('id', id)
    if (error) throw error
    setLayouts(prev => prev.filter(l => l.id !== id))
  }, [])

  // ── Conversions ───────────────────────────────────────────────────────────────

  const logConversion = useCallback(async (data: {
    tenant_id: string
    sub_tenant_id: string
    layout_id: string
    file_name: string
    records_count: number
    total_value: number
    status: 'success' | 'error'
    csv_content: string
  }): Promise<ConversionLog> => {
    const { csv_content, ...row } = data
    const { data: inserted, error } = await supabase
      .from('cf_conversions_log')
      .insert(row)
      .select()
      .single()
    if (error) {
      if (error.code === 'P0001') throw new MonthlyLimitReachedError()
      if (error.code === 'P0002') throw new TenantInactiveError()
      throw error
    }
    cacheCsv(inserted.id, csv_content)
    const log: ConversionLog = { ...inserted, csv_content }
    setConversionLogs(prev => [log, ...prev])
    return log
  }, [])

  return (
    <DataContext.Provider value={{
      loading,
      conversionLimit,
      subTenants, createSubTenant, deleteSubTenant,
      layouts, getLayoutsForClient, saveLayout, updateLayout, deleteLayout,
      conversionLogs, logConversion,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
