import * as React from 'react'

import { cn } from '../../lib/utils'

export interface SettingsSectionProps extends React.HTMLAttributes<HTMLElement> {
  heading: React.ReactNode
  headingId: string
  description?: React.ReactNode
  actions?: React.ReactNode
}

export const SettingsSection = React.forwardRef<HTMLElement, SettingsSectionProps>(
  ({ className, heading, headingId, description, actions, children, ...props }, ref) => (
    <section
      ref={ref}
      aria-labelledby={headingId}
      data-settings-section="true"
      className={cn('overflow-hidden rounded-shell border border-panel-border bg-panel', className)}
      {...props}
    >
      <header className="flex items-start justify-between gap-4 border-b border-panel-border px-4 py-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold text-foreground">
            {heading}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
)

SettingsSection.displayName = 'SettingsSection'

export interface SettingsRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  description?: React.ReactNode
  htmlFor?: string
  labelId?: string
  descriptionId?: string
  error?: React.ReactNode
  errorId?: string
  valueClassName?: string
}

export const SettingsRow = React.forwardRef<HTMLDivElement, SettingsRowProps>(
  (
    {
      className,
      label,
      description,
      htmlFor,
      labelId,
      descriptionId,
      error,
      errorId,
      valueClassName,
      children,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      data-settings-row="true"
      className={cn(
        'grid gap-2 px-4 py-4 sm:grid-cols-[minmax(10rem,0.75fr)_minmax(0,1.25fr)] sm:items-start sm:gap-6',
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        {htmlFor ? (
          <label
            id={labelId}
            htmlFor={htmlFor}
            className="text-sm font-medium leading-5 text-foreground"
          >
            {label}
          </label>
        ) : (
          <p id={labelId} className="text-sm font-medium leading-5 text-foreground">
            {label}
          </p>
        )}
        {description ? (
          <p id={descriptionId} className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div
        className={cn('min-w-0 space-y-2', valueClassName)}
        aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
      >
        {children}
        {error ? (
          <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
)

SettingsRow.displayName = 'SettingsRow'
