import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useToggle } from '@/hooks/useToggle'
import { AuthShell } from '@/components/AuthShell'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'

const schema = z.object({
  email: z.string().email('E-mail invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
})

type FormData = z.infer<typeof schema>

const FEATURES = [
  'Processamento 100% no navegador',
  'Conformidade com LGPD',
  'Multi-empresa e multi-layout',
]

const input =
  'w-full rounded-lg border border-fg-hairline bg-fg-ink-2/60 px-4 py-3 text-sm text-fg-cream placeholder:text-fg-muted focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand transition'

export function LoginPage() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'
  const [submitting, setSubmitting] = useState(false)
  const [showPwd, togglePwd] = useToggle()

  useEffect(() => { document.title = 'Entrar | ClickFolha' }, [])
  useEffect(() => { if (user) navigate(from, { replace: true }) }, [user, navigate, from])

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    const { error } = await signIn(data)
    setSubmitting(false)
    if (error) { toast.error('E-mail ou senha incorretos.'); return }
    navigate(from, { replace: true })
  }

  return (
    <AuthShell
      headline="Converta planilhas Excel em CSV de folha"
      subtitle="Automatize a preparação da folha de pagamento sem enviar dados para servidores externos."
      features={FEATURES}
      panelLabel="Portal de Acesso"
      panelTitle="Bem-vindo de volta"
      panelDescription="Insira suas credenciais para continuar"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

          {/* E-mail */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <label className="font-mono text-xs font-medium uppercase tracking-widest text-fg-muted">
                  E-mail
                </label>
                <FormControl>
                  <input
                    type="email"
                    placeholder="voce@empresa.com.br"
                    className={`mt-1.5 ${input}`}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs text-red-600" />
              </FormItem>
            )}
          />

          {/* Senha */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs font-medium uppercase tracking-widest text-fg-muted">
                    Senha
                  </label>
                  <Link
                    to="/forgot-password"
                    className="font-mono text-xs font-medium uppercase tracking-widest text-fg-ice transition hover:text-fg-cream"
                  >
                    Esqueceu?
                  </Link>
                </div>
                <FormControl>
                  <div className="relative mt-1.5">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`${input} pr-11`}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={togglePwd}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted transition hover:text-fg-cream"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-xs text-red-600" />
              </FormItem>
            )}
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-fg-brand py-3.5 font-display text-sm font-semibold tracking-[0.01em] text-white transition hover:bg-fg-brand-2 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </button>
        </form>
      </Form>

      <p className="mt-6 text-center text-sm text-fg-muted">
        Nao tem conta?{' '}
        <Link to="/register" className="font-semibold text-fg-ice transition hover:text-fg-cream">
          Criar conta
        </Link>
      </p>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-fg-muted">
        <Shield className="h-3.5 w-3.5" />
        <span>Conexão segura · HTTPS</span>
      </div>
    </AuthShell>
  )
}
