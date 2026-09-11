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
  fontFamily: 'inter',
  codeFontFamily: 'jetbrains-mono',
  mistralApiKeyConfigured: false,
  editorVimModeEnabled: false,
  editorVimKeyMappings: [],
  vaultLocation: '/Users/demo/Vault',
  savedVaultCount: 1,
  onSaveProfile: () => undefined,
  onSaveFont: () => undefined,
  onSaveCodeFont: () => undefined,
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

describe('settings page structure', () => {
  it('renders category panels with aligned settings rows', () => {
    const profileMarkup = renderToStaticMarkup(
      createElement(SettingsPage, {
        ...settingsProps,
        initialTab: 'profile'
      })
    )

    expect(profileMarkup).toContain('id="settings-tab-panel-profile"')
    expect(profileMarkup).toContain('data-settings-section="true"')
    expect(profileMarkup).toContain('data-settings-row="true"')
    expect(profileMarkup).toContain('id="settings-profile-name"')
    expect(profileMarkup).not.toContain('id="settings-tab-panel"')

    const workspaceMarkup = renderToStaticMarkup(
      createElement(SettingsPage, {
        ...settingsProps,
        initialTab: 'workspace',
        featureFlags: {
          resources: true,
          googleDriveResources: false
        }
      })
    )

    expect(workspaceMarkup).toContain('settings-vault-storage-heading')
    expect(workspaceMarkup).toContain('settings-context-features-heading')
    expect(workspaceMarkup).toContain('settings-google-drive-heading')
    expect(workspaceMarkup).toContain('settings-note-migration-heading')
    expect(workspaceMarkup).toContain('settings-resources-enabled')

    const appearanceMarkup = renderToStaticMarkup(
      createElement(SettingsPage, {
        ...settingsProps,
        initialTab: 'appearance'
      })
    )

    expect(appearanceMarkup).toContain('data-testid="settings-app-font-select"')
    expect(appearanceMarkup).toContain('data-testid="settings-code-font-select"')
  })

  it('keeps complex editor and developer controls inside the shared structure', () => {
    const editorMarkup = renderToStaticMarkup(
      createElement(SettingsPage, {
        ...settingsProps,
        initialTab: 'editor',
        editorVimModeEnabled: true,
        editorVimKeyMappings: [
          {
            id: 'vim-map-test',
            mode: 'normal',
            sequence: 'ij',
            action: 'enterInsertMode'
          }
        ]
      })
    )

    expect(editorMarkup).toContain('settings-vim-mode-heading')
    expect(editorMarkup).toContain('settings-vim-mappings-heading')
    expect(editorMarkup).toContain('vim-map-test')
    expect(editorMarkup).toContain('data-testid="vim-mode-setting"')

    const developerMarkup = renderToStaticMarkup(
      createElement(SettingsPage, {
        ...settingsProps,
        initialTab: 'developer',
        condaEnvironments: [
          {
            name: 'base',
            path: '/Users/demo/miniconda3'
          }
        ]
      })
    )

    expect(developerMarkup).toContain('settings-python-runtime-heading')
    expect(developerMarkup).toContain('settings-conda-executable-status')
    expect(developerMarkup).toContain('settings-open-design-audit')
  })
})
