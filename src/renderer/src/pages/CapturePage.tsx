import { FormEvent, KeyboardEvent, ReactElement, useMemo, useState } from 'react'
import {
  FileText,
  Flag,
  ListTodo,
  MoreHorizontal,
  Trash2,
  Link,
  Loader2
} from '../components/ui/icons'
import {
  ActionMenuItems,
  Badge,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  Button,
  Input,
  StatusChip,
  type ActionMenuGroup
} from '../components/ui'
import { ActionButtonGroup } from '../components/ui/button-group'
import { Shortcut } from '../components/ui/kbd'
import { handleCommandEnterSubmit } from '../lib/formShortcuts'
import { WorkspacePage, WorkspacePageHeader, WorkspaceSectionCard } from '../components/workspace'
import type {
  FleetingConversionResult,
  FleetingConversionTarget,
  FleetingNote,
  ResourceRef
} from '../../../shared/types'
import {
  FLEETING_NOTE_GROUPS,
  getFleetingNoteGroupColorStyles,
  groupFleetingNotes,
  type FleetingNoteGroup
} from '../lib/fleetingNoteGroups'
import {
  FLEETING_NOTE_TRIAGE_CHIP_ITEMS,
  getTaskPriorityChipItem,
  RESOURCE_STATE_CHIP_ITEMS
} from '../lib/statusChipMeta'

interface CapturePageProps {
  notes: FleetingNote[]
  isLoading: boolean
  onCapture: (content: string) => Promise<void>
  onRemove: (relPath: string) => Promise<void>
  onUpdate: (
    relPath: string,
    patch: Partial<Pick<FleetingNote, 'priority' | 'triageState'>>
  ) => Promise<void>
  onConvert: (
    relPath: string,
    target: FleetingConversionTarget
  ) => Promise<FleetingConversionResult>
  resources: ResourceRef[]
  onCaptureResource: (canonicalUri: string) => Promise<void>
  onOpenResource: (resourceId: string) => Promise<void>
}

