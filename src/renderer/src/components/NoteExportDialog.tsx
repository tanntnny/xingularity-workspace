import { FileDown, FileText } from './ui/icons'
import { ReactElement } from 'react'
import {
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogCloseAction,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogShell,
  DialogShellFooter,
  DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'

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
      <DialogContent className="max-w-xl" data-testid="note-export-dialog" showCloseButton={false}>
        <DialogShell>
          <DialogHeader>
            <DialogTitle>Export note</DialogTitle>
            <DialogDescription>Choose a file format for the current note.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Export format">
              {EXPORT_OPTIONS.map(({ format: optionFormat, title, description, Icon }) => {
                const isSelected = format === optionFormat

                return (
                  <Button
                    key={optionFormat}
                    type="button"
                    variant={isSelected ? 'secondary' : 'outline'}
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`note-export-format:${optionFormat}`}
                    onClick={() => onFormatChange(optionFormat)}
                    className="h-auto flex-col items-start whitespace-normal p-4 text-left"
                  >
                    <Icon className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
                    <div className="font-semibold text-foreground">{title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{description}</div>
                  </Button>
                )
              })}
            </div>
          </DialogBody>

          <DialogShellFooter
            closeAction={<DialogCloseAction label="Close export dialog" disabled={isExporting} />}
          >
            <DialogActionButton
              icon={<FileDown />}
              label={isExporting ? 'Exporting…' : `Export ${format === 'pdf' ? 'PDF' : 'Markdown'}`}
              tone="primary"
              onClick={onExport}
              disabled={isExporting}
            />
          </DialogShellFooter>
        </DialogShell>
      </DialogContent>
    </Dialog>
  )
}
