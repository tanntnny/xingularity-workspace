import { useState } from 'react'
import type { AppErrorEvent } from '../../../shared/types'
import { formatAppErrorDetails, formatAppErrorSource } from '../../../shared/appErrors'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader } from './ui/card'

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
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <Card className="mx-auto grid max-w-5xl gap-6 overflow-hidden border-destructive/40 shadow-sm">
        <CardHeader className="bg-destructive/10 px-8 py-7">
          <Badge variant="destructive" className="mb-4 w-fit uppercase tracking-wide">
            Fatal Application Error
          </Badge>
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Xingularity could not continue.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              A blocking error stopped the app. Reload to start a fresh renderer session. Copy the
              details below if you need to report the failure.
            </p>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5 px-8 pb-8">
          <section className="grid gap-3 rounded-lg border bg-muted p-5" aria-label="Error summary">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline" className="font-medium">
                {formatAppErrorSource(error.source)}
              </Badge>
              {error.channel ? (
                <Badge variant="outline" className="font-mono text-xs">
                  {error.channel}
                </Badge>
              ) : null}
            </div>
            <p className="text-base font-medium leading-7">{error.message}</p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => void handleReload()}
                disabled={isReloading}
                className="disabled:cursor-wait"
              >
                {isReloading ? 'Reloading...' : 'Reload app'}
              </Button>
              <Button type="button" onClick={() => void handleCopy()} variant="outline">
                {copyStatus === 'copied'
                  ? 'Copied'
                  : copyStatus === 'failed'
                    ? 'Copy failed'
                    : 'Copy details'}
              </Button>
            </div>
          </section>

          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Error details
            </p>
            <pre className="max-h-[52vh] overflow-auto rounded-lg border bg-muted p-5 text-xs leading-6 whitespace-pre-wrap">
              {details}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
