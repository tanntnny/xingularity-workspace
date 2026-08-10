import * as React from 'react'

import type { FilledIcon } from './icons'
import { cn } from '../../lib/utils'

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  icon: FilledIcon
  title: React.ReactNode
  description: React.ReactNode
  action?: React.ReactNode
}

const EmptyState = React.forwardRef<HTMLElement, EmptyStateProps>(
  (
    {
      className,
      icon: Icon,
      title,
      description,
      action,
      children,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const titleId = React.useId()
    const descriptionId = React.useId()

    return (
      <section
        ref={ref}
        aria-labelledby={ariaLabelledBy ?? titleId}
        aria-describedby={ariaDescribedBy ?? descriptionId}
        className={cn(
          'flex min-h-32 flex-col items-center justify-center px-6 py-10 text-center text-card-foreground',
          className
        )}
        {...props}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-lg border border-ring bg-accent text-primary"
          >
            <Icon size={20} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            <p
              id={descriptionId}
              className="max-w-md text-sm leading-6 text-muted-foreground max-sm:sr-only"
            >
              {description}
            </p>
          </div>
        </div>
        {children ? <div className="mt-5 w-full max-w-md">{children}</div> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </section>
    )
  }
)

EmptyState.displayName = 'EmptyState'

export { EmptyState }
