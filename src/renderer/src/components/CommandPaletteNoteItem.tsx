import { Fragment, type ComponentPropsWithoutRef, type ReactElement } from 'react'

import type { FolderColorMap } from '../../../shared/folderColors'
import { getCommandPaletteFolderBreadcrumbs } from '../lib/commandPaletteNoteRows'
import type { CommandPaletteSearchHighlights } from '../lib/commandPaletteSearch'
import { cn } from '../lib/utils'
import { ChevronRight, FileText, HourglassEmpty } from './ui/icons'
import { NotebookFolderIcon } from './ui/notebook-folder-icon'
import { CommandItem } from './ui/command'
import { CommandPaletteMatchText } from './CommandPaletteMatchText'
import { WorkspaceTextFade } from './ui/workspace-text-fade'

const paletteItemIconClass =
  'mr-2 flex h-8 w-8 shrink-0 items-center justify-center text-primary transition-colors group-data-[selected=true]:text-primary'
const paletteItemStatusClass =
  'ml-auto flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors group-data-[selected=true]:text-foreground'

type CommandPaletteNoteItemProps = Omit<
  ComponentPropsWithoutRef<typeof CommandItem>,
  'children' | 'variant'
> & {
  title: string
  relPath: string
  folderColors: FolderColorMap
  highlights?: CommandPaletteSearchHighlights
  snippet?: string
}

interface CommandPaletteNoteItemContentProps {
  title: string
  relPath: string
  folderColors: FolderColorMap
  highlights?: CommandPaletteSearchHighlights
  snippet?: string
}

export function CommandPaletteNoteItem({
  title,
  relPath,
  folderColors,
  highlights,
  snippet,
  className,
  ...props
}: CommandPaletteNoteItemProps): ReactElement {
  return (
    <CommandItem
      {...props}
      className={cn('group', className)}
      data-testid="command-palette-note-row"
      data-note-path={relPath}
      variant="palette"
    >
      <CommandPaletteNoteItemContent
        title={title}
        relPath={relPath}
        folderColors={folderColors}
        highlights={highlights}
        snippet={snippet}
      />
    </CommandItem>
  )
}

export function CommandPaletteNoteItemContent({
  title,
  relPath,
  folderColors,
  highlights,
  snippet
}: CommandPaletteNoteItemContentProps): ReactElement {
  const folderBreadcrumbs = getCommandPaletteFolderBreadcrumbs(relPath)

  return (
    <>
      <div className={paletteItemIconClass}>
        <FileText className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <WorkspaceTextFade
          className="block font-medium text-foreground"
          observeMutations={false}
          data-testid="command-palette-note-title"
        >
          <CommandPaletteMatchText text={title} ranges={highlights?.title} />
        </WorkspaceTextFade>
        <div
          className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
          data-testid="command-palette-note-folder-path"
        >
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {folderBreadcrumbs.map(({ label, path }, index) => (
              <Fragment key={`${index}:${path ?? label}`}>
                {index > 0 ? (
                  <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : null}
                <div className="flex min-w-0 shrink items-center gap-1">
                  <NotebookFolderIcon
                    variant={index === folderBreadcrumbs.length - 1 ? 'open' : 'closed'}
                    color={path ? folderColors[path] : undefined}
                    size={10}
                  />
                  <WorkspaceTextFade className="min-w-0 shrink" observeMutations={false}>
                    <CommandPaletteMatchText text={label} ranges={highlights?.folders?.[index]} />
                  </WorkspaceTextFade>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
        {snippet ? (
          <WorkspaceTextFade
            className="text-xs text-muted-foreground"
            observeMutations={false}
            data-testid="command-palette-note-excerpt"
          >
            <CommandPaletteMatchText text={snippet} ranges={highlights?.excerpt} />
          </WorkspaceTextFade>
        ) : null}
      </div>
      <div className={paletteItemStatusClass}>
        <HourglassEmpty className="h-4 w-4" aria-hidden="true" />
      </div>
    </>
  )
}
