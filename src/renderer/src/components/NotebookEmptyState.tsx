import type { ReactElement } from 'react'
import { Button } from './ui/button'
import { FileText, PenTool, Plus } from './ui/icons'
import { EmptyState } from './ui/empty-state'
import { stripNotebookFileExtension } from '../../../shared/excalidrawFile'
import { APP_PAGE_ICONS } from '../lib/pageIcons'

export interface RecentNotebookFile {
  kind: 'note' | 'excalidraw'
  relPath: string
}

interface NotebookEmptyStateProps {
  recentFiles: RecentNotebookFile[]
  onOpenFile: (relPath: string) => void
  onCreateNote: () => void
}

export function NotebookEmptyState({
  recentFiles,
  onOpenFile,
  onCreateNote
}: NotebookEmptyStateProps): ReactElement {
  const hasRecentFiles = recentFiles.length > 0

  return (
    <EmptyState
      data-testid="notebook-empty-state"
      className="h-full"
      icon={APP_PAGE_ICONS.notes}
      title={hasRecentFiles ? 'Pick up where you left off' : 'Start a new notebook'}
      description={
        hasRecentFiles
          ? 'Open a recent file or choose one from the notebook tree.'
          : 'Create a note to begin writing in this notebook.'
      }
    >
      <div className="flex flex-col gap-4">
        {hasRecentFiles ? (
          <div className="text-left">
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recent files
            </p>
            <ul className="space-y-1" aria-label="Recent notebook files">
              {recentFiles.map((file) => {
                const displayName = stripNotebookFileExtension(file.relPath.split('/').pop() ?? '')
                const FileIcon = file.kind === 'excalidraw' ? PenTool : FileText

                return (
                  <li key={file.relPath}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-10 w-full justify-start gap-3 rounded-lg px-3 py-2 text-left"
                      aria-label={`Open ${displayName}`}
                      onClick={() => onOpenFile(file.relPath)}
                    >
                      <FileIcon
                        size={17}
                        className="shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {displayName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {file.relPath}
                        </span>
                      </span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
        <Button
          type="button"
          variant="default"
          className="self-center gap-2"
          onClick={onCreateNote}
        >
          <Plus size={16} aria-hidden="true" />
          New note
        </Button>
      </div>
    </EmptyState>
  )
}
