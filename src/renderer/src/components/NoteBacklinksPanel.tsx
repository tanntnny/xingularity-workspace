import type { ReactElement } from 'react'

import { getNoteDisplayName, stripNoteExtension } from '../../../shared/noteDocument'
import type { NoteListItem } from '../../../shared/types'
import { TooltipButton } from './ui/tooltip'
import { WorkspaceTextFade } from './ui/workspace-text-fade'
import { isMiddleMouseButton, isModifiedNotebookOpen } from '../lib/notebookOpen'

interface NoteBacklinksPanelProps {
  backlinks: readonly Pick<NoteListItem, 'relPath'>[]
  onOpenBacklink: (relPath: string, options?: { openInNewTab?: boolean }) => void
}

export function NoteBacklinksPanel({
  backlinks,
  onOpenBacklink
}: NoteBacklinksPanelProps): ReactElement {
  return (
    <nav aria-label="Note backlinks" data-testid="note-backlinks-list" className="min-w-0 p-1">
      {backlinks.length > 0 ? (
        <ol className="space-y-0.5">
          {backlinks.map((note) => {
            const pathLabel = stripNoteExtension(note.relPath)

            return (
              <li key={note.relPath}>
                <TooltipButton label={`Open backlink: ${pathLabel}`}>
                  <button
                    type="button"
                    aria-label={`Open backlink: ${pathLabel}`}
                    data-testid={`note-backlink-item:${note.relPath}`}
                    className="flex w-full min-w-0 items-center rounded-[var(--radius-button)] px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(event) => {
                      if (isModifiedNotebookOpen(event)) {
                        event.preventDefault()
                        event.stopPropagation()
                        onOpenBacklink(note.relPath, { openInNewTab: true })
                        return
                      }

                      onOpenBacklink(note.relPath)
                    }}
                    onAuxClick={(event) => {
                      if (!isMiddleMouseButton(event)) {
                        return
                      }

                      event.preventDefault()
                      event.stopPropagation()
                      onOpenBacklink(note.relPath, { openInNewTab: true })
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <WorkspaceTextFade className="font-medium">
                        {getNoteDisplayName(note.relPath)}
                      </WorkspaceTextFade>
                      <WorkspaceTextFade className="max-w-full text-xs text-muted-foreground">
                        {pathLabel}
                      </WorkspaceTextFade>
                    </span>
                  </button>
                </TooltipButton>
              </li>
            )
          })}
        </ol>
      ) : null}
    </nav>
  )
}
