import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { APP_URL } from '@/env'
import type { Tenant, Profile } from '@/types/database'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface AuthContextValue {
  user: User | null
  profile: Profile | null
  tenant: Tenant | null
  isPlatformAdmin: boolean
  loading: boolean
  signUp: (params: { email: string; password: string; full_name: string; organization_name: string; cnpj: string; razao_social: string }) => Promise<{ error: string | null }>
  signIn: (params: { email: string; password: string }) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadProfileAndTenant = useCallback(async (userId: string) => {
    const { data: profileData } = await supabase
      .from('cf_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!profileData) {
      // Session references a user with no profile row (e.g. deleted directly
      // in the database) — the JWT is still technically valid until it
      // expires, so without this the app would show a broken logged-in
      // state instead of returning to /login.
      setProfile(null)
      setTenant(null)
      setIsPlatformAdmin(false)
      await supabase.auth.signOut()
      return
    }
    setProfile(profileData)

    const [{ data: tenantData }, { data: adminRow }] = await Promise.all([
      supabase.from('cf_tenants').select('*').eq('id', profileData.tenant_id).single(),
      supabase.from('cf_platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
    ])
    setTenant(tenantData ?? null)
    setIsPlatformAdmin(!!adminRow)
  }, [])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      setUser(session?.user ?? null)
      if (session?.user) await loadProfileAndTenant(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadProfileAndTenant(session.user.id)
      } else {
        setProfile(null)
        setTenant(null)
        setIsPlatformAdmin(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadProfileAndTenant])

  const signUp = useCallback(
    async ({ email, password, full_name, organization_name, cnpj, razao_social }: { email: string; password: string; full_name: string; organization_name: string; cnpj: string; razao_social: string }) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name, organization_name, cnpj, razao_social } },
      })
      if (error) return { error: error.message }
      return { error: null }
    },
    [],
  )

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      return { error: null }
    },
    [],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const resetPasswordForEmail = useCallback(async (email: string) => {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${APP_URL}/reset-password` })
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: error.message }
    return { error: null }
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, profile, tenant, isPlatformAdmin, loading, signUp, signIn, signOut, resetPasswordForEmail, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
