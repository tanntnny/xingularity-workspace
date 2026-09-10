import './assets/main.css'

import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createAppErrorEvent, isNonFatalRendererErrorMessage } from '../../shared/appErrors'
import type { AppErrorEvent } from '../../shared/types'
import App from './App'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AppErrorPage } from './components/AppErrorPage'
import { AppPlatformProvider, useAppPlatform } from './platform'
import { TooltipProvider } from './components/ui/tooltip'

function AppRoot() {
  const platform = useAppPlatform()
  const [fatalError, setFatalError] = useState<AppErrorEvent | null>(null)

  const reportFatalError = useCallback((error: AppErrorEvent) => {
    setFatalError((current) => current ?? error)
  }, [])

  useEffect(() => {
    const timers = new Map<Element, number>()

    const handleScroll = (event: Event): void => {
      const target = event.target instanceof Element ? event.target : document.scrollingElement
      if (!target) return

      target.classList.add('scrollbar-visible')

      const existingTimer = timers.get(target)
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer)
      }

      const timer = window.setTimeout(() => {
        target.classList.remove('scrollbar-visible')
        timers.delete(target)
      }, 700)

      timers.set(target, timer)
    }

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true })

    return () => {
      document.removeEventListener('scroll', handleScroll, true)
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [])

  useEffect(() => {
    const removeWindowError = (event: ErrorEvent): void => {
      if (isNonFatalRendererErrorMessage(event.message)) {
        event.preventDefault()
        return
      }

      reportFatalError(createAppErrorEvent('renderer', event.error ?? event.message))
    }
    const removeUnhandledRejection = (event: PromiseRejectionEvent): void => {
      reportFatalError(createAppErrorEvent('renderer', event.reason))
    }

    window.addEventListener('error', removeWindowError)
    window.addEventListener('unhandledrejection', removeUnhandledRejection)

    const unsubscribe = platform.api?.app.onError((event) => {
      reportFatalError(event)
    })

    return () => {
      window.removeEventListener('error', removeWindowError)
      window.removeEventListener('unhandledrejection', removeUnhandledRejection)
      unsubscribe?.()
    }
  }, [platform.api, reportFatalError])

  const handleReload = useCallback(async () => {
    if (platform.api) {
      await platform.api.ui.reloadApp()
      return
    }

    window.location.reload()
  }, [platform.api])

  if (fatalError) {
    return <AppErrorPage error={fatalError} onReload={handleReload} />
  }

  return (
    <AppErrorBoundary onError={reportFatalError}>
      <App />
    </AppErrorBoundary>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <AppPlatformProvider>
        <AppRoot />
      </AppPlatformProvider>
    </TooltipProvider>
  </StrictMode>
)
