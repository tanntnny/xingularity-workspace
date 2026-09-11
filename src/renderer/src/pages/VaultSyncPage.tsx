import type { ReactElement, ReactNode } from 'react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  WorkspaceIconButton,
  WorkspacePanelSection,
  WorkspacePanelSectionHeader,
  WorkspaceTextFade
} from '../components/ui'
import {
  CheckCircle2,
  CircleAlert,
  ClockCheck,
  Download,
  Files,
  FolderOpen,
  RefreshCw,
  Shield,
  Terminal
} from '../components/ui/icons'
import { WorkspacePageHeader } from '../components/workspace'
import type { UiTone } from '../lib/uiTone'
import {
  formatVaultSyncChangeKind,
  formatVaultSyncChangeSource,
  formatVaultSyncConflictKind,
  formatVaultSyncCount,
  formatVaultSyncDomain,
  formatVaultSyncRepairKind,
  formatVaultSyncTimestamp,
  getVaultSyncChangeTone,
  getVaultSyncPresentation,
  getVaultSyncRepairTone,
  type VaultSyncChange,
  type VaultSyncConflict,
  type VaultSyncPageStatus,
  type VaultSyncRepair,
  type VaultSyncSnapshot
} from '../lib/vaultSyncPresentation'

export type VaultSyncPageAction = () => void | Promise<void>

export interface VaultSyncPageActions {
  onReconcile: VaultSyncPageAction
  onValidate: VaultSyncPageAction
  onOpenFinder: VaultSyncPageAction
  onOpenTerminal: VaultSyncPageAction
  onCreateBackup: VaultSyncPageAction
  onReviewConflict: (conflict: VaultSyncConflict) => void | Promise<void>
  onRepairItem: (repair: VaultSyncRepair) => void | Promise<void>
}

export interface VaultSyncSectionProps {
  status: VaultSyncPageStatus
  snapshot?: VaultSyncSnapshot | null
  errorMessage?: string | null
  actions: VaultSyncPageActions
}

export type VaultSyncPageProps = VaultSyncSectionProps

interface SummaryCardProps {
  testId: string
  title: string
  value: string
  detail: string
  icon: ReactNode
  tone?: UiTone
}

function getSummaryToneLabel(tone: UiTone): string {
  if (tone === 'success') {
    return 'Healthy'
  }

  if (tone === 'danger') {
    return 'Needs attention'
  }

  if (tone === 'warning' || tone === 'attention') {
    return 'Review required'
  }

  if (tone === 'info') {
    return 'In progress'
  }

  return 'Stable'
}

