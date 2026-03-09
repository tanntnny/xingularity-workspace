import { ReactElement, useEffect } from 'react'
import { toast } from 'sonner'
import { useVaultStore } from '../state/store'
import { Toaster } from './ui/sonner'

/**
 * SonnerBridge - Bridges the existing Zustand toast store with Sonner
 * This allows us to keep the existing pushToast API while using Sonner for rendering
 */
export function SonnerBridge(): ReactElement {
  const toasts = useVaultStore((state) => state.toasts)
  const removeToast = useVaultStore((state) => state.removeToast)

  useEffect(() => {
    // Process any new toasts from the store and show them via Sonner
    toasts.forEach((t) => {
      const toastFn =
        t.kind === 'error' ? toast.error : t.kind === 'success' ? toast.success : toast

      toastFn(t.message, {
        id: t.id,
        duration: 3000,
        onDismiss: () => removeToast(t.id),
        onAutoClose: () => removeToast(t.id)
      })
    })
  }, [toasts, removeToast])

  return <Toaster position="bottom-right" richColors closeButton />
}
