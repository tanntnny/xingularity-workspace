import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronRight, X } from './icons'

import { cn } from '../../lib/utils'
import { Button } from './button'
import { WorkspaceIconButton } from './document-workspace'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('motion-overlay fixed inset-0 z-50 bg-overlay', className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean
  }
>(({ className, children, showCloseButton = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'motion-dialog-content fixed left-1/2 top-1/2 z-50 grid w-[min(860px,92vw)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-dialog border border-border bg-panel p-6 text-foreground shadow-xl',
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 border-b border-border pb-3 text-center sm:text-left',
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = 'DialogHeader'

interface DialogShellHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  context: React.ReactNode
  title: React.ReactNode
  closeLabel: string
  onClose: () => void
  actions?: React.ReactNode
  closeDisabled?: boolean
  closeTestId?: string
}

const DialogShellHeader = ({
  context,
  title,
  closeLabel,
  onClose,
  actions,
  closeDisabled = false,
  closeTestId,
  className,
  ...props
}: DialogShellHeaderProps): React.ReactElement => (
  <DialogHeader
    className={cn('flex-row items-center justify-between gap-3 space-y-0 text-left', className)}
    {...props}
  >
    <DialogTitle className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
      <span className="shrink-0 text-muted-foreground">{context}</span>
      <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-foreground">{title}</span>
    </DialogTitle>
    <div className="flex shrink-0 items-center gap-1">
      {actions}
      <WorkspaceIconButton
        onClick={onClose}
        aria-label={closeLabel}
        title={closeLabel}
        icon={<X />}
        borderless
        disabled={closeDisabled}
        data-testid={closeTestId}
      />
    </div>
  </DialogHeader>
)
DialogShellHeader.displayName = 'DialogShellHeader'

const DialogShell = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement => (
  <div className={cn('flex min-h-0 flex-col gap-4', className)} {...props} />
)
DialogShell.displayName = 'DialogShell'

interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  style?: React.CSSProperties
}

const DialogBody = React.forwardRef<HTMLDivElement, DialogBodyProps>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      data-dialog-body
      className={cn('min-h-0', className)}
      style={{ '--radius-control': 'var(--radius-button)', ...style } as React.CSSProperties}
      {...props}
    />
  )
)
DialogBody.displayName = 'DialogBody'

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement => (
  <div
    className={cn(
      'flex flex-col-reverse border-t border-border pt-3 sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

interface DialogShellFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  closeAction?: React.ReactNode
  leadingAction?: React.ReactNode
}

const DialogShellFooter = ({
  className,
  closeAction,
  leadingAction,
  children,
  ...props
}: DialogShellFooterProps): React.ReactElement => {
  const leftAction = leadingAction ?? closeAction

  return (
    <div
      data-dialog-footer
      className={cn(
        'flex items-center justify-between gap-3 border-t border-border pt-3 [&_button]:rounded-[var(--radius-button-pill)]',
        className
      )}
      {...props}
    >
      {leftAction ? <div className="shrink-0">{leftAction}</div> : null}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  )
}
DialogShellFooter.displayName = 'DialogShellFooter'

interface DialogActionButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  icon: React.ReactNode
  label?: string
  tone?: 'default' | 'primary' | 'accent'
}

const DialogActionButton = React.forwardRef<
  React.ElementRef<typeof Button>,
  DialogActionButtonProps
>(({ className, icon, label, tone = 'default', type = 'button', ...props }, ref) => (
  <Button
    ref={ref}
    type={type}
    variant={tone === 'primary' ? 'default' : tone === 'accent' ? 'accent' : 'outline'}
    size={label ? 'sm' : 'icon'}
    className={cn(
      'shrink-0 rounded-[var(--radius-button-pill)] [&>svg]:h-3.5 [&>svg]:w-3.5',
      label && 'gap-1.5',
      className
    )}
    {...props}
  >
    {icon}
    {label ? <span>{label}</span> : null}
  </Button>
))
DialogActionButton.displayName = 'DialogActionButton'

interface DialogCloseActionProps extends Omit<DialogActionButtonProps, 'icon' | 'label' | 'tone'> {
  label?: string
}

const DialogCloseAction = React.forwardRef<HTMLButtonElement, DialogCloseActionProps>(
  ({ label = 'Close dialog', ...props }, ref) => (
    <DialogPrimitive.Close asChild>
      <DialogActionButton ref={ref} icon={<X />} title={label} aria-label={label} {...props} />
    </DialogPrimitive.Close>
  )
)
DialogCloseAction.displayName = 'DialogCloseAction'

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogShell,
  DialogHeader,
  DialogShellHeader,
  DialogBody,
  DialogFooter,
  DialogShellFooter,
  DialogActionButton,
  DialogCloseAction,
  DialogTitle,
  DialogDescription
}
