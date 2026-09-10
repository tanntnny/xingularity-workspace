import * as React from 'react'

import {
  AlertCircle,
  Archive,
  CircleCheck,
  Clock,
  Inbox,
  Layers3,
  LayoutDashboard,
  Palette,
  Plus
} from '../ui/icons'
import { Badge } from '../ui/badge'
import {
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbEllipsis,
  BreadcrumbIconLabel,
  BreadcrumbItem,
  BreadcrumbLabel,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../ui/breadcrumb'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { ChipGroup } from '../ui/chip-group'
import { EmptyState } from '../ui/empty-state'
import { ProgressRing } from '../ui/progress-ring'
import { Separator } from '../ui/separator'
import { StatusChip } from '../ui/status-chip'
import { StatusChipSelect } from '../ui/status-chip-select'
import {
  SortableTableHead,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table'
import { TableRowList } from '../ui/table-row-list'
import { WorkspaceTextFade } from '../ui/workspace-text-fade'
import { WorkspaceListRail, WorkspaceListRailItem } from '../ui/workspace-list-rail'
import type {
  StatusChipItem,
  StatusChipLabelOverflow,
  StatusChipSurface,
  StatusChipVariant
} from '../ui/status-chip'
import type { StatusChipOption } from '../ui/status-chip-select'
import type { TableRowListColumn } from '../ui/table-row-list'
import { UI_TONES, type UiTone } from '../../lib/uiTone'
import type { TableSortDirection, TableSortState } from '../../lib/tableSort'
import { cn } from '../../lib/utils'

export type DesignAuditDisplayTabId = 'badges-status' | 'cards-feedback' | 'tables-navigation'

export interface DesignAuditDisplayProps {
  tabId: DesignAuditDisplayTabId
}

const BADGE_VARIANTS = [
  'default',
  'secondary',
  'pill',
  'destructive',
  'outline',
  'tag0',
  'tag1',
  'tag2',
  'tag3',
  'tag4',
  'tag5',
  'neutral'
] as const

const STATUS_CHIP_VARIANTS: readonly StatusChipVariant[] = ['default', 'bare']
const STATUS_CHIP_SURFACES: readonly StatusChipSurface[] = [
  'none',
  'pill',
  'attention',
  'hover',
  'hover-pill'
]
const STATUS_CHIP_OVERFLOWS: readonly StatusChipLabelOverflow[] = ['truncate', 'wrap', 'fade']

const STATUS_ITEMS: readonly StatusChipItem[] = [
  {
    label: 'In review',
    icon: <Clock size={14} aria-hidden="true" />,
    iconColorToken: 'var(--warning)'
  },
  {
    label: 'Ready to ship',
    icon: <CircleCheck size={14} aria-hidden="true" />,
    iconColorToken: 'var(--success)'
  },
  {
    label: 'Needs attention',
    icon: <AlertCircle size={14} aria-hidden="true" />,
    iconColorToken: 'var(--destructive)'
  }
]

const STATUS_SELECT_OPTIONS: readonly StatusChipOption[] = [
  {
    value: 'review',
    label: 'In review',
    icon: <Clock size={14} aria-hidden="true" />,
    iconColorToken: 'var(--warning)'
  },
  {
    value: 'ready',
    label: 'Ready to ship',
    icon: <CircleCheck size={14} aria-hidden="true" />,
    iconColorToken: 'var(--success)'
  },
  {
    value: 'attention',
    label: 'Needs attention',
    icon: <AlertCircle size={14} aria-hidden="true" />,
    iconColorToken: 'var(--destructive)',
    mutedTrigger: true
  }
]

type DisplayTableRow = {
  id: string
  name: string
  category: string
  categoryOrder: number
  description: string
  updated: string
}

const DISPLAY_TABLE_ROWS: readonly DisplayTableRow[] = [
  {
    id: 'badge',
    name: 'Badge',
    category: 'Feedback',
    categoryOrder: 1,
    description: 'Compact labels for semantic status and categorization.',
    updated: 'Today'
  },
  {
    id: 'card',
    name: 'Card',
    category: 'Feedback',
    categoryOrder: 1,
    description: 'A hierarchy for grouping related content and actions.',
    updated: 'Yesterday'
  },
  {
    id: 'table',
    name: 'TableRowList',
    category: 'Navigation',
    categoryOrder: 2,
    description: 'A sortable, groupable row surface for workspace collections.',
    updated: 'Monday'
  },
  {
    id: 'workspace-rail',
    name: 'WorkspaceListRail',
    category: 'Navigation',
    categoryOrder: 2,
    description: 'A compact route list with active and supporting metadata.',
    updated: 'Friday'
  }
]

const ROW_LIST_COLUMNS: readonly TableRowListColumn<DisplayTableRow>[] = [
  {
    id: 'name',
    header: 'Name',
    headerClassName: 'min-w-44',
    cellClassName: 'min-w-44',
    sortValue: (row) => row.name,
    renderCell: (row) => (
      <WorkspaceTextFade className="min-w-0 font-medium text-foreground" title={row.name}>
        {row.name}
      </WorkspaceTextFade>
    )
  },
  {
    id: 'description',
    header: 'Description',
    headerClassName: 'min-w-72',
    cellClassName: 'min-w-72 max-w-[34rem]',
    sortValue: (row) => row.description,
    renderCell: (row) => (
      <WorkspaceTextFade className="min-w-0 text-muted-foreground" title={row.description}>
        {row.description}
      </WorkspaceTextFade>
    )
  },
  {
    id: 'updated',
    header: 'Updated',
    cellClassName: 'whitespace-nowrap',
    sortValue: (row) => row.updated,
    sortDefaultDirection: 'desc',
    renderCell: (row) => <span className="text-muted-foreground">{row.updated}</span>
  }
]

const LONG_TABLE_ROWS: readonly DisplayTableRow[] = [
  {
    id: 'long-1',
    name: 'A component with a deliberately long display name',
    category: 'Long content',
    categoryOrder: 1,
    description:
      'Long labels should remain readable without changing the workspace layout or causing controls to lose their focus treatment.',
    updated: 'A moment ago'
  },
  {
    id: 'long-2',
    name: 'A second component with an extended description',
    category: 'Long content',
    categoryOrder: 1,
    description:
      'The row list keeps its columns predictable while allowing the table viewport to scroll horizontally when content needs more room.',
    updated: 'Earlier today'
  }
]

function formatLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function AuditSection({
  id,
  heading,
  description,
  children
}: {
  id: DesignAuditDisplayTabId
  heading: string
  description: string
  children: React.ReactNode
}): React.ReactElement {
  const headingId = `design-audit-section-heading-${id}`

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-testid={`design-audit-section:${id}`}
      className="scroll-mt-6 space-y-8"
    >
      <header className="max-w-3xl space-y-2">
        <h2 id={headingId} className="text-2xl font-semibold tracking-tight text-foreground">
          {heading}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  )
}

function ComponentSpecimen({
  id,
  heading,
  description,
  children,
  className
}: {
  id: string
  heading: string
  description?: string
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  const headingId = `design-audit-component-heading-${id}`

  return (
    <article
      aria-labelledby={headingId}
      data-testid={`design-audit-component:${id}`}
      className={cn('min-w-0 space-y-4 border-t border-border pt-5', className)}
    >
      <header className="space-y-1">
        <h3 id={headingId} className="text-base font-semibold text-foreground">
          {heading}
        </h3>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </article>
  )
}

function VariantSpecimen({
  component,
  variant,
  children,
  className
}: {
  component: string
  variant: string
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <div
      data-testid={`design-audit-variant:${component}:${variant}`}
      className={cn('min-w-0 space-y-2', className)}
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {formatLabel(variant)}
      </p>
      {children}
    </div>
  )
}

function StatusItem({
  index = 0,
  label
}: {
  index?: number
  label?: React.ReactNode
}): StatusChipItem {
  return {
    ...STATUS_ITEMS[index % STATUS_ITEMS.length],
    label: label ?? STATUS_ITEMS[index % STATUS_ITEMS.length].label
  }
}

function DesignAuditBadgesStatus(): React.ReactElement {
  const [selectedStatus, setSelectedStatus] = React.useState('review')
  const [pressed, setPressed] = React.useState(false)

  return (
    <AuditSection
      id="badges-status"
      heading="Badges and status"
      description="Compact semantic feedback, selectable status controls, and grouped chip actions. Every local variant is shown against the transparent audit canvas."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <ComponentSpecimen
          id="badge"
          heading="Badge"
          description="All filled, outlined, neutral, tag, and semantic tone treatments."
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BADGE_VARIANTS.map((variant) => (
              <VariantSpecimen key={variant} component="badge" variant={variant}>
                <Badge variant={variant}>{formatLabel(variant)}</Badge>
              </VariantSpecimen>
            ))}
          </div>
          <div className="border-t border-border pt-5">
            <p className="text-sm font-medium text-foreground">UiTone values</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {UI_TONES.map((tone: UiTone) => (
                <VariantSpecimen key={tone} component="badge" variant={`tone-${tone}`}>
                  <Badge variant="outline" tone={tone}>
                    {formatLabel(tone)}
                  </Badge>
                </VariantSpecimen>
              ))}
            </div>
          </div>
        </ComponentSpecimen>

        <ComponentSpecimen
          id="status-chip"
          heading="StatusChip"
          description="Default and bare variants, every surface, label-overflow mode, muted copy, and button behavior."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {STATUS_CHIP_VARIANTS.map((variant, index) => (
              <VariantSpecimen key={variant} component="status-chip" variant={variant}>
                <StatusChip item={StatusItem({ index })} variant={variant} />
              </VariantSpecimen>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STATUS_CHIP_SURFACES.map((surface, index) => (
              <VariantSpecimen key={surface} component="status-chip" variant={`surface-${surface}`}>
                <StatusChip item={StatusItem({ index })} surface={surface} />
              </VariantSpecimen>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STATUS_CHIP_OVERFLOWS.map((overflow) => (
              <VariantSpecimen
                key={overflow}
                component="status-chip"
                variant={`overflow-${overflow}`}
              >
                <div className="max-w-44">
                  <StatusChip
                    item={StatusItem({
                      label: 'A status label that needs an overflow treatment'
                    })}
                    labelOverflow={overflow}
                    className="w-full"
                  />
                </div>
              </VariantSpecimen>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <VariantSpecimen component="status-chip" variant="wrap-label">
              <StatusChip
                item={StatusItem({ label: 'A status label that wraps when requested' })}
                wrapLabel
                className="max-w-48"
              />
            </VariantSpecimen>
            <VariantSpecimen component="status-chip" variant="muted">
              <StatusChip item={StatusItem({ label: 'Muted metadata' })} mutedLabel />
            </VariantSpecimen>
            <VariantSpecimen component="status-chip" variant="button">
              <StatusChip
                as="button"
                type="button"
                item={StatusItem({ label: pressed ? 'Pressed status' : 'Pressable status' })}
                surface="hover-pill"
                aria-pressed={pressed}
                onClick={() => setPressed((current) => !current)}
              />
            </VariantSpecimen>
          </div>
        </ComponentSpecimen>

        <ComponentSpecimen
          id="status-chip-select"
          heading="StatusChipSelect"
          description="A searchable single-selection status control with muted, bare, and disabled trigger states."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <VariantSpecimen component="status-chip-select" variant="single-pill">
              <StatusChipSelect
                label="Review status"
                value={selectedStatus}
                options={STATUS_SELECT_OPTIONS}
                surface="pill"
                onValueChange={setSelectedStatus}
                aria-label="Review status"
              />
            </VariantSpecimen>
            <VariantSpecimen component="status-chip-select" variant="bare">
              <StatusChipSelect
                label="Review status"
                value={selectedStatus}
                options={STATUS_SELECT_OPTIONS}
                variant="bare"
                showValue={false}
                onValueChange={setSelectedStatus}
                aria-label="Choose review status"
              />
            </VariantSpecimen>
            <VariantSpecimen component="status-chip-select" variant="disabled">
              <StatusChipSelect
                label="Review status"
                value={selectedStatus}
                options={STATUS_SELECT_OPTIONS}
                surface="pill"
                disabled
                onValueChange={() => undefined}
                aria-label="Disabled review status"
              />
            </VariantSpecimen>
          </div>
        </ComponentSpecimen>

        <ComponentSpecimen
          id="chip-group"
          heading="ChipGroup"
          description="A compact semantic group that keeps a selectable chip and a trailing action aligned."
        >
          <VariantSpecimen component="chip-group" variant="segmented-actions">
            <ChipGroup aria-label="Audit filters" data-testid="design-audit-chip-group">
              <StatusChipSelect
                label="Filter status"
                value={selectedStatus}
                options={STATUS_SELECT_OPTIONS}
                surface="none"
                onValueChange={setSelectedStatus}
                aria-label="Filter status"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Add audit filter"
                onClick={() => undefined}
              >
                <Plus size={16} aria-hidden="true" />
              </Button>
            </ChipGroup>
          </VariantSpecimen>
        </ComponentSpecimen>
      </div>
    </AuditSection>
  )
}

function DesignAuditCardsFeedback(): React.ReactElement {
  return (
    <AuditSection
      id="cards-feedback"
      heading="Cards and feedback"
      description="Content hierarchy, empty states, progress boundaries, and structural separators with no page-level card shell."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <ComponentSpecimen
          id="card"
          heading="Card hierarchy"
          description="The filled surface belongs to Card; the surrounding specimen remains transparent."
        >
          <VariantSpecimen component="card" variant="hierarchy">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle>Review the display audit</CardTitle>
                <CardDescription>
                  Header, title, description, content, and footer maintain a readable hierarchy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Card content can carry supporting copy, controls, or a nested status without
                  competing with the document workspace background.
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone="success">Audited</Badge>
                  <span>Surface and text tokens are shared.</span>
                </div>
              </CardContent>
              <CardFooter className="justify-between gap-3">
                <span className="text-xs text-muted-foreground">Last checked today</span>
                <Button size="sm">Continue</Button>
              </CardFooter>
            </Card>
          </VariantSpecimen>
        </ComponentSpecimen>

        <ComponentSpecimen
          id="empty-state"
          heading="EmptyState"
          description="Empty, actionable, and custom-content states retain the same accessible heading and description contract."
        >
          <div className="grid gap-5 md:grid-cols-3">
            <VariantSpecimen component="empty-state" variant="default">
              <EmptyState
                icon={Inbox}
                title="Nothing here yet"
                description="A quiet, informative state for an empty collection."
                className="min-h-44 rounded-[var(--radius-surface)] border border-dashed border-border px-4 py-6"
              />
            </VariantSpecimen>
            <VariantSpecimen component="empty-state" variant="action">
              <EmptyState
                icon={Archive}
                title="No archived items"
                description="Give the user a direct next step when the empty state is recoverable."
                action={<Button size="sm">Browse items</Button>}
                className="min-h-44 rounded-[var(--radius-surface)] border border-dashed border-border px-4 py-6"
              />
            </VariantSpecimen>
            <VariantSpecimen component="empty-state" variant="custom-content">
              <EmptyState
                icon={CircleCheck}
                title="All caught up"
                description="Custom content can add a small contextual hint below the description."
                className="min-h-44 rounded-[var(--radius-surface)] border border-dashed border-border px-4 py-6"
              >
                <p className="rounded-[var(--radius-control)] border border-border px-3 py-2 text-xs text-muted-foreground">
                  New activity will appear here.
                </p>
              </EmptyState>
            </VariantSpecimen>
          </div>
        </ComponentSpecimen>

        <ComponentSpecimen
          id="progress-ring"
          heading="ProgressRing"
          description="Values are clamped at the 0 and 100 boundaries while size remains an explicit visual property."
        >
          <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { id: 'below-zero', value: -20, label: '−20 → 0' },
              { id: 'zero', value: 0, label: '0%' },
              { id: 'half', value: 50, label: '50%' },
              { id: 'complete', value: 100, label: '100%' },
              { id: 'above-hundred', value: 120, label: '120 → 100' }
            ].map((entry) => (
              <VariantSpecimen
                key={entry.id}
                component="progress-ring"
                variant={`value-${entry.id}`}
              >
                <div className="flex items-center gap-3">
                  <ProgressRing value={entry.value} size={32} />
                  <span className="text-sm text-muted-foreground">{entry.label}</span>
                </div>
              </VariantSpecimen>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-8">
            {[16, 20, 32, 48].map((size) => (
              <VariantSpecimen key={size} component="progress-ring" variant={`size-${size}`}>
                <div className="flex flex-col items-center gap-2">
                  <ProgressRing value={72} size={size} />
                  <span className="text-xs text-muted-foreground">{size}px</span>
                </div>
              </VariantSpecimen>
            ))}
          </div>
        </ComponentSpecimen>

        <ComponentSpecimen
          id="separator"
          heading="Separator"
          description="Horizontal and vertical rules support decorative and semantic separator roles."
        >
          <div className="space-y-5">
            <VariantSpecimen component="separator" variant="horizontal">
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Content above the rule</p>
                <Separator />
                <p>Content below the rule</p>
              </div>
            </VariantSpecimen>
            <VariantSpecimen component="separator" variant="vertical">
              <div className="flex h-10 items-center gap-3 text-sm text-muted-foreground">
                <span>Leading content</span>
                <Separator orientation="vertical" />
                <span>Trailing content</span>
              </div>
            </VariantSpecimen>
            <VariantSpecimen component="separator" variant="semantic">
              <Separator
                orientation="horizontal"
                decorative={false}
                aria-label="Section boundary"
              />
            </VariantSpecimen>
          </div>
        </ComponentSpecimen>
      </div>
    </AuditSection>
  )
}

function DesignAuditTablesNavigation(): React.ReactElement {
  const [tableSortDirection, setTableSortDirection] = React.useState<TableSortDirection>('asc')
  const [rowListSort, setRowListSort] = React.useState<TableSortState | null>({
    columnId: 'name',
    direction: 'asc'
  })

  const sortedTableRows = React.useMemo(
    () =>
      [...DISPLAY_TABLE_ROWS].sort((left, right) => {
        const comparison = left.name.localeCompare(right.name)
        return tableSortDirection === 'asc' ? comparison : -comparison
      }),
    [tableSortDirection]
  )

  return (
    <AuditSection
      id="tables-navigation"
      heading="Tables and navigation"
      description="Sortable and grouped data, empty and long-content states, breadcrumb trails, and workspace list navigation."
    >
      <div className="grid gap-10 xl:grid-cols-2">
        <ComponentSpecimen
          id="table"
          heading="Table"
          description="The base table exposes sortable headers, an empty body state, and a long-content viewport."
          className="xl:col-span-2"
        >
          <div className="grid gap-8 xl:grid-cols-2">
            <VariantSpecimen component="table" variant="sortable">
              <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border">
                <Table
                  aria-label="Sortable display primitives"
                  data-testid="design-audit-table-sortable"
                >
                  <TableCaption>Click Name to toggle ascending and descending order.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        isActive
                        sortDirection={tableSortDirection}
                        onToggleSort={() =>
                          setTableSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
                        }
                      >
                        Name
                      </SortableTableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTableRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-64 font-medium text-foreground">
                          <WorkspaceTextFade title={row.name}>{row.name}</WorkspaceTextFade>
                        </TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {row.updated}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </VariantSpecimen>

            <VariantSpecimen component="table" variant="empty">
              <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border">
                <Table aria-label="Empty display primitives" data-testid="design-audit-table-empty">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Primitive</TableHead>
                      <TableHead>Purpose</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={2} className="px-4 py-0">
                        <EmptyState
                          icon={Inbox}
                          title="No primitives found"
                          description="The table keeps its header while the body explains the empty result."
                          className="min-h-36 px-2 py-8"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </VariantSpecimen>

            <VariantSpecimen component="table" variant="long-content">
              <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border">
                <Table
                  aria-label="Long content display primitives"
                  className="min-w-[52rem]"
                  data-testid="design-audit-table-long"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Long primitive name</TableHead>
                      <TableHead>Long description</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {LONG_TABLE_ROWS.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="min-w-64 max-w-72 font-medium text-foreground">
                          <WorkspaceTextFade title={row.name}>{row.name}</WorkspaceTextFade>
                        </TableCell>
                        <TableCell className="min-w-[34rem] text-muted-foreground">
                          <WorkspaceTextFade title={row.description}>
                            {row.description}
                          </WorkspaceTextFade>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {row.updated}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </VariantSpecimen>
          </div>
        </ComponentSpecimen>

        <ComponentSpecimen
          id="table-row-list"
          heading="TableRowList"
          description="Shared row-list columns support sorting, grouped headers, empty results, and wide long-content rows."
          className="xl:col-span-2"
        >
          <div className="grid gap-8 xl:grid-cols-2">
            <VariantSpecimen component="table-row-list" variant="grouped">
              <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border">
                <TableRowList
                  aria-label="Grouped display primitives"
                  data-testid="design-audit-table-row-list-grouped"
                  items={DISPLAY_TABLE_ROWS}
                  columns={ROW_LIST_COLUMNS}
                  getRowKey={(row) => row.id}
                  getGroup={(row) => ({
                    id: row.category.toLowerCase(),
                    label: row.category,
                    sortValue: row.categoryOrder
                  })}
                  sortState={rowListSort}
                  onSortChange={(nextSort) => setRowListSort(nextSort)}
                  getRowProps={(row) => ({
                    'data-testid': `design-audit-table-row-list-row:${row.id}`
                  })}
                  className="min-w-[42rem]"
                />
              </div>
            </VariantSpecimen>

            <VariantSpecimen component="table-row-list" variant="empty">
              <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border">
                <TableRowList
                  aria-label="Empty display primitives"
                  data-testid="design-audit-table-row-list-empty"
                  items={[]}
                  columns={ROW_LIST_COLUMNS}
                  getRowKey={(row) => row.id}
                  hideHeader
                />
                <EmptyState
                  icon={Archive}
                  title="No rows to display"
                  description="An empty row list can pair with a clear recovery action."
                  action={<Button size="sm">Add primitive</Button>}
                  className="min-h-36 border-t border-border px-4 py-8"
                />
              </div>
            </VariantSpecimen>

            <VariantSpecimen component="table-row-list" variant="long-content">
              <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border">
                <TableRowList
                  aria-label="Long-content display primitives"
                  data-testid="design-audit-table-row-list-long"
                  items={LONG_TABLE_ROWS}
                  columns={ROW_LIST_COLUMNS}
                  getRowKey={(row) => row.id}
                  className="min-w-[48rem]"
                />
              </div>
            </VariantSpecimen>
          </div>
        </ComponentSpecimen>

        <ComponentSpecimen
          id="breadcrumb"
          heading="Breadcrumb"
          description="Link, button, icon-label, current-page, label, separator, and collapsed ellipsis variants."
        >
          <div className="space-y-6">
            <VariantSpecimen component="breadcrumb" variant="default">
              <Breadcrumb data-testid="design-audit-breadcrumb-default">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#" onClick={(event) => event.preventDefault()}>
                      Workspace
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLabel>Design system</BreadcrumbLabel>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Display</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </VariantSpecimen>
            <VariantSpecimen component="breadcrumb" variant="button">
              <Breadcrumb data-testid="design-audit-breadcrumb-button">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbButton onClick={() => undefined}>Workspace</BreadcrumbButton>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Audit details</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </VariantSpecimen>
            <VariantSpecimen component="breadcrumb" variant="icon-label">
              <Breadcrumb data-testid="design-audit-breadcrumb-icon-label">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbIconLabel icon={<Layers3 size={14} aria-hidden="true" />}>
                      Component library
                    </BreadcrumbIconLabel>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <span aria-hidden="true">/</span>
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Status</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </VariantSpecimen>
            <VariantSpecimen component="breadcrumb" variant="ellipsis">
              <Breadcrumb data-testid="design-audit-breadcrumb-ellipsis">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#" onClick={(event) => event.preventDefault()}>
                      Workspace
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbEllipsis />
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Current page</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </VariantSpecimen>
          </div>
        </ComponentSpecimen>

        <ComponentSpecimen
          id="workspace-list-rail"
          heading="WorkspaceListRail"
          description="Navigation items expose active and idle states with optional descriptions, leading icons, and trailing metadata."
        >
          <VariantSpecimen component="workspace-list-rail" variant="items">
            <div className="rounded-[var(--radius-surface)] border border-border">
              <WorkspaceListRail aria-label="Display audit destinations">
                <WorkspaceListRailItem
                  active
                  leading={<LayoutDashboard size={16} aria-hidden="true" />}
                  data-testid="design-audit-variant:workspace-list-rail:active"
                >
                  Active destination
                </WorkspaceListRailItem>
                <WorkspaceListRailItem data-testid="design-audit-variant:workspace-list-rail:idle">
                  Idle destination
                </WorkspaceListRailItem>
                <WorkspaceListRailItem
                  description="Supporting context stays on a second line."
                  data-testid="design-audit-variant:workspace-list-rail:description"
                >
                  With description
                </WorkspaceListRailItem>
                <WorkspaceListRailItem
                  leading={<Palette size={16} aria-hidden="true" />}
                  data-testid="design-audit-variant:workspace-list-rail:leading"
                >
                  With leading icon
                </WorkspaceListRailItem>
                <WorkspaceListRailItem
                  trailing={<Badge variant="neutral">3</Badge>}
                  data-testid="design-audit-variant:workspace-list-rail:trailing"
                >
                  With trailing metadata
                </WorkspaceListRailItem>
              </WorkspaceListRail>
            </div>
          </VariantSpecimen>
          <VariantSpecimen component="workspace-list-rail" variant="empty">
            <div className="rounded-[var(--radius-surface)] border border-border">
              <WorkspaceListRail
                aria-label="Empty display audit destinations"
                data-testid="design-audit-variant:workspace-list-rail:empty"
                emptyState="No destinations available."
              />
            </div>
          </VariantSpecimen>
        </ComponentSpecimen>
      </div>
    </AuditSection>
  )
}

export function DesignAuditDisplay({ tabId }: DesignAuditDisplayProps): React.ReactElement {
  return (
    <div
      data-testid="design-audit-display"
      data-audit-tab={tabId}
      className="min-w-0 space-y-10 bg-transparent text-foreground"
    >
      {tabId === 'badges-status' ? <DesignAuditBadgesStatus /> : null}
      {tabId === 'cards-feedback' ? <DesignAuditCardsFeedback /> : null}
      {tabId === 'tables-navigation' ? <DesignAuditTablesNavigation /> : null}
    </div>
  )
}
