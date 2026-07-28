import * as React from 'react'

import { cn } from '../../lib/utils'

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode
  description?: React.ReactNode
  htmlFor?: string
  error?: React.ReactNode
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, label, description, htmlFor, error, children, ...props }, ref) => (
    <div ref={ref} className={cn('grid w-full gap-1.5', className)} {...props}>
      {label ? (
        <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
          {label}
        </label>
      ) : null}
      {children}
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  )
)

Field.displayName = 'Field'

export { Field }
