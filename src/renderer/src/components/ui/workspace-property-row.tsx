import type { ReactElement, ReactNode } from 'react'

interface WorkspacePropertyRowProps {
  label: string
  testId: string
  children: ReactNode
}

export function WorkspacePropertyRow({
  label,
  testId,
  children
}: WorkspacePropertyRowProps): ReactElement {
  return (
    <div
      className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-start gap-2 px-3 py-2"
      data-testid={testId}
    >
      <span className="pt-1 text-sm font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0 max-w-full overflow-x-auto text-xs" data-testid={`${testId}-value`}>
        <div className="flex w-max min-w-full flex-nowrap items-start justify-start gap-1">
          {children}
        </div>
      </div>
    </div>
  )
}
