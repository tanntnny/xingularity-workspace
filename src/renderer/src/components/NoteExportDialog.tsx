import { FileDown, FileText } from 'lucide-react'
import { ReactElement } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'

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
      <DialogContent className="max-w-xl" data-testid="note-export-dialog">
        <DialogHeader>
          <DialogTitle>Export note</DialogTitle>
          <DialogDescription>Choose a file format for the current note.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Export format">
          {EXPORT_OPTIONS.map(({ format: optionFormat, title, description, Icon }) => {
            const isSelected = format === optionFormat

            return (
              <button
                key={optionFormat}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`note-export-format:${optionFormat}`}
                onClick={() => onFormatChange(optionFormat)}
                className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--accent-line)] hover:bg-[var(--panel-2)]'
                }`}
              >
                <Icon className="mb-3 h-6 w-6 text-[var(--accent)]" aria-hidden="true" />
                <div className="font-semibold text-[var(--text)]">{title}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{description}</div>
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="workspace-subtle-control rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={isExporting}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? 'Exporting…' : `Export ${format === 'pdf' ? 'PDF' : 'Markdown'}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
