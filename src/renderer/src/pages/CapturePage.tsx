import { FormEvent, ReactElement, useState } from 'react'
import { CheckCircle2, Clock, FileText, ListTodo, Rocket } from '../components/ui/icons'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Textarea
} from '../components/ui'
import { WorkspacePage, WorkspacePageHeader, WorkspaceSectionCard } from '../components/workspace'
import type {
  FleetingConversionResult,
  FleetingConversionTarget,
  FleetingNote
} from '../../../shared/types'

interface CapturePageProps {
  notes: FleetingNote[]
  isLoading: boolean
  onCapture: (content: string) => Promise<void>
  onConvert: (
    relPath: string,
    target: FleetingConversionTarget
  ) => Promise<FleetingConversionResult>
}

export function CapturePage({
  notes,
  isLoading,
  onCapture,
  onConvert
}: CapturePageProps): ReactElement {
  const [draft, setDraft] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [convertingPath, setConvertingPath] = useState<string | null>(null)

  const submitCapture = async (): Promise<void> => {
    const content = draft.trim()
    if (!content || isCapturing) {
      return
    }

    setIsCapturing(true)
    try {
      await onCapture(content)
      setDraft('')
    } finally {
      setIsCapturing(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    void submitCapture()
  }

  const handleConvert = async (
    relPath: string,
    target: FleetingConversionTarget
  ): Promise<void> => {
    if (convertingPath) {
      return
    }

    setConvertingPath(relPath)
    try {
      await onConvert(relPath, target)
    } finally {
      setConvertingPath(null)
    }
  }

  return (
    <WorkspacePage data-testid="capture-page">
      <WorkspacePageHeader
        heading="Capture"
        icon={<Rocket size={24} aria-hidden="true" className="text-primary" />}
      />

      <WorkspaceSectionCard>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="quick-capture-form">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Quick capture</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Capture a thought, reminder, or idea without deciding where it belongs yet.
            </p>
          </div>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                void submitCapture()
              }
            }}
            placeholder="What is on your mind?"
            aria-label="Quick capture"
            data-testid="capture-input"
            className="min-h-32 resize-y"
            disabled={isCapturing}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Press Cmd/Ctrl+Enter to save</p>
            <Button
              type="submit"
              disabled={!draft.trim() || isCapturing}
              data-testid="capture-submit"
              className="gap-2"
            >
              <Rocket size={16} aria-hidden="true" />
              {isCapturing ? 'Capturing…' : 'Capture'}
            </Button>
          </div>
        </form>
      </WorkspaceSectionCard>

      <section
        className="space-y-4"
        data-testid="capture-review-zone"
        aria-labelledby="review-heading"
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Review zone</p>
            <h2 id="review-heading" className="mt-1 text-2xl font-semibold tracking-tight">
              Fleeting notes
            </h2>
          </div>
          <Badge variant="secondary">{notes.length}</Badge>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Loading captures…
            </CardContent>
          </Card>
        ) : notes.length === 0 ? (
          <EmptyState
            data-testid="capture-empty-state"
            icon={CheckCircle2}
            title="Nothing to review"
            description="New captures will wait here until you turn them into a note or task."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {notes.map((note) => {
              const isConverting = convertingPath === note.relPath
              return (
                <Card key={note.relPath} data-testid={`fleeting-note:${note.id}`}>
                  <CardHeader className="gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="flex min-w-0 items-center gap-2 text-base">
                        <Clock
                          size={16}
                          aria-hidden="true"
                          className="shrink-0 text-muted-foreground"
                        />
                        <span className="truncate">Captured thought</span>
                      </CardTitle>
                      <time
                        dateTime={note.createdAt}
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {new Date(note.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                      {note.content}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isConverting}
                        data-testid={`fleeting-convert-note:${note.id}`}
                        onClick={() => void handleConvert(note.relPath, 'note')}
                        className="gap-2"
                      >
                        <FileText size={15} aria-hidden="true" />
                        Convert to note
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isConverting}
                        data-testid={`fleeting-convert-task:${note.id}`}
                        onClick={() => void handleConvert(note.relPath, 'task')}
                        className="gap-2"
                      >
                        <ListTodo size={15} aria-hidden="true" />
                        Convert to task
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </WorkspacePage>
  )
}
