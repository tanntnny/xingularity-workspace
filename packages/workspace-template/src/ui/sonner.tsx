import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps): React.ReactElement => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[var(--panel)] group-[.toaster]:text-[var(--foreground)] group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-[var(--muted-foreground)]',
          actionButton:
            'group-[.toast]:bg-[var(--primary)] group-[.toast]:text-[var(--primary-foreground)]',
          cancelButton:
            'group-[.toast]:bg-[var(--muted-color)] group-[.toast]:text-[var(--muted-foreground)]',
          success:
            'group-[.toaster]:border-[var(--accent-line)] group-[.toaster]:bg-[var(--accent-soft)]',
          error:
            'group-[.toaster]:border-[var(--destructive)] group-[.toaster]:bg-[var(--tag-3-bg)]'
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