export function CapturePage({
  notes,
  isLoading,
  onCapture,
  onRemove,
  onUpdate,
  onConvert,
  resources,
  onCaptureResource,
  onOpenResource
}: CapturePageProps): ReactElement {
  const [draft, setDraft] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [convertingPath, setConvertingPath] = useState<string | null>(null)
  const [resourceDraft, setResourceDraft] = useState('')
  const [resourceBusy, setResourceBusy] = useState(false)
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

  const submitResourceCapture = async (): Promise<void> => {
    const value = resourceDraft.trim()
    if (!value || resourceBusy) return
    setResourceBusy(true)
    try {
      await onCaptureResource(value)
      setResourceDraft('')
    } finally {
      setResourceBusy(false)
    }
  }

  const captureFileResource = async (file: File | undefined): Promise<void> => {
    const selectedPath = (file as (File & { path?: string }) | undefined)?.path
    if (!selectedPath || resourceBusy) return
    setResourceBusy(true)
    try {
      await onCaptureResource(selectedPath)
    } finally {
      setResourceBusy(false)
    }
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
          <form
            onSubmit={handleSubmit}
            onKeyDownCapture={handleCommandEnterSubmit}
            className="min-w-0 flex-1"
            data-testid="quick-capture-form"
          >
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
            aria-label="Press Return or Command Enter to save"
            className="shrink-0 rounded-none border-0 bg-transparent px-3 shadow-none"
          />
        </ActionButtonGroup>
      </WorkspaceSectionCard>

      <WorkspaceSectionCard
        className="mx-auto w-full max-w-3xl border-dashed bg-transparent p-4"
        data-testid="capture-resource-inbox"
      >
        <div className="mb-3 flex items-center gap-2">
          <Link size={16} className="text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold">Source-preserving resource capture</h2>
            <p className="text-xs text-muted-foreground">
              Save a path or URL now; decide where it belongs during review.
            </p>
          </div>
        </div>
        <form
          className="flex items-center gap-2"
          onKeyDownCapture={handleCommandEnterSubmit}
          onSubmit={(event) => {
            event.preventDefault()
            void submitResourceCapture()
          }}
        >
          <label htmlFor="capture-resource-input" className="sr-only">
            Capture a file path or URL
          </label>
          <Input
            id="capture-resource-input"
            value={resourceDraft}
            onChange={(event) => setResourceDraft(event.target.value)}
            placeholder="/Users/you/Documents/brief.pdf or https://…"
            className="h-9"
            disabled={resourceBusy}
          />
          <Button type="submit" size="sm" disabled={!resourceDraft.trim() || resourceBusy}>
            {resourceBusy ? <Loader2 size={14} className="mr-1 animate-pulse" /> : null}
            Save source
          </Button>
          <label htmlFor="capture-resource-file" className="shrink-0">
            <Button type="button" variant="outline" size="sm" asChild disabled={resourceBusy}>
              <span>
                <FileText size={14} />
                Choose file
              </span>
            </Button>
            <Input
              id="capture-resource-file"
              type="file"
              className="sr-only"
              onChange={(event) => {
                void captureFileResource(event.target.files?.[0])
                event.currentTarget.value = ''
              }}
              disabled={resourceBusy}
            />
          </label>
        </form>
        {resources.length > 0 ? (
          <div className="mt-3 space-y-1" aria-label="Captured sources">
            {resources.slice(0, 5).map((resource) => (
              <button
                key={resource.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60"
                onClick={() => void onOpenResource(resource.id)}
              >
                <Link size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{resource.title}</span>
                <StatusChip item={RESOURCE_STATE_CHIP_ITEMS[resource.state]} />
              </button>
            ))}
          </div>
        ) : null}
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
                      className="inline-flex min-w-0 max-w-full items-center rounded-[var(--radius-button)] border px-2 py-0.5"
                      style={getFleetingNoteGroupColorStyles(group)}
                    >
                      <span className="min-w-0 truncate">{group.label}</span>
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
                    onUpdate={onUpdate}
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
  onRemove,
  onUpdate
}: {
  group: FleetingNoteGroup
  isBusy: boolean
  onConvert: (relPath: string, target: FleetingConversionTarget) => Promise<void>
  onRemove: (relPath: string) => Promise<void>
  onUpdate: (
    relPath: string,
    patch: Partial<Pick<FleetingNote, 'priority' | 'triageState'>>
  ) => Promise<void>
}): ReactElement {
  const groupColorStyles = getFleetingNoteGroupColorStyles(group)

  return (
    <section
      className="flex h-fit max-h-[calc(100dvh-14rem)] min-h-72 min-w-0 flex-col overflow-hidden rounded-lg border bg-[var(--capture-group-bg)]"
      data-testid={`capture-column:${group.id}`}
      aria-label={group.label}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <h3 className="min-w-0 text-sm font-semibold text-foreground">
          <span
            className="inline-flex min-w-0 max-w-full items-center rounded-[var(--radius-button)] border px-2 py-0.5"
            style={groupColorStyles}
          >
            <span className="min-w-0 truncate">{group.label}</span>
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
                onUpdate={onUpdate}
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
  onRemove,
  onUpdate
}: {
  note: FleetingNote
  isBusy: boolean
  onConvert: (relPath: string, target: FleetingConversionTarget) => Promise<void>
  onRemove: (relPath: string) => Promise<void>
  onUpdate: (
    relPath: string,
    patch: Partial<Pick<FleetingNote, 'priority' | 'triageState'>>
  ) => Promise<void>
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

  const menuGroups: ActionMenuGroup[] = [
    {
      id: 'conversion',
      items: [
        {
          id: 'to-note',
          label: 'To Note',
          icon: <FileText aria-hidden="true" />,
          disabled: isBusy,
          onSelect: () => void onConvert(note.relPath, 'note')
        },
        {
          id: 'to-task',
          label: 'To Task',
          icon: <ListTodo aria-hidden="true" />,
          disabled: isBusy,
          onSelect: () => void onConvert(note.relPath, 'task')
        }
      ]
    },
    {
      id: 'triage',
      items: [
        {
          id: 'in-progress',
          label: 'Mark in progress',
          disabled: isBusy,
          onSelect: () => void onUpdate(note.relPath, { triageState: 'in-progress' })
        },
        {
          id: 'inbox',
          label: 'Return to inbox',
          disabled: isBusy,
          onSelect: () => void onUpdate(note.relPath, { triageState: 'inbox' })
        },
        {
          id: 'archive',
          label: 'Archive',
          disabled: isBusy,
          onSelect: () => void onUpdate(note.relPath, { triageState: 'archived' })
        }
      ]
    },
    {
      id: 'priority',
      items: [
        {
          id: 'set-priority',
          label: 'Set priority',
          icon: <Flag aria-hidden="true" />,
          submenu: [
            {
              id: 'high',
              label: 'High',
              disabled: isBusy,
              onSelect: () => void onUpdate(note.relPath, { priority: 'high' })
            },
            {
              id: 'medium',
              label: 'Medium',
              disabled: isBusy,
              onSelect: () => void onUpdate(note.relPath, { priority: 'medium' })
            },
            {
              id: 'low',
              label: 'Low',
              disabled: isBusy,
              onSelect: () => void onUpdate(note.relPath, { priority: 'low' })
            }
          ]
        }
      ]
    },
    {
      id: 'destructive',
      items: [
        {
          id: 'remove',
          label: 'Remove',
          icon: <Trash2 aria-hidden="true" />,
          destructive: true,
          disabled: isBusy,
          onSelect: () => void onRemove(note.relPath)
        }
      ]
    }
  ]

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
            <span className="flex flex-wrap gap-1 px-3 pb-2">
              <StatusChip item={FLEETING_NOTE_TRIAGE_CHIP_ITEMS[note.triageState ?? 'inbox']} />
              {note.priority ? (
                <StatusChip
                  item={{
                    ...getTaskPriorityChipItem(note.priority),
                    label: `${note.priority} priority`
                  }}
                />
              ) : null}
              {note.dueDate ? (
                <Badge variant="outline" className="text-[10px]">
                  due {note.dueDate}
                </Badge>
              ) : null}
            </span>
            <span className="mx-3 block border-b border-border" aria-hidden="true" />
          </button>
          <div className="absolute right-3 top-3 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="rowAction"
                  size="icon"
                  aria-label={`Open actions for capture ${note.id}`}
                  data-testid={`fleeting-menu:${note.id}`}
                  className="h-7 w-7 shrink-0 rounded-md"
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ActionMenuItems variant="dropdown" groups={menuGroups} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent data-testid={`fleeting-context-menu:${note.id}`}>
        <ActionMenuItems variant="context" groups={menuGroups} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
