import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { type DialogProps } from '@radix-ui/react-dialog'
import { Search } from './icons'

import { cn } from '../lib/utils'

export const palleteInputClassName =
  'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'

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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          {...contentProps}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex w-[min(860px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-lg outline-none',
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
    <div ref={ref} className={cn('flex items-center border-b px-3', className)} {...props}>
      <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
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
