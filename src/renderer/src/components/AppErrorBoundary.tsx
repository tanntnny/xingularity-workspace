import React, { ReactNode } from 'react'
import { useVaultStore } from '../state/store'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
  componentStack?: string
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
    componentStack: undefined
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      error,
      componentStack: undefined
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({
      error,
      componentStack: info.componentStack ?? undefined
    })

    useVaultStore.getState().pushToast('error', `[renderer] ${error.message}`, {
      description: [error.stack, info.componentStack].filter(Boolean).join('\n\n'),
      persist: true
    })
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="min-h-screen bg-[var(--bg)] p-6 text-[var(--text)]">
        <div className="mx-auto grid max-w-5xl gap-4 rounded-2xl border border-[var(--destructive)] bg-[var(--panel)] p-5">
          <div className="grid gap-1">
            <h1 className="text-xl font-semibold">Application Error</h1>
            <p className="text-sm text-[var(--muted)]">
              The renderer crashed. The full error is shown below.
            </p>
          </div>
          <pre className="overflow-auto rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-4 text-xs leading-6 whitespace-pre-wrap">
            {[this.state.error.stack ?? this.state.error.message, this.state.componentStack]
              .filter(Boolean)
              .join('\n\n')}
          </pre>
        </div>
      </div>
    )
  }
}
