import { useCallback } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { FileSpreadsheet, LogOut, History, Users, LayoutDashboard, ArrowRightLeft, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface AppLayoutProps {
  children: React.ReactNode
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/convert', label: 'Nova Conversão', icon: ArrowRightLeft },
  { to: '/clients', label: 'Clientes', icon: Users },
  { to: '/history', label: 'Histórico', icon: History },
]

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, isPlatformAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = useCallback(async () => {
    await signOut()
    navigate('/login', { replace: true })
  }, [signOut, navigate])

  return (
    <div className="min-h-screen bg-fg-ink font-sans">
      <header className="sticky top-0 z-20 border-b border-fg-hairline bg-fg-ink-2/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-fg-brand">
                <FileSpreadsheet className="h-4 w-4 text-white" />
              </div>
              <span className="font-display text-sm font-semibold tracking-tight text-fg-cream">ClickFolha</span>
            </Link>

            {/* Nav */}
            <nav className="hidden items-center gap-0.5 md:flex">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-fg-ink-3 text-fg-cream'
                        : 'text-fg-muted hover:bg-fg-ink-3 hover:text-fg-cream'
                    }`
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </NavLink>
              ))}
              {isPlatformAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-fg-ink-3 text-fg-cream'
                        : 'text-fg-muted hover:bg-fg-ink-3 hover:text-fg-cream'
                    }`
                  }
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin
                </NavLink>
              )}
            </nav>
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-fg-muted sm:block">{profile?.full_name}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-fg-ink-3 hover:text-fg-cream"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
