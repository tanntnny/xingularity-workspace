import { type CSSProperties, type ReactElement, useEffect, useState } from 'react'

import { Badge, Clock, Palette, Separator, SlidersHorizontal, Sparkles } from '../ui'
import {
  DESIGN_AUDIT_TOKEN_GROUPS,
  type DesignAuditToken,
  type DesignAuditTokenGroup
} from '../../lib/designAuditCatalog'

export type DesignAuditFoundationsTabId =
  | 'tokens-surfaces'
  | 'tokens-intent'
  | 'tokens-geometry'
  | 'tokens-motion'

export type DesignAuditFoundationsProps = {
  themeVersion: string
  tabId: DesignAuditFoundationsTabId
}

type FoundationTokenGroupId = 'surfaces' | 'intent' | 'geometry' | 'motion'

type LiveThemeSnapshot = {
  colorScheme: string
  fontFamily: string
  radius: string
}

type LiveTokenState = {
  values: Record<string, string>
  snapshot: LiveThemeSnapshot
}

type SemanticUsageNote = {
  title: string
  description: string
}

const TAB_TO_TOKEN_GROUP = {
  'tokens-surfaces': 'surfaces',
  'tokens-intent': 'intent',
  'tokens-geometry': 'geometry',
  'tokens-motion': 'motion'
} as const satisfies Record<DesignAuditFoundationsTabId, FoundationTokenGroupId>

const EMPTY_SNAPSHOT: LiveThemeSnapshot = {
  colorScheme: '—',
  fontFamily: '—',
  radius: '—'
}

const SEMANTIC_USAGE_NOTES: Record<FoundationTokenGroupId, readonly SemanticUsageNote[]> = {
  surfaces: [
    {
      title: 'Follow the surface ladder',
      description:
        'Use workspace and panel roles for the shell, card for raised content, and popover for transient layers.'
    },
    {
      title: 'Pair surface and text roles',
      description:
        'Keep foreground tokens paired with the surface they describe so contrast remains coherent across themes.'
    },
    {
      title: 'Reserve borders for structure',
      description:
        'Use border, panel-border, and input to separate regions without adding another filled background.'
    }
  ],
  intent: [
    {
      title: 'Name the user intent',
      description:
        'Primary and accent communicate action hierarchy; destructive is reserved for irreversible or risky actions.'
    },
    {
      title: 'Use muted roles for context',
      description:
        'Muted semantic pairs support low-emphasis status, progress, and notification surfaces without competing with content.'
    },
    {
      title: 'Keep feedback legible',
      description:
        'Use the matching foreground and border roles with success, warning, info, and destructive surfaces.'
    }
  ],
  geometry: [
    {
      title: 'Let controls share a rhythm',
      description:
        'Use the control height, icon size, padding, and radius tokens together for consistent interactive density.'
    },
    {
      title: 'Use radius by role',
      description:
        'Surface, shell, dialog, button, pill, and control radii distinguish layers while keeping the system related.'
    },
    {
      title: 'Keep shell dimensions intentional',
      description:
        'Workspace chrome, pane, drawer, and resize values belong to layout primitives rather than individual pages.'
    }
  ],
  motion: [
    {
      title: 'Use one motion vocabulary',
      description:
        'Choose the duration and easing role that matches the interaction: fast controls, content changes, panels, or overlays.'
    },
    {
      title: 'Make state changes visible',
      description:
        'Scrollbar, drag-preview, and drop-zone roles should reinforce the current interaction without changing layout.'
    },
    {
      title: 'Respect reduced motion',
      description:
        'Treat timing tokens as a shared contract so motion can be reduced centrally without rewriting each specimen.'
    }
  ]
}

function getTokenGroup(tabId: DesignAuditFoundationsTabId): DesignAuditTokenGroup {
  const groupId = TAB_TO_TOKEN_GROUP[tabId]
  return (
    DESIGN_AUDIT_TOKEN_GROUPS.find((group) => group.id === groupId) ?? DESIGN_AUDIT_TOKEN_GROUPS[0]
  )
}

function readLiveTokenState(group: DesignAuditTokenGroup): LiveTokenState {
  const styles = window.getComputedStyle(document.documentElement)
  const values = Object.fromEntries(
    group.tokens.map((token) => [token.name, styles.getPropertyValue(token.name).trim()])
  )

  return {
    values,
    snapshot: {
      colorScheme: styles.getPropertyValue('color-scheme').trim() || '—',
      fontFamily: styles.getPropertyValue('--app-font-family').trim() || '—',
      radius: styles.getPropertyValue('--radius').trim() || '—'
    }
  }
}

function FoundationIcon({ groupId }: { groupId: FoundationTokenGroupId }): ReactElement {
  switch (groupId) {
    case 'intent':
      return <Sparkles size={19} aria-hidden="true" />
    case 'geometry':
      return <SlidersHorizontal size={19} aria-hidden="true" />
    case 'motion':
      return <Clock size={19} aria-hidden="true" />
    case 'surfaces':
    default:
      return <Palette size={19} aria-hidden="true" />
  }
}

