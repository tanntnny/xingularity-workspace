import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/80',
        secondary:
          'border-transparent bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]/80',
        destructive:
          'border-transparent bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/80',
        outline: 'text-[var(--foreground)]',
        // Custom variants for Xingularity's tag colors
        tag0: 'border-[var(--tag-0-line)] bg-[var(--tag-0-bg)] text-[var(--tag-0-text)]',
        tag1: 'border-[var(--tag-1-line)] bg-[var(--tag-1-bg)] text-[var(--tag-1-text)]',
        tag2: 'border-[var(--tag-2-line)] bg-[var(--tag-2-bg)] text-[var(--tag-2-text)]',
        tag3: 'border-[var(--tag-3-line)] bg-[var(--tag-3-bg)] text-[var(--tag-3-text)]',
        tag4: 'border-[var(--tag-4-line)] bg-[var(--tag-4-bg)] text-[var(--tag-4-text)]',
        tag5: 'border-[var(--tag-5-line)] bg-[var(--tag-5-bg)] text-[var(--tag-5-text)]',
        neutral:
          'border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] text-[var(--tag-neutral-text)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): React.ReactElement {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