function SummaryCard({ testId, title, value, detail, icon, tone }: SummaryCardProps): ReactElement {
  return (
    <Card data-testid={testId} className="bg-panel">
      <CardHeader className="flex-row items-start justify-between gap-3 p-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        <p className="text-base font-semibold text-foreground" title={value}>
          <WorkspaceTextFade>{value}</WorkspaceTextFade>
        </p>
        {tone ? (
          <Badge variant="neutral" tone={tone}>
            {getSummaryToneLabel(tone)}
          </Badge>
        ) : null}
        <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function HeaderActions({
  status,
  snapshot,
  actions
}: {
  status: VaultSyncPageStatus
  snapshot?: VaultSyncSnapshot | null
  actions: VaultSyncPageActions
}): ReactElement {
  const loading = status === 'loading'
  const reconciling = snapshot?.reconcile.status === 'running'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <WorkspaceIconButton
        label={reconciling ? 'Reconciling…' : 'Reconcile'}
        aria-label="Reconcile vault"
        title="Reconcile vault"
        data-testid="vault-sync-reconcile"
        variant="accent"
        icon={<RefreshCw aria-hidden="true" />}
        disabled={loading || reconciling}
        onClick={() => {
          void actions.onReconcile()
        }}
      />
      <WorkspaceIconButton
        label="Validate"
        aria-label="Validate vault"
        title="Validate vault"
        data-testid="vault-sync-validate"
        icon={<CheckCircle2 aria-hidden="true" />}
        disabled={loading || !snapshot}
        onClick={() => {
          void actions.onValidate()
        }}
      />
    </div>
  )
}

function VaultSyncLoadingState(): ReactElement {
  return (
    <section
      data-testid="vault-sync-loading-state"
      role="status"
      aria-label="Loading vault sync health"
      aria-busy="true"
      className="rounded-shell border border-panel-border bg-panel p-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Loading vault health…
      </div>
      <div aria-hidden="true" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {['watcher', 'reconcile', 'scan', 'sequence'].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-shell border border-panel-border bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
    </section>
  )
}

function VaultSyncErrorState({
  message,
  onRetry
}: {
  message: string
  onRetry: VaultSyncPageAction
}): ReactElement {
  return (
    <section
      data-testid="vault-sync-error-state"
      role="alert"
      className="flex flex-col gap-4 rounded-shell border border-warning-border bg-warning-muted p-4 text-warning-muted-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Vault health is unavailable</h2>
          <p className="mt-1 break-words text-sm leading-5">{message}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 border-warning-border bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted"
        onClick={() => {
          void onRetry()
        }}
      >
        Try again
      </Button>
    </section>
  )
}

function VaultSyncEmptyState({ onReconcile }: { onReconcile: VaultSyncPageAction }): ReactElement {
  return (
    <WorkspacePanelSection data-testid="vault-sync-empty-state" className="p-0">
      <EmptyState
        icon={Shield}
        title="No vault health data yet"
        description="Reconcile the active vault to establish its watcher status, scan sequence, and recovery state."
        className="min-h-56 bg-transparent py-12"
        action={
          <Button
            type="button"
            variant="accent"
            onClick={() => {
              void onReconcile()
            }}
          >
            Reconcile vault
          </Button>
        }
      />
    </WorkspacePanelSection>
  )
}

function VaultSyncOverview({ snapshot }: { snapshot: VaultSyncSnapshot }): ReactElement {
  const presentation = getVaultSyncPresentation(snapshot)
  const watcherDetail = snapshot.watcher.message ?? presentation.watcher.description
  const reconcileDetail = snapshot.reconcile.message ?? presentation.reconcile.description

  return (
    <section data-testid="vault-sync-overview" aria-labelledby="vault-sync-overview-heading">
      <h2 id="vault-sync-overview-heading" className="sr-only">
        Current vault status
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          testId="vault-sync-watcher-card"
          title="Watcher"
          value={presentation.watcher.label}
          detail={watcherDetail}
          tone={presentation.watcher.tone}
          icon={<Files className="size-4" aria-hidden="true" />}
        />
        <SummaryCard
          testId="vault-sync-reconcile-card"
          title="Reconcile"
          value={presentation.reconcile.label}
          detail={reconcileDetail}
          tone={presentation.reconcile.tone}
          icon={<RefreshCw className="size-4" aria-hidden="true" />}
        />
        <SummaryCard
          testId="vault-sync-scan-card"
          title="Last scan"
          value={presentation.lastScanLabel}
          detail={
            snapshot.watcher.lastEventAt
              ? `Last event ${formatVaultSyncTimestamp(snapshot.watcher.lastEventAt)}`
              : 'No watcher event has been recorded.'
          }
          icon={<ClockCheck className="size-4" aria-hidden="true" />}
        />
        <SummaryCard
          testId="vault-sync-sequence-card"
          title="Committed sequence"
          value={presentation.sequenceLabel}
          detail={formatVaultSyncCount(
            presentation.externalChangeCount,
            'external change',
            'external changes'
          )}
          icon={<Shield className="size-4" aria-hidden="true" />}
        />
      </div>
    </section>
  )
}

function VaultHealthSummary({ snapshot }: { snapshot: VaultSyncSnapshot }): ReactElement {
  const presentation = getVaultSyncPresentation(snapshot)

  return (
    <section
      data-testid="vault-sync-health-summary"
      aria-labelledby="vault-sync-health-heading"
      className="flex flex-col gap-3 rounded-shell border border-panel-border bg-panel p-4 sm:flex-row sm:items-center sm:justify-between"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Shield className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="vault-sync-health-heading" className="text-sm font-semibold text-foreground">
            Overall health
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {presentation.health.description}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="neutral" tone={presentation.health.tone}>
          {presentation.health.label}
        </Badge>
        {presentation.attentionCount > 0 ? (
          <span className="text-xs text-muted-foreground">
            {formatVaultSyncCount(presentation.attentionCount, 'item')} awaiting review
          </span>
        ) : null}
      </div>
    </section>
  )
}

function VaultLocationSection({
  snapshot,
  actions,
  disabled
}: {
  snapshot: VaultSyncSnapshot
  actions: VaultSyncPageActions
  disabled: boolean
}): ReactElement {
  const portableScope = snapshot.portableScope

  return (
    <WorkspacePanelSection data-testid="vault-sync-location-section">
      <WorkspacePanelSectionHeader
        heading="Vault location"
        description="Canonical files stay on disk; indexes, secrets, and device state remain out of routine transport."
      />
      <dl className="grid gap-2 text-sm">
        <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start sm:gap-3">
          <dt className="font-medium text-muted-foreground">Path</dt>
          <dd className="min-w-0 break-words text-foreground" title={snapshot.vaultPath}>
            {snapshot.vaultPath || 'Unavailable'}
          </dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start sm:gap-3">
          <dt className="font-medium text-muted-foreground">Vault ID</dt>
          <dd className="break-words text-foreground">{snapshot.vaultId || 'Not assigned'}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <WorkspaceIconButton
          label="Open Finder"
          aria-label="Open vault in Finder"
          title="Open vault in Finder"
          data-testid="vault-sync-open-finder"
          icon={<FolderOpen aria-hidden="true" />}
          disabled={disabled}
          onClick={() => {
            void actions.onOpenFinder()
          }}
        />
        <WorkspaceIconButton
          label="Open terminal"
          aria-label="Open terminal at vault"
          title="Open terminal at vault"
          data-testid="vault-sync-open-terminal"
          icon={<Terminal aria-hidden="true" />}
          disabled={disabled}
          onClick={() => {
            void actions.onOpenTerminal()
          }}
        />
        <WorkspaceIconButton
          label="Backup"
          aria-label="Create portable vault backup"
          title="Create portable vault backup"
          data-testid="vault-sync-create-backup"
          icon={<Download aria-hidden="true" />}
          disabled={disabled}
          onClick={() => {
            void actions.onCreateBackup()
          }}
        />
      </div>
      <div className="border-t border-panel-border pt-3" data-testid="vault-sync-portable-scope">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Portable scope</h3>
          <Badge variant="neutral" tone="info">
            {portableScope
              ? formatVaultSyncCount(portableScope.includedCategories.length, 'included category')
              : 'Not reported'}
          </Badge>
        </div>
        {portableScope ? (
          <div className="mt-2 grid gap-1 text-xs leading-5 text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Included:</span>{' '}
              {portableScope.includedCategories.join(', ') || 'None'}
            </p>
            <p>
              <span className="font-medium text-foreground">Excluded:</span>{' '}
              {portableScope.excludedCategories.join(', ') || 'None'}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            The current runtime has not reported portable inclusion and exclusion categories.
          </p>
        )}
      </div>
    </WorkspacePanelSection>
  )
}

function ExternalChangesSection({
  changes
}: {
  changes: readonly VaultSyncChange[]
}): ReactElement {
  return (
    <WorkspacePanelSection data-testid="vault-sync-external-changes">
      <WorkspacePanelSectionHeader
        heading="External changes"
        description="Changes observed from Finder, a terminal, another editor, or another process."
        actions={
          <Badge variant="neutral" tone={changes.length ? 'info' : 'success'}>
            {changes.length}
          </Badge>
        }
      />
      {changes.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No external changes"
          description="The watcher has not found any unreviewed file changes since the last scan."
          className="min-h-28 bg-transparent py-5"
        />
      ) : (
        <ul
          className="grid max-h-[32rem] gap-2 overflow-y-auto"
          aria-label="External vault changes"
        >
          {changes.map((change) => (
            <ExternalChangeRow key={change.id} change={change} />
          ))}
        </ul>
      )}
    </WorkspacePanelSection>
  )
}

function ExternalChangeRow({ change }: { change: VaultSyncChange }): ReactElement {
  return (
    <li
      data-testid={`vault-sync-change:${change.id}`}
      className="rounded-[var(--radius-button)] border border-border/70 bg-card px-3 py-3"
    >
      <article>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="neutral" tone={getVaultSyncChangeTone(change.kind)}>
              {formatVaultSyncChangeKind(change.kind)}
            </Badge>
            <span className="text-sm font-medium text-foreground">
              {formatVaultSyncDomain(change.domain)}
            </span>
          </div>
          <time dateTime={change.observedAt} className="shrink-0 text-xs text-muted-foreground">
            {formatVaultSyncTimestamp(change.observedAt)}
          </time>
        </div>
        <p className="mt-2 break-words text-sm text-foreground" title={change.path}>
          {change.path}
        </p>
        {change.previousPath ? (
          <p className="mt-1 break-words text-xs text-muted-foreground">
            Previously {change.previousPath}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{formatVaultSyncChangeSource(change.source)}</span>
          {change.transactionId ? <span>Transaction {change.transactionId}</span> : null}
        </div>
      </article>
    </li>
  )
}

function ConflictsSection({
  conflicts,
  onReviewConflict
}: {
  conflicts: readonly VaultSyncConflict[]
  onReviewConflict: VaultSyncPageActions['onReviewConflict']
}): ReactElement {
  return (
    <WorkspacePanelSection data-testid="vault-sync-conflicts">
      <WorkspacePanelSectionHeader
        heading="Conflicts"
        description="Unresolved local, external, or sync changes are preserved until reviewed."
        actions={
          <Badge variant="neutral" tone={conflicts.length ? 'warning' : 'success'}>
            {conflicts.length}
          </Badge>
        }
      />
      {conflicts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No unresolved conflicts"
          description="The latest canonical changes have a single accepted result."
          className="min-h-28 bg-transparent py-5"
        />
      ) : (
        <ul className="grid gap-2" aria-label="Unresolved vault conflicts">
          {conflicts.map((conflict) => (
            <ConflictRow
              key={conflict.id}
              conflict={conflict}
              onReview={() => {
                void onReviewConflict(conflict)
              }}
            />
          ))}
        </ul>
      )}
    </WorkspacePanelSection>
  )
}

function ConflictRow({
  conflict,
  onReview
}: {
  conflict: VaultSyncConflict
  onReview: () => void
}): ReactElement {
  return (
    <li
      data-testid={`vault-sync-conflict:${conflict.id}`}
      className="rounded-[var(--radius-button)] border border-warning-border bg-warning-muted px-3 py-3"
    >
      <article>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Badge variant="neutral" tone="warning">
              {formatVaultSyncConflictKind(conflict.kind)}
            </Badge>
            <h3 className="mt-2 break-words text-sm font-medium text-warning-muted-foreground">
              {conflict.path}
            </h3>
          </div>
          <time
            dateTime={conflict.createdAt}
            className="shrink-0 text-xs text-warning-muted-foreground"
          >
            {formatVaultSyncTimestamp(conflict.createdAt)}
          </time>
        </div>
        <p className="mt-2 text-xs leading-5 text-warning-muted-foreground">{conflict.summary}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-warning-muted-foreground">
            {formatVaultSyncDomain(conflict.domain)}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-warning-border bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted"
            aria-label={`Review conflict for ${conflict.path}`}
            onClick={onReview}
          >
            Review conflict
          </Button>
        </div>
      </article>
    </li>
  )
}

function RepairsSection({
  repairs,
  onRepairItem
}: {
  repairs: readonly VaultSyncRepair[]
  onRepairItem: VaultSyncPageActions['onRepairItem']
}): ReactElement {
  return (
    <WorkspacePanelSection data-testid="vault-sync-repairs">
      <WorkspacePanelSectionHeader
        heading="Quarantine & repair"
        description="Malformed or uncertain files stay recoverable until a repair is chosen."
        actions={
          <Badge variant="neutral" tone={repairs.length ? 'danger' : 'success'}>
            {repairs.length}
          </Badge>
        }
      />
      {repairs.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No repair items"
          description="No quarantined files or projection repairs are waiting for action."
          className="min-h-28 bg-transparent py-5"
        />
      ) : (
        <ul className="grid gap-2" aria-label="Vault quarantine and repair items">
          {repairs.map((repair) => (
            <RepairRow
              key={repair.id}
              repair={repair}
              onRepair={() => {
                void onRepairItem(repair)
              }}
            />
          ))}
        </ul>
      )}
    </WorkspacePanelSection>
  )
}

function RepairRow({
  repair,
  onRepair
}: {
  repair: VaultSyncRepair
  onRepair: () => void
}): ReactElement {
  const tone = getVaultSyncRepairTone(repair.kind)
  const rowClassName =
    tone === 'danger'
      ? 'border-destructive/40 bg-destructive-muted'
      : 'border-warning-border bg-warning-muted'
  const textClassName =
    tone === 'danger' ? 'text-destructive-muted-foreground' : 'text-warning-muted-foreground'

  return (
    <li
      data-testid={`vault-sync-repair:${repair.id}`}
      className={`rounded-[var(--radius-button)] border px-3 py-3 ${rowClassName}`}
    >
      <article>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Badge variant="neutral" tone={tone}>
              {formatVaultSyncRepairKind(repair.kind)}
            </Badge>
            <h3 className={`mt-2 break-words text-sm font-medium ${textClassName}`}>
              {repair.path}
            </h3>
          </div>
          <time dateTime={repair.createdAt} className={`shrink-0 text-xs ${textClassName}`}>
            {formatVaultSyncTimestamp(repair.createdAt)}
          </time>
        </div>
        <p className={`mt-2 text-xs leading-5 ${textClassName}`}>{repair.summary}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className={`text-xs ${textClassName}`}>{formatVaultSyncDomain(repair.domain)}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`bg-transparent ${
              tone === 'danger'
                ? 'border-destructive/40 text-destructive-muted-foreground hover:bg-destructive-muted'
                : 'border-warning-border text-warning-muted-foreground hover:bg-warning-muted'
            }`}
            aria-label={`Repair ${repair.path}`}
            onClick={onRepair}
          >
            Repair item
          </Button>
        </div>
      </article>
    </li>
  )
}

