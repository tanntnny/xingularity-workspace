import { useState } from 'react'
import type { AppErrorEvent } from '../../../shared/types'
import { formatAppErrorDetails, formatAppErrorSource } from '../../../shared/appErrors'

interface AppErrorPageProps {
  error: AppErrorEvent
  onReload: () => Promise<void> | void
}

export function AppErrorPage({ error, onReload }: AppErrorPageProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [isReloading, setIsReloading] = useState(false)

  const details = formatAppErrorDetails(error)

  const handleCopy = async (): Promise<void> => {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus('failed')
      return
    }

    try {
      await navigator.clipboard.writeText(details)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  const handleReload = async (): Promise<void> => {
    setIsReloading(true)
    try {
      await onReload()
    } finally {
      setIsReloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
      <div className="mx-auto grid max-w-5xl gap-6 overflow-hidden rounded-lg border border-[var(--destructive)]/40 bg-[var(--panel)] shadow-[0_36px_120px_rgba(15,23,42,0.18)]">
        <div className="bg-[linear-gradient(135deg,rgba(220,38,38,0.16),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-8 py-7">
          <div className="mb-4 inline-flex items-center rounded-lg border border-[var(--destructive)]/35 bg-[var(--destructive)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--destructive)]">
            Fatal Application Error
          </div>
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-[-0.03em]">
              Xingularity could not continue.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              A blocking error stopped the app. Reload to start a fresh renderer session. Copy the
              details below if you need to report the failure.
            </p>
          </div>
        </div>

        <div className="grid gap-5 px-8 pb-8">
          <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1 font-medium">
                {formatAppErrorSource(error.source)}
              </span>
              {error.channel ? (
                <span className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1 font-mono text-xs">
                  {error.channel}
                </span>
              ) : null}
            </div>
            <p className="text-base font-medium leading-7">{error.message}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleReload()}
                disabled={isReloading}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {isReloading ? 'Reloading...' : 'Reload app'}
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-sm font-medium transition hover:border-[var(--accent-line)] hover:text-[var(--accent)]"
              >
                {copyStatus === 'copied'
                  ? 'Copied'
                  : copyStatus === 'failed'
                    ? 'Copy failed'
                    : 'Copy details'}
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Error details
            </p>
            <pre className="max-h-[52vh] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-5 text-xs leading-6 whitespace-pre-wrap">
              {details}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
