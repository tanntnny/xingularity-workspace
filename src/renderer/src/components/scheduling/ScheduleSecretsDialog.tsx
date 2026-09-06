import { useState, type FormEvent, type ReactElement } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  Check,
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogShell,
  DialogShellFooter,
  DialogShellHeader,
  Input,
  Label,
  Trash2
} from '../ui'
import { COMMAND_ENTER_ARIA_KEYSHORTCUT, handleCommandEnterSubmit } from '../../lib/formShortcuts'

const SECRET_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/

export interface ScheduleSecretsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  secretNames: readonly string[]
  secretRefs: readonly string[]
  onToggleSecretRef: (name: string, enabled: boolean) => void
  onSaveSecret: (name: string, value: string) => Promise<void>
  onDeleteSecret: (name: string) => Promise<void>
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function secretReferenceId(name: string): string {
  return `scheduling-secret-ref-${name.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

export function ScheduleSecretsDialog({
  open,
  onOpenChange,
  secretNames,
  secretRefs,
  onToggleSecretRef,
  onSaveSecret,
  onDeleteSecret
}: ScheduleSecretsDialogProps): ReactElement {
  const [secretName, setSecretName] = useState('')
  const [secretValue, setSecretValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [secretToDelete, setSecretToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const allSecretNames = Array.from(new Set([...secretNames, ...secretRefs])).sort((a, b) =>
    a.localeCompare(b)
  )

  const handleSaveSecret = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const normalizedName = secretName.trim()

    if (!SECRET_NAME_PATTERN.test(normalizedName)) {
      setErrorMessage(
        'Use a name that starts with a letter or number and contains only letters, numbers, dots, underscores, or hyphens.'
      )
      return
    }

    if (!secretValue) {
      setErrorMessage('Enter a value before saving the secret.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      await onSaveSecret(normalizedName, secretValue)
      setSecretName('')
      setSecretValue('')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSecret = async (): Promise<void> => {
    if (!secretToDelete) {
      return
    }

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      await onDeleteSecret(secretToDelete)
      onToggleSecretRef(secretToDelete, false)
      setSecretToDelete(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[min(720px,calc(100vh-2rem))] overflow-hidden"
          data-testid="scheduling-secrets-dialog"
          showCloseButton={false}
        >
          <DialogShell>
            <DialogShellHeader
              context="Automation"
              title="Manage automation secrets"
              closeLabel="Close secrets dialog"
              onClose={() => onOpenChange(false)}
            />

            <DialogBody className="min-h-0 space-y-5 overflow-y-auto pr-1">
              <DialogDescription className="mb-3">
                Store encrypted values once, then attach the references this automation is allowed
                to use. Secret values are never displayed after saving.
              </DialogDescription>
              <section className="space-y-3" aria-labelledby="scheduling-secret-references-heading">
                <div>
                  <h3
                    id="scheduling-secret-references-heading"
                    className="text-sm font-semibold text-foreground"
                  >
                    References for this automation
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select at least one reference when the Use secrets permission is enabled.
                  </p>
                </div>

                {allSecretNames.length > 0 ? (
                  <div
                    className="divide-y divide-border rounded-md border border-border"
                    data-testid="scheduling-secret-reference-list"
                  >
                    {allSecretNames.map((name) => {
                      const isConfigured = secretNames.includes(name)
                      const referenceId = secretReferenceId(name)

                      return (
                        <div
                          key={name}
                          className="flex items-center gap-3 px-3 py-2.5"
                          data-testid={`scheduling-secret-row:${name}`}
                        >
                          <Checkbox
                            id={referenceId}
                            checked={secretRefs.includes(name)}
                            onCheckedChange={(value) => onToggleSecretRef(name, value === true)}
                            aria-label={`Allow automation to use ${name}`}
                            data-testid={`scheduling-secret-ref:${name}`}
                          />
                          <Label
                            htmlFor={referenceId}
                            className="min-w-0 flex-1 cursor-pointer leading-5"
                          >
                            <span className="block truncate font-mono text-xs font-medium">
                              {name}
                            </span>
                            <span className="block text-xs font-normal text-muted-foreground">
                              {isConfigured ? 'Configured secret' : 'Missing from secure storage'}
                            </span>
                          </Label>
                          {isConfigured ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setSecretToDelete(name)}
                              aria-label={`Delete secret ${name}`}
                              title={`Delete secret ${name}`}
                              data-testid={`scheduling-delete-secret:${name}`}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div
                    className="rounded-md border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground"
                    data-testid="scheduling-secrets-empty"
                  >
                    No secrets are configured yet. Add one below to make it available to this
                    automation.
                  </div>
                )}
              </section>

              <section
                className="space-y-3 border-t border-border pt-4"
                aria-labelledby="scheduling-add-secret-heading"
              >
                <div>
                  <h3
                    id="scheduling-add-secret-heading"
                    className="text-sm font-semibold text-foreground"
                  >
                    Add or update a secret
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saving an existing name replaces its encrypted value.
                  </p>
                </div>
                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]"
                  onSubmit={handleSaveSecret}
                  onKeyDownCapture={handleCommandEnterSubmit}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="scheduling-secret-name">Name</Label>
                    <Input
                      id="scheduling-secret-name"
                      value={secretName}
                      onChange={(event) => setSecretName(event.target.value)}
                      placeholder="API_TOKEN"
                      autoComplete="off"
                      data-testid="scheduling-secret-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="scheduling-secret-value">Value</Label>
                    <Input
                      id="scheduling-secret-value"
                      type="password"
                      value={secretValue}
                      onChange={(event) => setSecretValue(event.target.value)}
                      placeholder="Enter secret value"
                      autoComplete="new-password"
                      data-testid="scheduling-secret-value"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="self-end rounded-[var(--radius-button-pill)]"
                    disabled={isSaving}
                    aria-keyshortcuts={COMMAND_ENTER_ARIA_KEYSHORTCUT}
                    data-testid="scheduling-save-secret"
                  >
                    {isSaving ? 'Saving…' : 'Save secret'}
                  </Button>
                </form>
                {errorMessage ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                  </p>
                ) : null}
              </section>
            </DialogBody>

            <DialogShellFooter>
              <DialogActionButton
                icon={<Check />}
                label="Done"
                tone="accent"
                onClick={() => onOpenChange(false)}
              />
            </DialogShellFooter>
          </DialogShell>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={secretToDelete !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isDeleting) {
            setSecretToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this secret?</AlertDialogTitle>
            <AlertDialogDescription>
              Any automation that references{' '}
              {secretToDelete ? `“${secretToDelete}”` : 'this secret'}
              will no longer be able to resolve it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={() => void handleDeleteSecret()}>
              {isDeleting ? 'Deleting…' : 'Delete secret'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
