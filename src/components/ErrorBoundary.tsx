import React from 'react'
import { Button } from '@/components/ui/button'

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-xl font-semibold">Algo deu errado</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {this.state.error?.message ?? 'Erro inesperado na aplicação.'}
          </p>
          <Button onClick={this.reset}>Tentar novamente</Button>
        </div>
      )
    }

    return this.props.children
  }
}
