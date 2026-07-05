import React, { ReactNode } from 'react'
import { createAppErrorEvent, mergeAppErrorStacks } from '../../../shared/appErrors'
import type { AppErrorEvent } from '../../../shared/types'

interface AppErrorBoundaryProps {
  children: ReactNode
  onError: (error: AppErrorEvent) => void
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

    this.props.onError(
      createAppErrorEvent('renderer', error, {
        stack: mergeAppErrorStacks(error.stack, info.componentStack ?? undefined)
      })
    )
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return null
  }
}
