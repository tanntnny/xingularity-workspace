import { cva } from 'class-variance-authority'

export const statusChipVariants = cva(
  'ui-compact-control inline-flex w-fit min-w-0 max-w-full items-center justify-start whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[var(--status-chip-icon-size)] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'ui-control gap-2 rounded-[var(--radius-control)] bg-transparent px-[var(--control-padding-x)] text-foreground font-semibold hover:bg-transparent focus-visible:bg-transparent',
        bare: 'group/status-chip gap-1 rounded-none bg-transparent px-0 py-0 text-muted-foreground font-medium hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:text-foreground'
      },
      surface: {
        none: '',
        pill: 'px-2 border border-border bg-surface-subtle hover:bg-surface-subtle-hover focus-visible:bg-surface-subtle-hover',
        hover: 'px-2 bg-transparent hover:bg-card-hover focus-visible:bg-card-hover',
        'hover-pill':
          'px-2 rounded-[var(--radius-button-pill)] bg-transparent hover:bg-surface-subtle-hover focus-visible:bg-surface-subtle-hover'
      }
    },
    defaultVariants: {
      variant: 'default',
      surface: 'none'
    }
  }
)
