import './assets/main.css'

import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createAppErrorEvent } from '../../shared/appErrors'
import type { AppErrorEvent } from '../../shared/types'
import App from './App'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AppErrorPage } from './components/AppErrorPage'
import { installGlobalButtonRipple } from './lib/buttonRipple'
import { AppPlatformProvider, useAppPlatform } from './platform'

installGlobalButtonRipple()

function AppRoot() {
  const platform = useAppPlatform()
  const [fatalError, setFatalError] = useState<AppErrorEvent | null>(null)

  const reportFatalError = useCallback((error: AppErrorEvent) => {
    setFatalError((current) => current ?? error)
  }, [])

  useEffect(() => {
    const removeWindowError = (event: ErrorEvent): void => {
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
    <AppPlatformProvider>
      <AppRoot />
    </AppPlatformProvider>
  </StrictMode>
)
