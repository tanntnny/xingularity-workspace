import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VaultSyncPage, type VaultSyncPageActions } from '../src/renderer/src/pages/VaultSyncPage'
import {
  formatVaultSyncChangeKind,
  formatVaultSyncCount,
  formatVaultSyncDomain,
  formatVaultSyncSequence,
  formatVaultSyncTimestamp,
  getVaultSyncHealthPresentation,
  getVaultSyncPresentation,
  type VaultSyncSnapshot
} from '../src/renderer/src/lib/vaultSyncPresentation'

const snapshot: VaultSyncSnapshot = {
  vaultPath: '/Users/demo/Vault',
  vaultId: 'vault-demo',
  watcher: {
    status: 'watching',
    watchedRoots: 6,
    lastEventAt: '2026-08-29T09:30:00.000Z'
  },
  reconcile: {
    status: 'complete'
  },
  lastScanAt: '2026-08-29T09:29:00.000Z',
  lastCommittedSequence: 42,
  externalChanges: [
    {
      id: 'change-1',
      path: 'notebooks/launch.md',
      domain: 'notes',
      kind: 'change',
      observedAt: '2026-08-29T09:30:00.000Z',
      source: 'external'
    }
  ],
  conflicts: [
    {
      id: 'conflict-1',
      path: 'notebooks/launch.md',
      domain: 'notes',
      kind: 'content',
      summary: 'The open draft and disk version both changed.',
      createdAt: '2026-08-29T09:31:00.000Z'
    }
  ],
  repairs: [
    {
      id: 'repair-1',
      path: 'projects/atlas.json',
      domain: 'projects',
      kind: 'quarantine',
      summary: 'The JSON record is malformed and has been preserved.',
      createdAt: '2026-08-29T09:32:00.000Z'
    }
  ],
  portableScope: {
    includedCategories: ['notes', 'attachments'],
    excludedCategories: ['index', 'device state', 'secrets']
  }
}

const actions: VaultSyncPageActions = {
  onReconcile: () => undefined,
  onValidate: () => undefined,
  onOpenFinder: () => undefined,
  onOpenTerminal: () => undefined,
  onCreateBackup: () => undefined,
  onReviewConflict: () => undefined,
  onRepairItem: () => undefined
}

describe('vault sync presentation', () => {
  it('formats protocol values for readable status surfaces', () => {
    expect(formatVaultSyncDomain('weekly-plan')).toBe('Weekly Plan')
    expect(formatVaultSyncChangeKind('rename')).toBe('Renamed')
    expect(formatVaultSyncCount(1, 'conflict')).toBe('1 conflict')
    expect(formatVaultSyncCount(2, 'conflict')).toBe('2 conflicts')
    expect(formatVaultSyncSequence(42)).toBe('#42')
    expect(formatVaultSyncSequence(null)).toBe('Not recorded')
    expect(formatVaultSyncTimestamp(null)).toBe('Not yet')
    expect(formatVaultSyncTimestamp('not-a-date')).toBe('Unavailable')
  })

  it('prioritizes recovery issues when deriving overall health', () => {
    const presentation = getVaultSyncPresentation(snapshot)

    expect(presentation.health.label).toBe('Review required')
    expect(presentation.health.tone).toBe('warning')
    expect(presentation.externalChangeCount).toBe(1)
    expect(presentation.conflictCount).toBe(1)
    expect(presentation.repairCount).toBe(1)
    expect(presentation.attentionCount).toBe(2)
    expect(presentation.sequenceLabel).toBe('#42')
  })

  it('treats watcher and reconciliation failures as blocking health issues', () => {
    const presentation = getVaultSyncHealthPresentation({
      watcher: { status: 'error' },
      reconcile: { status: 'failed' },
      conflicts: [],
      repairs: []
    })

    expect(presentation.label).toBe('Needs attention')
    expect(presentation.tone).toBe('danger')
  })

  it('renders loading, empty, error, and populated page states', () => {
    const loadingMarkup = renderToStaticMarkup(
      createElement(VaultSyncPage, { status: 'loading', actions })
    )
    const emptyMarkup = renderToStaticMarkup(
      createElement(VaultSyncPage, { status: 'ready', snapshot: null, actions })
    )
    const errorMarkup = renderToStaticMarkup(
      createElement(VaultSyncPage, {
        status: 'error',
        errorMessage: 'The watcher could not be reached.',
        actions
      })
    )
    const populatedMarkup = renderToStaticMarkup(
      createElement(VaultSyncPage, { status: 'ready', snapshot, actions })
    )

    expect(loadingMarkup).toContain('data-testid="vault-sync-loading-state"')
    expect(loadingMarkup).toContain('aria-busy="true"')
    expect(emptyMarkup).toContain('data-testid="vault-sync-empty-state"')
    expect(emptyMarkup).toContain('No vault health data yet')
    expect(errorMarkup).toContain('data-testid="vault-sync-error-state"')
    expect(errorMarkup).toContain('The watcher could not be reached.')
    expect(populatedMarkup).toContain('data-testid="vault-sync-overview"')
    expect(populatedMarkup).toContain('Watching')
    expect(populatedMarkup).toContain('#42')
    expect(populatedMarkup).toContain('notebooks/launch.md')
    expect(populatedMarkup).toContain('data-testid="vault-sync-conflict:conflict-1"')
    expect(populatedMarkup).toContain('data-testid="vault-sync-repair:repair-1"')
    expect(populatedMarkup).toContain('Open vault in Finder')
    expect(populatedMarkup).toContain('Open terminal at vault')
    expect(populatedMarkup).toContain('Create portable vault backup')
  })
})
