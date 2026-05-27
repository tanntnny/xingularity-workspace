import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { type DialogProps } from '@radix-ui/react-dialog'
import { Search } from 'lucide-react'

import { cn } from '../../lib/utils'

export const palleteInputClassName =
  'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-[var(--muted-foreground)] disabled:cursor-not-allowed disabled:opacity-50'

type PalleteProps = DialogProps &
  Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'children'> & {
    children: React.ReactNode
  }

const Pallete = ({
  children,
  className,
  open,
  defaultOpen,
  onOpenChange,
  modal,
  ...contentProps
}: PalleteProps): React.ReactElement => {
  return (
    <DialogPrimitive.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      modal={modal}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-glass-overlay command-palette-overlay fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          {...contentProps}
          className={cn(
            'dialog-glass-surface command-palette-panel fixed left-1/2 top-[18vh] z-50 flex w-[min(720px,92vw)] -translate-x-1/2 overflow-hidden rounded-lg border-[var(--accent)] p-0 outline-none',
            className
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

const PalleteSearchBar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center border-b border-[color:color-mix(in_srgb,var(--accent-line)_22%,var(--line))] bg-[color:color-mix(in_srgb,var(--accent-soft)_36%,transparent)] px-3',
        className
      )}
      {...props}
    >
      <Search className="mr-2 h-4 w-4 shrink-0 text-[var(--accent)] opacity-75" />
      {children}
    </div>
  )
)

interface PalleteInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const PalleteInput = React.forwardRef<HTMLInputElement, PalleteInputProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(palleteInputClassName, className)} {...props} />
  )
)
PalleteSearchBar.displayName = 'PalleteSearchBar'
PalleteInput.displayName = 'PalleteInput'

export { Pallete, PalleteSearchBar, PalleteInput }
