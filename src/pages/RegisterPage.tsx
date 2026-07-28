import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useToggle } from '@/hooks/useToggle'
import { AuthShell } from '@/components/AuthShell'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { formatCNPJ } from '@/lib/utils'

const schema = z.object({
  full_name: z.string().min(1, 'Nome obrigatorio').max(100),
  organization_name: z.string().min(1, 'Nome da empresa obrigatorio').max(100),
  razao_social: z.string().min(1, 'Razao social obrigatoria').max(100),
  cnpj: z.string().refine(v => v.replace(/\D/g, '').length === 14, 'CNPJ invalido'),
  email: z.string().email('E-mail invalido'),
  password: z.string().min(8, 'Minimo 8 caracteres'),
})

type FormData = z.infer<typeof schema>

const FEATURES = [
  'Configure layouts em minutos',
  'Sem instalação ou servidor',
  'Suporte a múltiplos clientes',
]

const input =
  'w-full rounded-lg border border-fg-hairline bg-fg-ink-2/60 px-4 py-3 text-sm text-fg-cream placeholder:text-fg-muted focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand transition'

export function RegisterPage() {
  const { signUp, user } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [showPwd, togglePwd] = useToggle()

  useEffect(() => { document.title = 'Criar Conta | ClickFolha' }, [])
  useEffect(() => { if (user) navigate('/dashboard', { replace: true }) }, [user, navigate])

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    const { error } = await signUp(data)
    setSubmitting(false)
    if (error === 'User already registered') { toast.error('Este e-mail ja esta cadastrado.'); return }
    if (error) { toast.error('Erro ao criar conta. Tente novamente.'); return }
    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthShell
      headline="Comece agora sem instalar nada"
      subtitle="Configure layouts de conversão e processe suas primeiras planilhas em minutos."
      features={FEATURES}
      panelLabel="Novo Acesso"
      panelTitle="Criar conta"
      panelDescription="Preencha os dados para começar"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <label className="font-mono text-xs font-medium uppercase tracking-widest text-fg-muted">Nome completo</label>
                <FormControl>
                  <input placeholder="Maria Silva" className={`mt-1.5 ${input}`} {...field} />
                </FormControl>
                <FormMessage className="text-xs text-red-600" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="organization_name"
            render={({ field }) => (
              <FormItem>
                <label className="font-mono text-xs font-medium uppercase tracking-widest text-fg-muted">Empresa</label>
                <FormControl>
                  <input placeholder="Contabilidade Exemplo Ltda" className={`mt-1.5 ${input}`} {...field} />
                </FormControl>
                <FormMessage className="text-xs text-red-600" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="razao_social"
            render={({ field }) => (
              <FormItem>
                <label className="font-mono text-xs font-medium uppercase tracking-widest text-fg-muted">Razão Social</label>
                <FormControl>
                  <input placeholder="Contabilidade Exemplo Ltda ME" className={`mt-1.5 ${input}`} {...field} />
                </FormControl>
                <FormMessage className="text-xs text-red-600" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cnpj"
            render={({ field }) => (
              <FormItem>
                <label className="font-mono text-xs font-medium uppercase tracking-widest text-fg-muted">CNPJ</label>
                <FormControl>
                  <input
                    placeholder="00.000.000/0000-00"
                    className={`mt-1.5 ${input}`}
                    {...field}
                    onChange={e => field.onChange(formatCNPJ(e.target.value))}
                  />
                </FormControl>
                <FormMessage className="text-xs text-red-600" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <label className="font-mono text-xs font-medium uppercase tracking-widest text-fg-muted">E-mail</label>
                <FormControl>
                  <input type="email" placeholder="voce@empresa.com.br" className={`mt-1.5 ${input}`} {...field} />
                </FormControl>
                <FormMessage className="text-xs text-red-600" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <label className="font-mono text-xs font-medium uppercase tracking-widest text-fg-muted">Senha</label>
                <FormControl>
                  <div className="relative mt-1.5">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
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
            Criar conta
          </button>
        </form>
      </Form>

      <p className="mt-6 text-center text-sm text-fg-muted">
        Ja tem conta?{' '}
        <Link to="/login" className="font-semibold text-fg-ice transition hover:text-fg-cream">
          Entrar
        </Link>
      </p>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-fg-muted">
        <Shield className="h-3.5 w-3.5" />
        <span>Conexão segura · HTTPS</span>
      </div>
    </AuthShell>
  )
}
