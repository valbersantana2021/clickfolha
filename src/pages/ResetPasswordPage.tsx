import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Eye, EyeOff, FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useToggle } from '@/hooks/useToggle'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'

const schema = z
  .object({
    password: z.string().min(8, 'Minimo 8 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas nao coincidem',
    path: ['confirm'],
  })

type FormData = z.infer<typeof schema>

const input =
  'w-full rounded-lg border border-fg-hairline bg-fg-ink-2/60 px-4 py-3 text-sm text-fg-cream placeholder:text-fg-muted focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand transition'

export function ResetPasswordPage() {
  const { updatePassword, user } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [showPwd, togglePwd] = useToggle()
  const [showConfirm, toggleConfirm] = useToggle()

  useEffect(() => { document.title = 'Nova Senha | ClickFolha' }, [])

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    const { error } = await updatePassword(data.password)
    setSubmitting(false)
    if (error) { toast.error('Nao foi possivel atualizar a senha. Tente novamente.'); return }
    toast.success('Senha atualizada com sucesso.')
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-fg-ink px-6 py-12 font-sans">
      <div className="fg-grid-bg absolute inset-0" />

      <div className="relative z-10 mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fg-brand">
          <FileSpreadsheet className="h-4 w-4 text-white" />
        </div>
        <span className="font-display font-semibold text-fg-cream">ClickFolha</span>
      </div>

      <div className="relative z-10 w-full max-w-md rounded-[14px] border border-fg-hairline bg-fg-ink-2 p-8">
        {!user ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <AlertCircle className="h-12 w-12 text-red-600" />
            <p className="text-lg font-semibold text-fg-cream">Link expirado</p>
            <p className="text-sm text-fg-muted">
              Este link de recuperação já foi usado ou expirou.
            </p>
            <Link to="/forgot-password" className="mt-2 text-sm font-semibold text-fg-ice transition hover:text-fg-cream">
              Solicitar novo link
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-fg-ice">Segurança</p>
            <h2 className="mb-1 font-display text-2xl font-semibold tracking-[-0.01em] text-fg-cream">Nova senha</h2>
            <p className="mb-2 text-sm text-fg-muted">Escolha uma senha segura para sua conta</p>
            <div className="mb-6 h-0.5 w-10 bg-fg-brand" />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <label className="font-mono text-xs font-medium uppercase tracking-widest text-fg-muted">Nova senha</label>
                      <FormControl>
                        <div className="relative mt-1.5">
                          <input
                            type={showPwd ? 'text' : 'password'}
                            placeholder="Mínimo 8 caracteres"
                            className={`${input} pr-11`}
                            {...field}
                          />
                          <button type="button" onClick={togglePwd}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted transition hover:text-fg-cream">
                            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirm"
                  render={({ field }) => (
                    <FormItem>
                      <label className="font-mono text-xs font-medium uppercase tracking-widest text-fg-muted">Confirmar senha</label>
                      <FormControl>
                        <div className="relative mt-1.5">
                          <input
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="Repita a nova senha"
                            className={`${input} pr-11`}
                            {...field}
                          />
                          <button type="button" onClick={toggleConfirm}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted transition hover:text-fg-cream">
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-fg-brand py-3.5 font-display text-sm font-semibold tracking-[0.01em] text-white transition hover:bg-fg-brand-2 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Redefinir senha
                </button>
              </form>
            </Form>
          </>
        )}
      </div>
    </div>
  )
}
