import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Tenant, Profile } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MockUser {
  id: string
  email: string
}

interface AuthContextValue {
  user: MockUser | null
  profile: Profile | null
  tenant: Tenant | null
  loading: boolean
  signUp: (params: { email: string; password: string; full_name: string; organization_name: string }) => Promise<{ error: string | null }>
  signIn: (params: { email: string; password: string }) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

// ---------------------------------------------------------------------------
// Mock storage helpers
// ---------------------------------------------------------------------------
const USERS_KEY = 'cf_mock_users'
const SESSION_KEY = 'cf_mock_session'

interface StoredUser {
  id: string
  email: string
  password: string
  full_name: string
  organization_name: string
}

const getUsers = (): Record<string, StoredUser> => {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}') } catch { return {} }
}

const saveUsers = (users: Record<string, StoredUser>) =>
  localStorage.setItem(USERS_KEY, JSON.stringify(users))

const getSession = (): StoredUser | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') } catch { return null }
}

const saveSession = (user: StoredUser | null) =>
  user
    ? localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    : localStorage.removeItem(SESSION_KEY)

const toProfile = (u: StoredUser): Profile => ({
  id: u.id,
  tenant_id: `tenant-${u.id}`,
  full_name: u.full_name,
  role: 'admin',
  created_at: new Date().toISOString(),
})

const toTenant = (u: StoredUser): Tenant => ({
  id: `tenant-${u.id}`,
  name: u.organization_name,
  plan_id: 'starter',
  stripe_customer_id: null,
  created_at: new Date().toISOString(),
})

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  const applySession = useCallback((stored: StoredUser | null) => {
    if (stored) {
      setUser({ id: stored.id, email: stored.email })
      setProfile(toProfile(stored))
      setTenant(toTenant(stored))
    } else {
      setUser(null)
      setProfile(null)
      setTenant(null)
    }
  }, [])

  // Seed default account on first load
  useEffect(() => {
    const users = getUsers()
    const DEFAULT_EMAIL = 'admin@clickfolha.com.br'
    if (!users[DEFAULT_EMAIL]) {
      const seed: StoredUser = {
        id: 'seed-admin-001',
        email: DEFAULT_EMAIL,
        password: 'clickfolha123',
        full_name: 'Administrador',
        organization_name: 'ClickFolha Demo',
      }
      users[DEFAULT_EMAIL] = seed
      saveUsers(users)
    }
  }, [])

  // Restore session on mount
  useEffect(() => {
    applySession(getSession())
    setLoading(false)
  }, [applySession])

  const signUp = useCallback(
    async ({ email, password, full_name, organization_name }: { email: string; password: string; full_name: string; organization_name: string }) => {
      const users = getUsers()
      if (users[email]) return { error: 'User already registered' }
      const newUser: StoredUser = {
        id: crypto.randomUUID(),
        email,
        password,
        full_name,
        organization_name,
      }
      users[email] = newUser
      saveUsers(users)
      saveSession(newUser)
      applySession(newUser)
      return { error: null }
    },
    [applySession],
  )

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const users = getUsers()
      const found = users[email]
      if (!found || found.password !== password) return { error: 'Invalid login credentials' }
      saveSession(found)
      applySession(found)
      return { error: null }
    },
    [applySession],
  )

  const signOut = useCallback(async () => {
    saveSession(null)
    applySession(null)
  }, [applySession])

  const resetPasswordForEmail = useCallback(async (_email: string) => {
    // Mock: always succeeds silently (no real email sent)
  }, [])

  const updatePassword = useCallback(
    async (password: string) => {
      const stored = getSession()
      if (!stored) return { error: 'No active session' }
      const users = getUsers()
      users[stored.email] = { ...stored, password }
      saveUsers(users)
      saveSession(users[stored.email])
      return { error: null }
    },
    [],
  )

  return (
    <AuthContext.Provider
      value={{ user, profile, tenant, loading, signUp, signIn, signOut, resetPasswordForEmail, updatePassword }}
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