function FoundationHeader({
  group,
  groupId,
  tabId,
  tokenCount
}: {
  group: DesignAuditTokenGroup
  groupId: FoundationTokenGroupId
  tabId: DesignAuditFoundationsTabId
  tokenCount: number
}): ReactElement {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-surface)] border border-border text-primary">
          <FoundationIcon groupId={groupId} />
        </span>
        <div className="min-w-0">
          <h1
            id={`${tabId}-heading`}
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            {group.label}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {group.description}
          </p>
        </div>
      </div>
      <Badge variant="outline" className="self-start">
        {tokenCount} {tokenCount === 1 ? 'token' : 'tokens'}
      </Badge>
    </header>
  )
}

function SnapshotValue({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="min-w-0 border-l border-border pl-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function ThemeSnapshot({
  themeVersion,
  snapshot
}: {
  themeVersion: string
  snapshot: LiveThemeSnapshot
}): ReactElement {
  return (
    <section aria-labelledby="design-audit-theme-snapshot">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Current document context</p>
          <h2
            id="design-audit-theme-snapshot"
            className="mt-1 text-lg font-semibold text-foreground"
          >
            Theme snapshot
          </h2>
        </div>
        <Badge variant="outline">Live</Badge>
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SnapshotValue label="Theme" value={themeVersion || '—'} />
        <SnapshotValue label="Color scheme" value={snapshot.colorScheme} />
        <SnapshotValue label="UI font" value={snapshot.fontFamily} />
        <SnapshotValue label="Base radius" value={snapshot.radius} />
      </dl>
    </section>
  )
}

function SemanticUsage({ groupId }: { groupId: FoundationTokenGroupId }): ReactElement {
  return (
    <section aria-labelledby="design-audit-semantic-usage">
      <div>
        <p className="text-sm font-medium text-muted-foreground">How to compose the roles</p>
        <h2 id="design-audit-semantic-usage" className="mt-1 text-lg font-semibold text-foreground">
          Semantic usage
        </h2>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {SEMANTIC_USAGE_NOTES[groupId].map((note) => (
          <div key={note.title} className="border-l border-border pl-3">
            <h3 className="truncate text-sm font-semibold text-foreground" title={note.title}>
              {note.title}
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{note.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function TokenPreview({ token }: { token: DesignAuditToken }): ReactElement {
  if (token.kind === 'color') {
    return (
      <span
        role="img"
        aria-label={`${token.label} color swatch`}
        className="block size-10 shrink-0 rounded-[var(--radius-control)] border border-border shadow-sm"
        style={{ backgroundColor: `var(${token.name})` } as CSSProperties}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border font-mono text-xs text-muted-foreground"
    >
      0.0
    </span>
  )
}

function TokenSpecimen({ token, value }: { token: DesignAuditToken; value: string }): ReactElement {
  const tokenId = token.name.startsWith('--') ? token.name.slice(2) : token.name

  return (
    <article
      data-testid={`design-audit-token:${tokenId}`}
      data-token-name={token.name}
      data-token-kind={token.kind}
      className="min-w-0 border-b border-border/70 pb-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <TokenPreview token={token} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className="min-w-0 truncate text-sm font-semibold text-foreground"
              title={token.label}
            >
              {token.label}
            </h3>
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] uppercase tracking-wide">
              {token.kind}
            </Badge>
          </div>
          <code className="mt-1 block break-all font-mono text-xs text-muted-foreground">
            {token.name}
          </code>
          <code className="mt-1.5 block break-all font-mono text-xs text-foreground">
            {value || '—'}
          </code>
        </div>
      </div>
    </article>
  )
}

function TokenValues({ group }: { group: DesignAuditTokenGroup }): ReactElement {
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setValues(readLiveTokenState(group).values)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [group])

  return (
    <section aria-labelledby="design-audit-live-tokens">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Resolved from the document root
          </p>
          <h2 id="design-audit-live-tokens" className="mt-1 text-lg font-semibold text-foreground">
            Live token values
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Colors include a visual swatch; dimensions stay copyable.
        </p>
      </div>
      <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        {group.tokens.map((token) => (
          <TokenSpecimen key={token.name} token={token} value={values[token.name] ?? ''} />
        ))}
      </div>
    </section>
  )
}

export function DesignAuditFoundations({
  themeVersion,
  tabId
}: DesignAuditFoundationsProps): ReactElement {
  const group = getTokenGroup(tabId)
  const groupId = TAB_TO_TOKEN_GROUP[tabId]
  const [snapshot, setSnapshot] = useState<LiveThemeSnapshot>(EMPTY_SNAPSHOT)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setSnapshot(readLiveTokenState(group).snapshot)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [group, themeVersion])

  return (
    <section
      id={tabId}
      aria-labelledby={`${tabId}-heading`}
      data-testid={`design-audit-section:${tabId}`}
      className="flex min-h-full w-full min-w-0 flex-col gap-8 bg-transparent px-4 py-5 sm:px-6 sm:py-6"
    >
      <FoundationHeader
        group={group}
        groupId={groupId}
        tabId={tabId}
        tokenCount={group.tokens.length}
      />

      <ThemeSnapshot themeVersion={themeVersion} snapshot={snapshot} />

      <Separator decorative={false} />

      <SemanticUsage groupId={groupId} />

      <Separator decorative={false} />

      <TokenValues group={group} />

      <p className="sr-only" aria-live="polite">
        {group.tokens.length} {group.tokens.length === 1 ? 'token' : 'tokens'} shown for{' '}
        {group.label}.
      </p>
    </section>
  )
}
