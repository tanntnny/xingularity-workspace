import type { ReactElement, ReactNode, RefObject } from 'react'
import { Check, Maximize, Trash2 } from './ui/icons'
import { Input } from './ui/input'
import { WorkspaceIconButton } from './ui/document-workspace'
import {
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogContent,
  DialogShell,
  DialogShellFooter,
  DialogShellHeader
} from './ui/dialog'

interface WorkspaceCenterEditDialogProps {
  context: ReactNode
  title: ReactNode
  titleValue: string
  titleInputId: string
  titleInputLabel: string
  titleInputPlaceholder: string
  titleInputTestId: string
  titleInputRef: RefObject<HTMLInputElement | null>
  isNew?: boolean
  dialogTestId: string
  headerTestId: string
  closeTestId: string
  openFullPageTestId?: string
  children: ReactNode
  onTitleChange: (value: string) => void
  onClose: () => void | Promise<void>
  onOpenFullPage?: () => void | Promise<void>
  onDelete: () => void
  onSave: () => void | Promise<void>
  closeLabel: string
  deleteLabel: string
  saveLabel: string
}

export function WorkspaceCenterEditDialog({
  context,
  title,
  titleValue,
  titleInputId,
  titleInputLabel,
  titleInputPlaceholder,
  titleInputTestId,
  titleInputRef,
  isNew = false,
  dialogTestId,
  headerTestId,
  closeTestId,
  openFullPageTestId,
  children,
  onTitleChange,
  onClose,
  onOpenFullPage,
  onDelete,
  onSave,
  closeLabel,
  deleteLabel,
  saveLabel
}: WorkspaceCenterEditDialogProps): ReactElement {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void onClose()
      }}
    >
      <DialogContent
        className="max-h-[min(760px,calc(100vh-2rem))] overflow-hidden"
        data-testid={dialogTestId}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          if (!isNew) return
          event.preventDefault()
          window.requestAnimationFrame(() => titleInputRef.current?.focus())
        }}
      >
        <DialogShell>
          <DialogShellHeader
            data-testid={headerTestId}
            context={context}
            title={<span>{title}</span>}
            closeLabel={closeLabel}
            onClose={() => void onClose()}
            closeTestId={closeTestId}
            actions={
              onOpenFullPage ? (
                <WorkspaceIconButton
                  onClick={() => void onOpenFullPage()}
                  aria-label="Open full page"
                  title="Open full page"
                  icon={<Maximize />}
                  borderless
                  data-testid={openFullPageTestId}
                />
              ) : undefined
            }
          />
          <div data-testid={`${dialogTestId}-title-input-row`} className="min-w-0 pb-2">
            <Input
              ref={titleInputRef}
              id={titleInputId}
              data-testid={titleInputTestId}
              type="text"
              variant="plain"
              value={titleValue}
              onChange={(event) => onTitleChange(event.target.value)}
              aria-label={titleInputLabel}
              placeholder={titleInputPlaceholder}
              autoFocus={isNew}
              className="h-auto min-h-9 text-2xl font-semibold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <DialogBody className="overflow-y-auto pr-1">{children}</DialogBody>
          <DialogShellFooter
            leadingAction={
              <DialogActionButton
                onClick={onDelete}
                title={deleteLabel}
                aria-label={deleteLabel}
                icon={<Trash2 />}
              />
            }
          >
            <DialogActionButton
              onClick={onSave}
              title={saveLabel}
              aria-label={saveLabel}
              icon={<Check />}
              label={saveLabel}
              tone="accent"
            />
          </DialogShellFooter>
        </DialogShell>
      </DialogContent>
    </Dialog>
  )
}
