import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { ChevronRight, MoreHorizontal } from './icons'

import { cn } from '../../lib/utils'

const breadcrumbEntryClassName =
  'inline-flex min-h-7 max-w-full items-center rounded-[var(--radius-button)] px-2 py-1'

const breadcrumbInteractiveClassName = cn(
  breadcrumbEntryClassName,
  'transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
)

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'> & {
    separator?: React.ReactNode
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />)
Breadcrumb.displayName = 'Breadcrumb'

const BreadcrumbList = React.forwardRef<HTMLOListElement, React.ComponentPropsWithoutRef<'ol'>>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn(
        'flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5',
        className
      )}
      {...props}
    />
  )
)
BreadcrumbList.displayName = 'BreadcrumbList'

const BreadcrumbItem = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<'li'>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn('inline-flex items-center gap-1.5', className)} {...props} />
  )
)
BreadcrumbItem.displayName = 'BreadcrumbItem'

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & {
    asChild?: boolean
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : 'a'

  return <Comp ref={ref} className={cn(breadcrumbInteractiveClassName, className)} {...props} />
})
BreadcrumbLink.displayName = 'BreadcrumbLink'

const BreadcrumbButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'>
>(({ className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn('app-no-drag', breadcrumbInteractiveClassName, className)}
    {...props}
  />
))
BreadcrumbButton.displayName = 'BreadcrumbButton'

const BreadcrumbIconLabel = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'> & {
    icon: React.ReactNode
  }
>(({ children, className, icon, ...props }, ref) => (
  <span
    ref={ref}
    className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5', className)}
    {...props}
  >
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
      {icon}
    </span>
    <span className="min-w-0 truncate">{children}</span>
  </span>
))
BreadcrumbIconLabel.displayName = 'BreadcrumbIconLabel'

const BreadcrumbLabel = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<'span'>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(breadcrumbEntryClassName, 'font-normal text-muted-foreground', className)}
      {...props}
    />
  )
)
BreadcrumbLabel.displayName = 'BreadcrumbLabel'

const BreadcrumbPage = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<'span'>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      aria-current="page"
      className={cn(breadcrumbEntryClassName, 'font-normal text-foreground', className)}
      {...props}
    />
  )
)
BreadcrumbPage.displayName = 'BreadcrumbPage'

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<'li'>): React.ReactElement => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn('[&>svg]:h-3.5 [&>svg]:w-3.5', className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
)
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator'

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>): React.ReactElement => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn(
      'flex h-9 w-9 items-center justify-center rounded-[var(--radius-button)]',
      className
    )}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
)
BreadcrumbEllipsis.displayName = 'BreadcrumbEllipsis'

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbButton,
  BreadcrumbIconLabel,
  BreadcrumbLabel,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis
}