export function VaultSyncSection({
  status,
  snapshot,
  errorMessage,
  actions
}: VaultSyncSectionProps): ReactElement {
  const hasSnapshot = Boolean(snapshot)
  const showLoading = status === 'loading' && !hasSnapshot
  const showBlockingError = status === 'error' && !hasSnapshot
  const showContent = !showLoading && !showBlockingError && hasSnapshot

  return (
    <section
      data-testid="vault-sync-section"
      data-status={status}
      className="flex w-full flex-col gap-6"
    >
      <WorkspacePageHeader
        eyebrow="Vault control plane"
        heading="Sync health"
        description="See how the active vault is reconciling file changes, preserving conflicts, and keeping recovery work visible."
        icon={<Shield className="size-7 text-primary" aria-hidden="true" />}
        actions={<HeaderActions status={status} snapshot={snapshot} actions={actions} />}
      />

      {status === 'error' ? (
        <VaultSyncErrorState
          message={errorMessage || 'The vault health service did not return a status snapshot.'}
          onRetry={actions.onReconcile}
        />
      ) : null}

      {showLoading ? <VaultSyncLoadingState /> : null}

      {showContent && snapshot ? (
        <>
          <VaultHealthSummary snapshot={snapshot} />
          <VaultSyncOverview snapshot={snapshot} />
          <VaultLocationSection
            snapshot={snapshot}
            actions={actions}
            disabled={status === 'loading'}
          />
          <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
            <ExternalChangesSection changes={snapshot.externalChanges} />
            <aside aria-label="Vault recovery" className="grid min-w-0 gap-3">
              <ConflictsSection
                conflicts={snapshot.conflicts}
                onReviewConflict={actions.onReviewConflict}
              />
              <RepairsSection repairs={snapshot.repairs} onRepairItem={actions.onRepairItem} />
            </aside>
          </div>
        </>
      ) : null}

      {!showLoading && !showBlockingError && !hasSnapshot ? (
        <VaultSyncEmptyState onReconcile={actions.onReconcile} />
      ) : null}
    </section>
  )
}

export function VaultSyncPage({
  status,
  snapshot,
  errorMessage,
  actions
}: VaultSyncPageProps): ReactElement {
  return (
    <main
      data-testid="vault-sync-page"
      data-status={status}
      className="flex min-h-full w-full flex-1 flex-col gap-6 overflow-y-auto bg-background p-2 font-sans text-foreground antialiased"
    >
      <VaultSyncSection
        status={status}
        snapshot={snapshot}
        errorMessage={errorMessage}
        actions={actions}
      />
    </main>
  )
}
