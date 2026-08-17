import { useEffect, useState, type ReactElement } from 'react'
import { AlertCircle, Popover, PopoverContent, PopoverTrigger, WorkspaceIconButton, X } from '../ui'

export const PYTHON_TRUST_TITLE = 'Local Python trust boundary'
export const PYTHON_TRUST_DESCRIPTION =
  'Python runs as a local process with the same OS access as the app. Keep code trusted, request only the permissions it needs, and review proposed actions.'

const TRUST_NOTICE_DISMISSED_PREFIX = 'xingularity:scheduling-python-trust-notice:'

function getDismissalStorageKey(vaultRoot: string | null | undefined): string {
  return `${TRUST_NOTICE_DISMISSED_PREFIX}${vaultRoot ?? 'default'}`
}

function readDismissal(vaultRoot: string | null | undefined): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(getDismissalStorageKey(vaultRoot)) === 'true'
  } catch {
    return false
  }
}

function rememberDismissal(vaultRoot: string | null | undefined): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(getDismissalStorageKey(vaultRoot), 'true')
  } catch {
    // Local storage can be unavailable in locked-down renderer environments.
  }
}

export interface SchedulingPythonTrustPopoverProps {
  vaultRoot?: string | null
}

export function SchedulingPythonTrustPopover({
  vaultRoot = null
}: SchedulingPythonTrustPopoverProps): ReactElement {
  const [noticeDismissed, setNoticeDismissed] = useState(() => readDismissal(vaultRoot))

  useEffect(() => {
    setNoticeDismissed(readDismissal(vaultRoot))
  }, [vaultRoot])

  const dismissNotice = (): void => {
    rememberDismissal(vaultRoot)
    setNoticeDismissed(true)
  }

  return (
    <Popover>
      <div className="flex items-center gap-1.5">
        <PopoverTrigger asChild>
          <WorkspaceIconButton
            type="button"
            data-testid="scheduling-python-trust-trigger"
            aria-label="Read local Python trust guidance"
            title="Read local Python trust guidance"
            icon={<AlertCircle aria-hidden="true" />}
          />
        </PopoverTrigger>
        {!noticeDismissed ? (
          <div
            role="status"
            data-testid="scheduling-python-trust-attention"
            className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-warning-border bg-warning-muted px-2.5 text-xs font-semibold text-warning-muted-foreground shadow-sm"
          >
            <span
              aria-hidden="true"
              className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rotate-45 border-b border-l border-warning-border bg-warning-muted"
            />
            <AlertCircle size={14} aria-hidden="true" />
            <span>Review Python safety</span>
            <button
              type="button"
              onClick={dismissNotice}
              aria-label="Dismiss Python safety notice"
              title="Dismiss Python safety notice"
              className="relative inline-flex size-5 items-center justify-center rounded-full hover:bg-warning-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="scheduling-python-trust-dismiss"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] border-warning-border bg-warning-muted p-4"
        aria-label={PYTHON_TRUST_TITLE}
        data-testid="scheduling-python-trust-popover"
      >
        <div className="flex gap-3">
          <AlertCircle
            className="mt-0.5 shrink-0 text-warning-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-semibold text-foreground">{PYTHON_TRUST_TITLE}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{PYTHON_TRUST_DESCRIPTION}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
