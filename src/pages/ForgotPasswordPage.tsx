import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'

const schema = z.object({ email: z.string().email('E-mail invalido') })
type FormData = z.infer<typeof schema>

const input =
  'w-full rounded-lg border border-fg-hairline bg-fg-ink-2/60 px-4 py-3 text-sm text-fg-cream placeholder:text-fg-muted focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand transition'

export function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => { document.title = 'Recuperar Senha | ClickFolha' }, [])

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    await resetPasswordForEmail(data.email)
    setSubmitting(false)
    setSent(true)
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
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-fg-ice" />
            <p className="text-lg font-semibold text-fg-cream">Verifique seu e-mail</p>
            <p className="text-sm text-fg-muted">
              Se este e-mail estiver cadastrado, você receberá um link em breve.
            </p>
            <Link to="/login" className="mt-2 text-sm font-semibold text-fg-ice transition hover:text-fg-cream">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-fg-ice">Recuperação</p>
            <h2 className="mb-1 font-display text-2xl font-semibold tracking-[-0.01em] text-fg-cream">Recuperar senha</h2>
            <p className="mb-2 text-sm text-fg-muted">Informe seu e-mail para receber o link</p>
            <div className="mb-6 h-0.5 w-10 bg-fg-brand" />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-fg-brand py-3.5 font-display text-sm font-semibold tracking-[0.01em] text-white transition hover:bg-fg-brand-2 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar link
                </button>
              </form>
            </Form>

            <p className="mt-5 text-center text-sm text-fg-muted">
              <Link to="/login" className="font-semibold text-fg-ice transition hover:text-fg-cream">
                Voltar para o login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
