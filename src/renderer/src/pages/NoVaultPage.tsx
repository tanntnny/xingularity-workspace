import { useState, type ReactElement } from 'react'
import type { AppPlatformKind } from '../platform'
import { Button } from '../components/ui'
import appLogo from '../../../../assets/logo.png'

type VaultAction = 'open' | 'create'

interface NoVaultPageProps {
  platformKind: AppPlatformKind
  supportsVaultPicker: boolean
  onOpenExistingVault: () => Promise<void>
  onCreateNewVault: () => Promise<void>
  onManageSavedVaults: () => void
}

export function NoVaultPage({
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
        <div className="flex w-full max-w-2xl flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center text-foreground">
            <img src={appLogo} alt="Xingularity logo" className="size-16 object-contain" />
          </div>
          <h1 className="mt-2 text-3xl font-semibold leading-none tracking-tight">
            {supportsVaultPicker ? 'Select a vault first' : 'Workspace connection required'}
          </h1>

          <div className="mt-5 w-full">
            {supportsVaultPicker ? (
              <div className="flex flex-col items-center gap-2">
                <Button
                  type="button"
                  variant="accent"
                  shape="pill"
                  data-testid="vault-required-create"
                  onClick={() => {
                    void runVaultAction('create')
                  }}
                  disabled={activeAction !== null}
                  className="w-full max-w-52 shrink-0"
                >
                  {activeAction === 'create' ? 'Creating vault...' : 'Create New Vault'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  shape="pill"
                  data-testid="vault-required-open"
                  onClick={() => {
                    void runVaultAction('open')
                  }}
                  disabled={activeAction !== null}
                  className="w-full max-w-52 shrink-0"
                >
                  {activeAction === 'open' ? 'Opening vault...' : 'Open Existing Vault'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  shape="pill"
                  data-testid="vault-required-manage"
                  onClick={onManageSavedVaults}
                  disabled={activeAction !== null}
                  className="w-full max-w-52 shrink-0"
                >
                  Manage Saved Vaults
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-ring bg-muted px-4 py-3 text-left text-sm text-foreground">
                {isMobileShell
                  ? 'Mobile/web mode now shares the app shell and page system, but still needs a managed local workspace adapter.'
                  : 'A platform workspace adapter must be connected before this build can open local data.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
