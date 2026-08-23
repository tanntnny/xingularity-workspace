import { useState, type ReactElement } from 'react'
import type { AppPlatformKind } from '../platform'
import { Button, Card, CardContent, CardHeader, FolderOpen } from '../components/ui'

type VaultAction = 'open' | 'create'

interface NoVaultPageProps {
  lastVaultPath: string | null
  platformKind: AppPlatformKind
  supportsVaultPicker: boolean
  onOpenExistingVault: () => Promise<void>
  onCreateNewVault: () => Promise<void>
  onManageSavedVaults: () => void
}

export function NoVaultPage({
  lastVaultPath,
  platformKind,
  supportsVaultPicker,
  onOpenExistingVault,
  onCreateNewVault,
  onManageSavedVaults
}: NoVaultPageProps): ReactElement {
  const [activeAction, setActiveAction] = useState<VaultAction | null>(null)
  const isMobileShell = platformKind === 'mobile' || platformKind === 'web'

  const runVaultAction = async (action: VaultAction): Promise<void> => {
    setActiveAction(action)
    try {
      if (action === 'open') {
        await onOpenExistingVault()
      } else {
        await onCreateNewVault()
      }
    } finally {
      setActiveAction(null)
    }
  }

  return (
    <main
      data-testid="vault-required-page"
      className="flex min-h-full flex-1 flex-col overflow-y-auto bg-background p-2 text-foreground antialiased"
    >
      <div className="flex flex-1 items-center justify-center px-3 py-12 sm:px-8">
        <Card className="w-full max-w-2xl">
          <CardHeader className="items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-lg border border-ring bg-muted text-foreground">
              <FolderOpen size={26} aria-hidden="true" />
            </div>
            <h1 className="mt-2 text-3xl font-semibold leading-none tracking-tight">
              {supportsVaultPicker ? 'Select a vault first' : 'Workspace connection required'}
            </h1>
          </CardHeader>

          <CardContent className="space-y-5">
            {supportsVaultPicker ? (
              <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  data-testid="vault-required-open"
                  onClick={() => {
                    void runVaultAction('open')
                  }}
                  disabled={activeAction !== null}
                  className="sm:min-w-44"
                >
                  {activeAction === 'open' ? 'Opening vault...' : 'Open Existing Vault'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="vault-required-create"
                  onClick={() => {
                    void runVaultAction('create')
                  }}
                  disabled={activeAction !== null}
                  className="sm:min-w-44"
                >
                  {activeAction === 'create' ? 'Creating vault...' : 'Create New Vault'}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-ring bg-muted px-4 py-3 text-left text-sm text-foreground">
                {isMobileShell
                  ? 'Mobile/web mode now shares the app shell and page system, but still needs a managed local workspace adapter.'
                  : 'A platform workspace adapter must be connected before this build can open local data.'}
              </div>
            )}

            {supportsVaultPicker ? (
              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="vault-required-manage"
                  onClick={onManageSavedVaults}
                  disabled={activeAction !== null}
                >
                  Manage Saved Vaults
                </Button>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-muted px-4 py-3 text-left text-sm text-muted-foreground">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {supportsVaultPicker ? 'Last Known Vault' : 'Desktop Vault State'}
              </div>
              <div className="mt-2 break-words text-foreground">
                {lastVaultPath ??
                  (supportsVaultPicker
                    ? 'No previous vault remembered on this device.'
                    : 'No desktop vault is available in this runtime.')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
