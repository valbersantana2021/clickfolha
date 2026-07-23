import React, { createContext, useContext, useState, useCallback } from 'react'
import type { SubTenant, Layout, LayoutConfig, ConversionLog } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'

// ── Storage helpers ─────────────────────────────────────────────────────────────

const load = <T,>(key: string): T[] => {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
}
const persist = <T,>(key: string, data: T[]) =>
  localStorage.setItem(key, JSON.stringify(data))

// ── Context types ───────────────────────────────────────────────────────────────

interface DataContextValue {
  subTenants: SubTenant[]
  createSubTenant: (name: string) => SubTenant
  deleteSubTenant: (id: string) => void

  layouts: Layout[]
  getLayoutsForClient: (subTenantId: string) => Layout[]
  saveLayout: (data: Omit<Layout, 'id' | 'created_at'>) => Layout
  updateLayout: (id: string, config: LayoutConfig) => void
  deleteLayout: (id: string) => void

  conversionLogs: ConversionLog[]
  logConversion: (data: Omit<ConversionLog, 'id' | 'created_at'>) => ConversionLog
  deleteConversion: (id: string) => void
}

const DataContext = createContext<DataContextValue | null>(null)

// ── Provider ────────────────────────────────────────────────────────────────────

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useAuth()
  const tid = tenant?.id ?? 'local'

  const key = (name: string) => `cf_${name}_${tid}`

  const [subTenants, setSubTenants] = useState<SubTenant[]>(() => load(key('sub_tenants')))
  const [layouts, setLayouts] = useState<Layout[]>(() => load(key('layouts')))
  const [conversionLogs, setConversionLogs] = useState<ConversionLog[]>(() => load(key('conversions')))

  // ── Sub-tenants ───────────────────────────────────────────────────────────────

  const createSubTenant = useCallback((name: string): SubTenant => {
    const st: SubTenant = { id: crypto.randomUUID(), tenant_id: tid, name, created_at: new Date().toISOString() }
    setSubTenants(prev => { const next = [...prev, st]; persist(key('sub_tenants'), next); return next })
    return st
  }, [tid]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteSubTenant = useCallback((id: string) => {
    setSubTenants(prev => { const next = prev.filter(s => s.id !== id); persist(key('sub_tenants'), next); return next })
  }, [tid]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Layouts ───────────────────────────────────────────────────────────────────

  const getLayoutsForClient = useCallback(
    (subTenantId: string) => layouts.filter(l => l.sub_tenant_id === subTenantId),
    [layouts],
  )

  const saveLayout = useCallback((data: Omit<Layout, 'id' | 'created_at'>): Layout => {
    const layout: Layout = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    setLayouts(prev => { const next = [...prev, layout]; persist(key('layouts'), next); return next })
    return layout
  }, [tid]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateLayout = useCallback((id: string, config: LayoutConfig) => {
    setLayouts(prev => {
      const next = prev.map(l => l.id === id ? { ...l, config_json: config } : l)
      persist(key('layouts'), next)
      return next
    })
  }, [tid]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteLayout = useCallback((id: string) => {
    setLayouts(prev => { const next = prev.filter(l => l.id !== id); persist(key('layouts'), next); return next })
  }, [tid]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conversions ───────────────────────────────────────────────────────────────

  const logConversion = useCallback((data: Omit<ConversionLog, 'id' | 'created_at'>): ConversionLog => {
    const log: ConversionLog = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    setConversionLogs(prev => { const next = [log, ...prev]; persist(key('conversions'), next); return next })
    return log
  }, [tid]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteConversion = useCallback((id: string) => {
    setConversionLogs(prev => { const next = prev.filter(c => c.id !== id); persist(key('conversions'), next); return next })
  }, [tid]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DataContext.Provider value={{
      subTenants, createSubTenant, deleteSubTenant,
      layouts, getLayoutsForClient, saveLayout, updateLayout, deleteLayout,
      conversionLogs, logConversion, deleteConversion,
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
