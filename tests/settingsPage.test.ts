import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SettingsPage } from '../src/renderer/src/pages/SettingsPage'
import type { VaultSyncSectionProps } from '../src/renderer/src/pages/VaultSyncPage'

const syncHealth: VaultSyncSectionProps = {
  status: 'ready',
  snapshot: {
    vaultPath: '/Users/demo/Vault',
    vaultId: 'vault-demo',
    watcher: {
      status: 'watching',
      watchedRoots: 1,
      lastEventAt: null
    },
    reconcile: {
      status: 'complete'
    },
    lastScanAt: null,
    lastCommittedSequence: 0,
    externalChanges: [],
    conflicts: [],
    repairs: [],
    portableScope: {
      includedCategories: ['notes'],
      excludedCategories: ['secrets']
    }
  },
  actions: {
    onReconcile: () => undefined,
    onValidate: () => undefined,
    onOpenFinder: () => undefined,
    onOpenTerminal: () => undefined,
    onCreateBackup: () => undefined,
    onReviewConflict: () => undefined,
    onRepairItem: () => undefined
  }
}

const settingsProps = {
  profileName: 'Demo',
  mistralApiKeyConfigured: false,
  editorVimModeEnabled: false,
  editorVimKeyMappings: [],
  vaultLocation: '/Users/demo/Vault',
  savedVaultCount: 1,
  onSaveProfile: () => undefined,
  onSaveMistralApiKey: () => undefined,
  onToggleEditorVimMode: () => undefined,
  onUpdateEditorVimKeyMappings: () => undefined,
  onManageVaults: () => undefined,
  onMigrateBlockNoteNotes: () => undefined,
  onMigrateTaggedNoteBodyFrontmatter: () => undefined,
  onMigrateNoteImagePaths: () => undefined,
  onImportLegacyExcalidrawSessions: () => undefined,
  onOpenDesignAudit: () => undefined,
  pythonCondaEnvironmentPath: null,
  pythonCondaExecutablePath: null,
  detectedCondaExecutablePath: null,
  condaEnvironments: [],
  condaEnvironmentsLoading: false,
  condaEnvironmentsError: null,
  onRefreshCondaEnvironments: () => undefined,
  onSelectCondaEnvironment: () => undefined,
  onChooseCondaExecutable: () => undefined,
  onResetCondaExecutable: () => undefined
}

describe('settings page sync section', () => {
  it('exposes Sync as a tab and embeds the vault health surface', () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        ...settingsProps,
        initialTab: 'sync',
        syncHealth
      })
    )

    expect(markup).toContain('data-testid="settings-sync-panel"')
    expect(markup).toContain('data-testid="vault-sync-section"')
    expect(markup).toContain('Sync health')
    expect(markup).toContain('data-testid="vault-sync-overview"')
  })

  it('falls back to Profile when Sync is unavailable', () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        ...settingsProps,
        initialTab: 'sync'
      })
    )

    expect(markup).not.toContain('id="settings-tab-sync"')
    expect(markup).not.toContain('data-testid="settings-sync-panel"')
    expect(markup).toContain('aria-labelledby="settings-tab-profile"')
  })
})
