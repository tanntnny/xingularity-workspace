import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps): React.ReactElement => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          success:
            'group-[.toaster]:border-success-border group-[.toaster]:bg-success-muted group-[.toaster]:text-success-muted-foreground',
          warning:
            'group-[.toaster]:border-warning-border group-[.toaster]:bg-warning-muted group-[.toaster]:text-warning-muted-foreground',
          error:
            'group-[.toaster]:border-destructive group-[.toaster]:bg-destructive-muted group-[.toaster]:text-destructive-muted-foreground'
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
