import { FileDown, FileText } from './ui/icons'
import { ReactElement } from 'react'
import {
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogShell,
  DialogShellHeader,
  DialogShellFooter
} from './ui/dialog'
import { buttonVariants } from './ui/button'
import { cn } from '../lib/utils'

export type NoteExportFormat = 'markdown' | 'pdf'

interface NoteExportDialogProps {
  open: boolean
  format: NoteExportFormat
  isExporting: boolean
  onOpenChange: (open: boolean) => void
  onFormatChange: (format: NoteExportFormat) => void
  onExport: () => void
}

const EXPORT_OPTIONS: Array<{
  format: NoteExportFormat
  title: string
  description: string
  Icon: typeof FileText
}> = [
  {
    format: 'markdown',
    title: 'Markdown',
    description: 'Save the editable source note as a .md file.',
    Icon: FileText
  },
  {
    format: 'pdf',
    title: 'PDF',
    description: 'Save a polished document with embedded vault images.',
    Icon: FileDown
  }
]

export function NoteExportDialog({
  open,
  format,
  isExporting,
  onOpenChange,
  onFormatChange,
  onExport
}: NoteExportDialogProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="note-export-dialog" showCloseButton={false}>
        <DialogShell>
          <DialogShellHeader
            context="Note"
            title="Export note"
            closeLabel="Close export dialog"
            closeDisabled={isExporting}
            onClose={() => onOpenChange(false)}
          />

          <DialogBody>
            <DialogDescription className="mb-3">
              Choose a file format for the current note.
            </DialogDescription>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Export format</legend>
              {EXPORT_OPTIONS.map(({ format: optionFormat, title, description, Icon }) => {
                const isSelected = format === optionFormat

                return (
                  <label
                    key={optionFormat}
                    data-testid={`note-export-format:${optionFormat}`}
                    className={cn(
                      buttonVariants({ variant: isSelected ? 'secondary' : 'outline' }),
                      'h-auto cursor-pointer flex-col items-start whitespace-normal p-4 text-left focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background'
                    )}
                  >
                    <input
                      type="radio"
                      name="note-export-format"
                      value={optionFormat}
                      checked={isSelected}
                      onChange={() => onFormatChange(optionFormat)}
                      className="sr-only"
                    />
                    <Icon className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
                    <span className="font-semibold text-foreground">{title}</span>
                    <span className="mt-1 text-sm text-muted-foreground">{description}</span>
                  </label>
                )
              })}
            </fieldset>
          </DialogBody>

          <DialogShellFooter>
            <DialogActionButton
              icon={<FileDown />}
              label={isExporting ? 'Exporting…' : `Export ${format === 'pdf' ? 'PDF' : 'Markdown'}`}
              tone="accent"
              onClick={onExport}
              disabled={isExporting}
            />
          </DialogShellFooter>
        </DialogShell>
      </DialogContent>
    </Dialog>
  )
}
