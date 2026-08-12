import { FormEvent, KeyboardEvent, ReactElement, useMemo, useState } from 'react'
import { FileText, ListTodo, MoreHorizontal, Trash2 } from '../components/ui/icons'
import {
  Badge,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Input,
  Shortcut
} from '../components/ui'
import { ActionButtonGroup } from '../components/ui/button-group'
import { WorkspacePage, WorkspacePageHeader, WorkspaceSectionCard } from '../components/workspace'
import type {
  FleetingConversionResult,
  FleetingConversionTarget,
  FleetingNote
} from '../../../shared/types'
import {
  FLEETING_NOTE_GROUPS,
  getFleetingNoteGroupColorStyles,
  groupFleetingNotes,
  type FleetingNoteGroup
} from '../lib/fleetingNoteGroups'

interface CapturePageProps {
  notes: FleetingNote[]
  isLoading: boolean
  onCapture: (content: string) => Promise<void>
  onRemove: (relPath: string) => Promise<void>
  onConvert: (
    relPath: string,
    target: FleetingConversionTarget
  ) => Promise<FleetingConversionResult>
}

export function CapturePage({
  notes,
  isLoading,
  onCapture,
  onRemove,
  onConvert
}: CapturePageProps): ReactElement {
  const [draft, setDraft] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [convertingPath, setConvertingPath] = useState<string | null>(null)
  const groupedNotes = useMemo(() => groupFleetingNotes(notes), [notes])
  const isBusy = isCapturing || convertingPath !== null

  const submitCapture = async (): Promise<void> => {
    const content = draft.trim()
    if (!content || isBusy) {
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
    if (isBusy) {
      return
    }

    setConvertingPath(relPath)
    try {
      await onConvert(relPath, target)
    } finally {
      setConvertingPath(null)
    }
  }

  const handleRemove = async (relPath: string): Promise<void> => {
    if (isBusy) {
      return
    }

    setConvertingPath(relPath)
    try {
      await onRemove(relPath)
    } finally {
      setConvertingPath(null)
    }
  }

  return (
    <WorkspacePage data-testid="capture-page">
      <WorkspacePageHeader
        heading="Quick Capture"
        className="items-center text-center lg:flex-col lg:items-center"
      />

      <WorkspaceSectionCard className="capture-dashed-border mx-auto w-full max-w-3xl bg-transparent p-8">
        <ActionButtonGroup
          role="group"
          aria-label="Quick capture"
          focusWithin="glow"
          className="w-full"
        >
          <form onSubmit={handleSubmit} className="min-w-0 flex-1" data-testid="quick-capture-form">
            <label htmlFor="capture-input" className="sr-only">
              Quick Capture
            </label>
            <Input
              id="capture-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  void submitCapture()
                }
              }}
              placeholder="Write a quick capture…"
              data-testid="capture-input"
              className="h-full rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-0"
              disabled={isBusy}
            />
          </form>
          <Shortcut
            keys={['cmd', 'return']}
            aria-label="Press Command Enter to save"
            className="shrink-0 rounded-none border-0 bg-transparent px-3 shadow-none"
          />
        </ActionButtonGroup>
      </WorkspaceSectionCard>

      <section className="space-y-3" data-testid="capture-review-zone" aria-label="Fleeting notes">
        <div className="flex items-center gap-3">
          <hr className="flex-1 border-border" aria-hidden="true" />
          <Badge variant="secondary">{notes.length}</Badge>
          <hr className="flex-1 border-border" aria-hidden="true" />
        </div>

        {isLoading ? (
          <div
            className="overflow-x-auto pb-2"
            data-testid="capture-loading-state"
            role="status"
            aria-label="Loading fleeting notes"
          >
            <div className="grid min-w-[64rem] grid-cols-4 items-start gap-3">
              {FLEETING_NOTE_GROUPS.map((group) => (
                <div
                  key={group.id}
                  className="flex h-fit max-h-[calc(100dvh-14rem)] min-h-72 flex-col overflow-hidden rounded-lg border bg-[var(--capture-group-bg)]"
                  data-testid={`capture-column:${group.id}`}
                >
                  <div className="px-3 py-2.5 text-sm font-semibold">
                    <span
                      className="inline-flex items-center rounded-[var(--radius-button)] border px-2 py-0.5"
                      style={getFleetingNoteGroupColorStyles(group)}
                    >
                      {group.label}
                    </span>
                  </div>
                  <div className="flex flex-1 items-center justify-center p-3 text-sm text-muted-foreground">
                    Loading…
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto pb-2" data-testid="capture-board">
              <div className="grid min-w-[64rem] grid-cols-4 items-start gap-3">
                {groupedNotes.map((group) => (
                  <FleetingNoteColumn
                    key={group.id}
                    group={group}
                    isBusy={isBusy}
                    onConvert={handleConvert}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </WorkspacePage>
  )
}

function FleetingNoteColumn({
  group,
  isBusy,
  onConvert,
  onRemove
}: {
  group: FleetingNoteGroup
  isBusy: boolean
  onConvert: (relPath: string, target: FleetingConversionTarget) => Promise<void>
  onRemove: (relPath: string) => Promise<void>
}): ReactElement {
  const groupColorStyles = getFleetingNoteGroupColorStyles(group)

  return (
    <section
      className="flex h-fit max-h-[calc(100dvh-14rem)] min-h-72 min-w-0 flex-col overflow-hidden rounded-lg border bg-[var(--capture-group-bg)]"
      data-testid={`capture-column:${group.id}`}
      aria-label={group.label}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">
          <span
            className="inline-flex items-center rounded-[var(--radius-button)] border px-2 py-0.5"
            style={groupColorStyles}
          >
            {group.label}
          </span>
        </h3>
        <Badge variant={group.notes.length > 0 ? 'secondary' : 'outline'}>
          {group.notes.length}
        </Badge>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-3">
          {group.notes.length > 0 ? (
            group.notes.map((note) => (
              <FleetingNoteCard
                key={note.relPath}
                note={note}
                isBusy={isBusy}
                onConvert={onConvert}
                onRemove={onRemove}
              />
            ))
          ) : (
            <p className="flex min-h-24 flex-1 items-center justify-center text-center text-xs text-muted-foreground">
              No captures
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function FleetingNoteCard({
  note,
  isBusy,
  onConvert,
  onRemove
}: {
  note: FleetingNote
  isBusy: boolean
  onConvert: (relPath: string, target: FleetingConversionTarget) => Promise<void>
  onRemove: (relPath: string) => Promise<void>
}): ReactElement {
  const createdAt = new Date(note.createdAt)
  const createdLabel = Number.isNaN(createdAt.getTime())
    ? 'Unknown time'
    : createdAt.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          key={note.relPath}
          data-testid={`fleeting-note:${note.id}`}
          className="relative bg-[var(--capture-card-bg)] transition-colors duration-150 hover:bg-[var(--capture-card-hover-bg)]"
        >
          <button
            type="button"
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={(event) => {
              event.currentTarget.dispatchEvent(
                new MouseEvent('contextmenu', {
                  bubbles: true,
                  button: 2,
                  clientX: event.clientX,
                  clientY: event.clientY
                })
              )
            }}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (event.key !== 'Enter' && event.key !== ' ') {
                return
              }

              event.preventDefault()
              event.currentTarget.dispatchEvent(
                new MouseEvent('contextmenu', {
                  bubbles: true,
                  button: 2,
                  clientX: event.currentTarget.getBoundingClientRect().left,
                  clientY: event.currentTarget.getBoundingClientRect().top
                })
              )
            }}
          >
            <span className="block max-h-28 min-w-0 overflow-y-auto whitespace-pre-wrap break-words p-3 pb-2 text-sm font-medium leading-5 text-foreground">
              {note.content}
            </span>
            <time
              dateTime={note.createdAt}
              className="block px-3 pb-2 text-xs text-muted-foreground"
            >
              {createdLabel}
            </time>
            <span className="mx-3 block border-b border-border" aria-hidden="true" />
          </button>
          <div className="absolute right-3 top-3 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Open actions for capture ${note.id}`}
                  data-testid={`fleeting-menu:${note.id}`}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={isBusy}
                  onSelect={() => void onConvert(note.relPath, 'note')}
                >
                  <FileText aria-hidden="true" />
                  To Note
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isBusy}
                  onSelect={() => void onConvert(note.relPath, 'task')}
                >
                  <ListTodo aria-hidden="true" />
                  To Task
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isBusy}
                  destructive
                  onSelect={() => void onRemove(note.relPath)}
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled={isBusy} onSelect={() => void onConvert(note.relPath, 'note')}>
          <FileText aria-hidden="true" />
          To Note
        </ContextMenuItem>
        <ContextMenuItem disabled={isBusy} onSelect={() => void onConvert(note.relPath, 'task')}>
          <ListTodo aria-hidden="true" />
          To Task
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={isBusy} destructive onSelect={() => void onRemove(note.relPath)}>
          <Trash2 aria-hidden="true" />
          Remove
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
