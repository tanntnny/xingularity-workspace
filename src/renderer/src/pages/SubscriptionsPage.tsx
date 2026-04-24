import { ReactElement, useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { Archive, CalendarClock, Landmark, Pencil, Plus, Trash2, WalletCards } from 'lucide-react'
import {
  deriveSubscriptionAnalytics,
  getBillingIntervalMonths,
  getRenewalBucket
} from '../../../shared/subscriptions'
import type {
  CreateSubscriptionInput,
  RendererVaultApi,
  SubscriptionRecord,
  SubscriptionReviewFlag,
  SubscriptionStatus,
  UpdateSubscriptionInput
} from '../../../shared/types'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '../components/ui/drawer'
import { Input } from '../components/ui/input'
import { FloatingHoverCard } from '../components/ui/floating-hover-card'
import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table'

interface SubscriptionsPageProps {
  vaultApi: RendererVaultApi | undefined
  pushToast: (kind: 'info' | 'error' | 'success', message: string) => void
}

type SortField = 'name' | 'category' | 'amount' | 'nextRenewalAt' | 'status'
type SortDirection = 'asc' | 'desc'
type ModalDraft = {
  id?: string
  name: string
  provider: string
  category: string
  amount: string
  billingCycle: CreateSubscriptionInput['billingCycle']
  billingIntervalMonths: string
  nextRenewalAt: string
  status: SubscriptionStatus
  reviewFlag: SubscriptionReviewFlag
  lastUsedAt: string
  tags: string
  notes: string
}

const STATUS_OPTIONS: SubscriptionStatus[] = ['active', 'paused', 'cancelled', 'archived']
const REVIEW_OPTIONS: SubscriptionReviewFlag[] = [
  'none',
  'review',
  'unused',
  'duplicate',
  'expensive'
]
const BILLING_CYCLE_OPTIONS: CreateSubscriptionInput['billingCycle'][] = [
  'monthly',
  'quarterly',
  'yearly',
  'custom'
]
const TREEMAP_WIDTH = 1000
const TREEMAP_HEIGHT = 380
const DEFAULT_CATEGORY_OPTIONS = [
  'AI',
  'Cloud',
  'Communication',
  'Design',
  'Developer tools',
  'Finance',
  'Infrastructure',
  'Marketing',
  'Operations',
  'Productivity'
]

type TreemapLeafNode = {
  id: string
  category: string
  name: string
  provider?: string
  status: SubscriptionStatus
  amount: number
  billingCycle: CreateSubscriptionInput['billingCycle']
  nextRenewalAt?: string
  x0: number
  y0: number
  x1: number
  y1: number
  value: number
  reviewFlag: SubscriptionReviewFlag
  renewalBucket?: 'soon' | 'later'
}

type TreemapCategoryNode = {
  category: string
  x0: number
  y0: number
  x1: number
  y1: number
  value: number
  count: number
}

type TreemapHoverCard =
  | ({
      kind: 'record'
      x: number
      y: number
    } & TreemapLeafNode)
  | ({
      kind: 'category'
      x: number
      y: number
    } & TreemapCategoryNode)

function emptyDraft(): ModalDraft {
  return {
    name: '',
    provider: '',
    category: '',
    amount: '',
    billingCycle: 'monthly',
    billingIntervalMonths: '1',
    nextRenewalAt: '',
    status: 'active',
    reviewFlag: 'none',
    lastUsedAt: '',
    tags: '',
    notes: ''
  }
}

function toDateInputValue(value?: string): string {
  return value ? value.slice(0, 10) : ''
}

function clampLabel(value: string, maxChars: number): string {
  if (maxChars <= 0 || value.length <= maxChars) {
    return value
  }

  if (maxChars <= 1) {
    return value.slice(0, maxChars)
  }

  return `${value.slice(0, Math.max(1, maxChars - 1))}…`
}

function getHoverPositionFromMouse(clientX: number, clientY: number): { x: number; y: number } {
  const hoverWidth = 280
  const hoverHeight = 168
  const margin = 16
  const cursorOffset = 18

  const x = Math.max(
    margin,
    Math.min(clientX + cursorOffset, window.innerWidth - hoverWidth - margin)
  )
  const y = Math.max(
    margin,
    Math.min(clientY + cursorOffset, window.innerHeight - hoverHeight - margin)
  )

  return { x, y }
}

function draftFromRecord(record: SubscriptionRecord): ModalDraft {
  return {
    id: record.id,
    name: record.name,
    provider: record.provider ?? '',
    category: record.category,
    amount: String(record.amount),
    billingCycle: record.billingCycle,
    billingIntervalMonths: String(record.billingIntervalMonths),
    nextRenewalAt: toDateInputValue(record.nextRenewalAt),
    status: record.status,
    reviewFlag: record.reviewFlag ?? 'none',
    lastUsedAt: toDateInputValue(record.lastUsedAt),
    tags: (record.tags ?? []).join(', '),
    notes: record.notes ?? ''
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2
  }).format(value)
}

function formatRenewalLabel(value?: string): string {
  if (!value) {
    return 'No renewal date'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value))
}

function formatRelativeRenewal(value?: string): string {
  if (!value) {
    return 'No date'
  }

  const diffMs = new Date(value).getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) {
    return `${Math.abs(diffDays)}d overdue`
  }
  if (diffDays === 0) {
    return 'Today'
  }
  if (diffDays === 1) {
    return 'Tomorrow'
  }
  return `In ${diffDays}d`
}

function statusTone(status: SubscriptionStatus): string {
  if (status === 'active') {
    return 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200'
  }
  if (status === 'paused') {
    return 'border-amber-500/30 bg-amber-500/12 text-amber-100'
  }
  if (status === 'cancelled') {
    return 'border-slate-500/30 bg-slate-500/12 text-slate-200'
  }
  return 'border-neutral-500/30 bg-neutral-500/12 text-neutral-200'
}

function reviewTone(flag: SubscriptionReviewFlag): string {
  if (flag === 'unused' || flag === 'duplicate') {
    return 'border-rose-500/30 bg-rose-500/12 text-rose-100'
  }
  if (flag === 'expensive' || flag === 'review') {
    return 'border-amber-500/30 bg-amber-500/12 text-amber-100'
  }
  return 'border-slate-500/30 bg-slate-500/12 text-slate-200'
}

function buildSubscriptionTooltip(record: SubscriptionRecord): string {
  return [
    record.name,
    `Category: ${record.category}`,
    `Status: ${record.status}`,
    `Billing: ${record.billingCycle}`,
    `Monthly: ${formatCurrency(record.normalizedMonthlyAmount)}`,
    `Next renewal: ${formatRenewalLabel(record.nextRenewalAt)}`
  ].join('\n')
}

function toCreateInput(draft: ModalDraft): CreateSubscriptionInput {
  const billingIntervalMonths =
    draft.billingCycle === 'custom'
      ? Math.max(1, Number(draft.billingIntervalMonths || '1'))
      : getBillingIntervalMonths(draft.billingCycle)

  return {
    name: draft.name.trim(),
    provider: draft.provider.trim() || undefined,
    category: draft.category.trim(),
    amount: Number(draft.amount),
    currency: 'THB',
    billingCycle: draft.billingCycle,
    billingIntervalMonths,
    nextRenewalAt: draft.nextRenewalAt || undefined,
    status: draft.status,
    reviewFlag: draft.reviewFlag,
    lastUsedAt: draft.lastUsedAt || undefined,
    tags: draft.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    notes: draft.notes.trim() || undefined
  }
}

function toUpdateInput(draft: ModalDraft): UpdateSubscriptionInput {
  return {
    id: draft.id ?? '',
    ...toCreateInput(draft)
  }
}

function buildTreemap(records: SubscriptionRecord[]): {
  nodes: TreemapLeafNode[]
  categoryNodes: TreemapCategoryNode[]
} {
  const grouped = d3.group(records, (record) => record.category)
  const hierarchy = d3
    .hierarchy({
      name: 'subscriptions',
      children: Array.from(grouped, ([category, items]) => ({
        name: category,
        children: items.map((item) => ({
          ...item,
          value: item.normalizedMonthlyAmount
        }))
      }))
    })
    .sum((node) => Number((node as { value?: number }).value ?? 0))
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))

  d3
    .treemap<typeof hierarchy.data>()
    .size([TREEMAP_WIDTH, TREEMAP_HEIGHT])
    .paddingOuter(8)
    .paddingTop(42)
    .paddingInner(4)
    .round(true)(hierarchy)

  return {
    nodes: hierarchy.leaves().map((leaf) => {
      const record = leaf.data as SubscriptionRecord & { value: number }
      return {
        id: record.id,
        category: record.category,
        name: record.name,
        provider: record.provider,
        status: record.status,
        amount: record.amount,
        billingCycle: record.billingCycle,
        nextRenewalAt: record.nextRenewalAt,
        x0: leaf.x0,
        y0: leaf.y0,
        x1: leaf.x1,
        y1: leaf.y1,
        value: record.normalizedMonthlyAmount,
        reviewFlag: record.reviewFlag ?? 'none',
        renewalBucket: getRenewalBucket(record.nextRenewalAt)
      }
    }),
    categoryNodes:
      hierarchy.children?.map((node) => ({
        category: String(node.data.name),
        x0: node.x0,
        y0: node.y0,
        x1: node.x1,
        y1: node.y1,
        value: node.value ?? 0,
        count: node.leaves().length
      })) ?? []
  }
}

function TreemapCard({
  records,
  categories,
  selectedId,
  statusFilter,
  activeCategory,
  onOpenCreate,
  onChangeStatusFilter,
  onSelectCategory,
  onSelectRecord
}: {
  records: SubscriptionRecord[]
  categories: string[]
  selectedId: string | null
  statusFilter: 'all' | SubscriptionStatus
  activeCategory: string | null
  onOpenCreate: () => void
  onChangeStatusFilter: (value: 'all' | SubscriptionStatus) => void
  onSelectCategory: (category: string | null) => void
  onSelectRecord: (id: string) => void
}): ReactElement {
  const [hoverCard, setHoverCard] = useState<TreemapHoverCard | null>(null)

  if (!records.length) {
    return (
      <div className="workspace-subtle-surface rounded-[24px]">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <div className="mb-4 border-t border-[var(--line)]" />
          <h2 className="text-base font-semibold text-[var(--text)]">Recurring spend map</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Category to service hierarchy sized by normalized monthly spend
          </p>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                aria-label="Status filter"
                value={statusFilter}
                onChange={(event) =>
                  onChangeStatusFilter(event.currentTarget.value as 'all' | SubscriptionStatus)
                }
                className="workspace-subtle-control h-9 rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--text)]"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                aria-label="Category filter"
                value={activeCategory ?? 'all'}
                onChange={(event) =>
                  onSelectCategory(
                    event.currentTarget.value === 'all' ? null : event.currentTarget.value
                  )
                }
                className="workspace-subtle-control h-9 rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--text)]"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={onOpenCreate} className="gap-2 self-start">
              <Plus size={14} />
              Add subscription
            </Button>
          </div>
        </div>
        <div className="p-8">
          <p className="text-sm text-[var(--muted)]">
            The treemap will appear once you add active subscriptions.
          </p>
        </div>
      </div>
    )
  }

  const { nodes, categoryNodes } = buildTreemap(records)

  return (
    <>
      <div className="workspace-subtle-surface overflow-hidden rounded-[24px] px-5 shadow-[0_18px_60px_rgba(5,10,18,0.12)]">
        <div className="border-b border-[var(--line)] py-4">
          <div className="mb-4 border-t border-[var(--line)]" />
          <h2 className="text-base font-semibold text-[var(--text)]">Recurring spend map</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Category to service hierarchy sized by normalized monthly spend
          </p>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <select
                aria-label="Status filter"
                value={statusFilter}
                onChange={(event) =>
                  onChangeStatusFilter(event.currentTarget.value as 'all' | SubscriptionStatus)
                }
                className="workspace-subtle-control h-9 rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--text)]"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                aria-label="Category filter"
                value={activeCategory ?? 'all'}
                onChange={(event) =>
                  onSelectCategory(
                    event.currentTarget.value === 'all' ? null : event.currentTarget.value
                  )
                }
                className="workspace-subtle-control h-9 rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--text)]"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {statusFilter !== 'all' || activeCategory ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChangeStatusFilter('all')
                    onSelectCategory(null)
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
            <Button onClick={onOpenCreate} className="gap-2 self-start">
              <Plus size={14} />
              Add subscription
            </Button>
          </div>
        </div>
        <svg
          viewBox={`0 0 ${TREEMAP_WIDTH} ${TREEMAP_HEIGHT}`}
          className=""
          role="img"
          aria-label="Subscriptions treemap"
        >
          {categoryNodes.map((node) => {
            const width = Math.max(0, node.x1 - node.x0)
            const height = Math.max(0, node.y1 - node.y0)
            const showValue = width > 180 && height > 56
            const categoryLabel = clampLabel(
              node.category,
              Math.floor((width - (showValue ? 118 : 30)) / 7)
            )

            return (
              <g key={node.category}>
                <rect
                  x={node.x0}
                  y={node.y0}
                  width={width}
                  height={height}
                  fill="transparent"
                  stroke={
                    activeCategory === node.category ? 'var(--accent)' : 'rgba(255,255,255,0.08)'
                  }
                  strokeWidth={activeCategory === node.category ? 2 : 1}
                  rx={8}
                  className="cursor-pointer"
                  onClick={() =>
                    onSelectCategory(activeCategory === node.category ? null : node.category)
                  }
                  onMouseEnter={(event) => {
                    const { x, y } = getHoverPositionFromMouse(event.clientX, event.clientY)
                    setHoverCard({
                      kind: 'category',
                      ...node,
                      x,
                      y
                    })
                  }}
                  onMouseMove={(event) => {
                    const { x, y } = getHoverPositionFromMouse(event.clientX, event.clientY)
                    setHoverCard((current) =>
                      current?.kind === 'category' && current.category === node.category
                        ? { ...current, x, y }
                        : {
                            kind: 'category',
                            ...node,
                            x,
                            y
                          }
                    )
                  }}
                  onMouseLeave={() => setHoverCard(null)}
                />
                <text
                  x={node.x0 + 12}
                  y={node.y0 + 18}
                  fill="rgba(255,255,255,0.72)"
                  fontSize="12"
                  fontWeight="600"
                  pointerEvents="none"
                  dominantBaseline="hanging"
                >
                  {` ${categoryLabel} `}
                  {showValue ? (
                    <tspan fill="rgba(255,255,255,0.58)" fontSize="11" fontWeight="500">
                      {`${formatCurrency(node.value)} /mo`}
                    </tspan>
                  ) : null}
                </text>
              </g>
            )
          })}
          {nodes.map((node) => {
            const width = node.x1 - node.x0
            const height = node.y1 - node.y0
            const isSelected = selectedId === node.id
            const canShowName = width > 86 && height > 28
            const canShowPrice = width > 112 && height > 48
            const fill =
              node.reviewFlag === 'unused' || node.reviewFlag === 'duplicate'
                ? '#84263b'
                : node.renewalBucket === 'soon'
                  ? '#8c6406'
                  : '#164f63'
            const labelX = node.x0 + 12
            const labelY = node.y0 + 24
            const labelWidth = Math.floor((width - 24) / 7)

            return (
              <g key={node.id}>
                <rect
                  x={node.x0}
                  y={node.y0}
                  width={width}
                  height={height}
                  rx={14}
                  fill={fill}
                  stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={isSelected ? 2.5 : 1}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                  onClick={() => onSelectRecord(node.id)}
                  onMouseEnter={(event) => {
                    const { x, y } = getHoverPositionFromMouse(event.clientX, event.clientY)
                    setHoverCard({
                      kind: 'record',
                      ...node,
                      x,
                      y
                    })
                  }}
                  onMouseMove={(event) => {
                    const { x, y } = getHoverPositionFromMouse(event.clientX, event.clientY)
                    setHoverCard((current) =>
                      current?.kind === 'record' && current.id === node.id
                        ? { ...current, x, y }
                        : {
                            kind: 'record',
                            ...node,
                            x,
                            y
                          }
                    )
                  }}
                  onMouseLeave={() => setHoverCard(null)}
                />
                {canShowName ? (
                  <text
                    x={labelX}
                    y={labelY}
                    fill="#f6f8fb"
                    fontSize="13"
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {clampLabel(node.name, labelWidth)}
                  </text>
                ) : null}
                {canShowPrice ? (
                  <text
                    x={labelX}
                    y={labelY + 18}
                    fill="rgba(246,248,251,0.82)"
                    fontSize="11"
                    fontWeight="500"
                    pointerEvents="none"
                  >
                    {`${formatCurrency(node.value)} /mo`}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
      {hoverCard ? (
        <FloatingHoverCard x={hoverCard.x} y={hoverCard.y} className="w-72">
              {hoverCard.kind === 'record' ? (
                <>
                  <div className="mb-1.5 text-sm font-semibold text-[var(--text)]">
                    {hoverCard.name}
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>{hoverCard.category}</span>
                    <span>{hoverCard.status}</span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    Monthly: {formatCurrency(hoverCard.value)}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Billing: {formatCurrency(hoverCard.amount)} / {hoverCard.billingCycle}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Renewal: {formatRenewalLabel(hoverCard.nextRenewalAt)}
                  </div>
                  {hoverCard.provider ? (
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Provider: {hoverCard.provider}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="mb-1.5 text-sm font-semibold text-[var(--text)]">
                    {hoverCard.category}
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>
                      {hoverCard.count} subscription{hoverCard.count === 1 ? '' : 's'}
                    </span>
                    <span>Category</span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    Total monthly: {formatCurrency(hoverCard.value)}
                  </div>
                </>
              )}
        </FloatingHoverCard>
      ) : null}
    </>
  )
}

export function SubscriptionsPage({ vaultApi, pushToast }: SubscriptionsPageProps): ReactElement {
  const subscriptionsApi = vaultApi?.subscriptions
  const [records, setRecords] = useState<SubscriptionRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('amount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [draft, setDraft] = useState<ModalDraft>(emptyDraft())
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!subscriptionsApi) {
      return
    }

    let active = true
    setIsLoading(true)
    void subscriptionsApi
      .list()
      .then((items) => {
        if (!active) {
          return
        }
        setRecords(items)
        setSelectedId(items[0]?.id ?? null)
      })
      .catch((error) => pushToast('error', String(error)))
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [pushToast, subscriptionsApi])

  const categories = useMemo(
    () =>
      Array.from(new Set(records.map((record) => record.category))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [records]
  )
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([...DEFAULT_CATEGORY_OPTIONS, ...categories, draft.category].filter(Boolean))
      ).sort((left, right) => left.localeCompare(right)),
    [categories, draft.category]
  )

  const filteredRecords = useMemo(() => {
    const filtered = records.filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) {
        return false
      }
      if (categoryFilter && record.category !== categoryFilter) {
        return false
      }
      return true
    })

    return filtered.sort((left, right) => {
      let comparison = 0
      if (sortField === 'name') {
        comparison = left.name.localeCompare(right.name)
      } else if (sortField === 'category') {
        comparison = left.category.localeCompare(right.category)
      } else if (sortField === 'status') {
        comparison = left.status.localeCompare(right.status)
      } else if (sortField === 'nextRenewalAt') {
        comparison = (left.nextRenewalAt ?? '9999').localeCompare(right.nextRenewalAt ?? '9999')
      } else {
        comparison = left.normalizedMonthlyAmount - right.normalizedMonthlyAmount
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [categoryFilter, records, sortDirection, sortField, statusFilter])

  const analytics = useMemo(
    () =>
      deriveSubscriptionAnalytics(records, {
        categories: categoryFilter ? [categoryFilter] : undefined,
        statuses: statusFilter === 'all' ? undefined : [statusFilter]
      }),
    [categoryFilter, records, statusFilter]
  )

  const treemapRecords = useMemo(
    () =>
      filteredRecords.filter(
        (record) => record.status === 'active' && record.normalizedMonthlyAmount > 0
      ),
    [filteredRecords]
  )

  const upsertRecord = (next: SubscriptionRecord): void => {
    setRecords((current) => {
      const index = current.findIndex((record) => record.id === next.id)
      if (index === -1) {
        return [next, ...current]
      }
      const updated = [...current]
      updated[index] = next
      return updated
    })
    setSelectedId(next.id)
  }

  const openCreateModal = (): void => {
    setDraft(emptyDraft())
    setIsDrawerOpen(true)
  }

  const openEditModal = (record: SubscriptionRecord): void => {
    setDraft(draftFromRecord(record))
    setIsDrawerOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    if (!subscriptionsApi) {
      return
    }
    if (!draft.name.trim() || !draft.category.trim()) {
      pushToast('error', 'Name and category are required')
      return
    }
    if (!draft.amount || Number.isNaN(Number(draft.amount))) {
      pushToast('error', 'Amount must be a valid number')
      return
    }

    setIsSaving(true)
    try {
      const saved = draft.id
        ? await subscriptionsApi.update(toUpdateInput(draft))
        : await subscriptionsApi.create(toCreateInput(draft))
      upsertRecord(saved)
      setIsDrawerOpen(false)
      pushToast('success', draft.id ? 'Subscription updated' : 'Subscription added')
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = async (record: SubscriptionRecord): Promise<void> => {
    if (!subscriptionsApi) {
      return
    }
    try {
      const archived = await subscriptionsApi.archive(record.id)
      upsertRecord(archived)
      pushToast('success', 'Subscription archived')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const handleDelete = async (record: SubscriptionRecord): Promise<void> => {
    if (!subscriptionsApi) {
      return
    }
    try {
      await subscriptionsApi.delete(record.id)
      setRecords((current) => current.filter((item) => item.id !== record.id))
      setSelectedId((current) => (current === record.id ? null : current))
      pushToast('success', 'Subscription removed')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const toggleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(field)
    setSortDirection(
      field === 'name' || field === 'category' || field === 'status' ? 'asc' : 'desc'
    )
  }

  const kpiCards = [
    {
      label: 'Monthly recurring',
      value: formatCurrency(analytics.totalMonthlyRecurring),
      icon: WalletCards
    },
    {
      label: 'Yearly recurring',
      value: formatCurrency(analytics.totalYearlyRecurring),
      icon: Landmark
    },
    {
      label: 'Renewing in 30 days',
      value: String(analytics.renewingSoonCount),
      icon: CalendarClock
    }
  ]

  return (
    <div className="h-full overflow-y-auto bg-transparent">
      <div
        className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-5 py-5 md:px-6"
        data-testid="subscriptions-page"
      >
        <section>
          <div className="grid gap-3 md:grid-cols-3">
            {kpiCards.map((card) => (
              <div
                key={card.label}
                className="workspace-subtle-surface rounded-2xl border border-[var(--line)] px-4 py-4"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
                  <card.icon size={16} />
                  <span>{card.label}</span>
                </div>
                <p className="mt-3 text-3xl font-semibold leading-none text-[var(--text)]">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {isLoading ? (
          <div className="workspace-subtle-surface rounded-3xl px-6 py-8 text-sm text-[var(--muted)]">
            Loading subscriptions…
          </div>
        ) : (
          <>
            <section>
              <TreemapCard
                records={treemapRecords}
                categories={categories}
                selectedId={selectedId}
                statusFilter={statusFilter}
                activeCategory={categoryFilter}
                onOpenCreate={openCreateModal}
                onChangeStatusFilter={setStatusFilter}
                onSelectCategory={setCategoryFilter}
                onSelectRecord={setSelectedId}
              />
            </section>

            <section>
              <div className="workspace-subtle-surface rounded-[24px] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text)]">
                      Subscriptions list
                    </h2>
                    <p className="text-sm text-[var(--muted)]">
                      Sort, filter, and manage individual subscriptions.
                    </p>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {filteredRecords.length} result{filteredRecords.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead
                          isActive={sortField === 'name'}
                          sortDirection={sortDirection}
                          onToggleSort={() => toggleSort('name')}
                        >
                          Subscription
                        </SortableTableHead>
                        <SortableTableHead
                          isActive={sortField === 'category'}
                          sortDirection={sortDirection}
                          onToggleSort={() => toggleSort('category')}
                        >
                          Category
                        </SortableTableHead>
                        <SortableTableHead
                          isActive={sortField === 'amount'}
                          sortDirection={sortDirection}
                          onToggleSort={() => toggleSort('amount')}
                        >
                          Monthly
                        </SortableTableHead>
                        <SortableTableHead
                          isActive={sortField === 'nextRenewalAt'}
                          sortDirection={sortDirection}
                          onToggleSort={() => toggleSort('nextRenewalAt')}
                        >
                          Next renewal
                        </SortableTableHead>
                        <SortableTableHead
                          isActive={sortField === 'status'}
                          sortDirection={sortDirection}
                          onToggleSort={() => toggleSort('status')}
                        >
                          Status
                        </SortableTableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <TableRow
                          key={record.id}
                          data-state={selectedId === record.id ? 'selected' : undefined}
                          className="cursor-pointer"
                          title={buildSubscriptionTooltip(record)}
                          onClick={() => setSelectedId(record.id)}
                        >
                          <TableCell>
                            <div className="font-medium text-[var(--text)]">{record.name}</div>
                            <div className="text-xs text-[var(--muted)]">
                              {record.provider ?? 'No provider'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span>{record.category}</span>
                              {(record.tags ?? []).length ? (
                                <div className="flex flex-wrap gap-1">
                                  {(record.tags ?? []).slice(0, 3).map((tag) => (
                                    <Badge
                                      key={tag}
                                      className="workspace-subtle-control border-[var(--line)] text-[var(--muted)]"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-[var(--text)]">
                              {formatCurrency(record.normalizedMonthlyAmount)}
                            </div>
                            <div className="text-xs capitalize text-[var(--muted)]">
                              {formatCurrency(record.amount)} / {record.billingCycle}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-[var(--text)]">
                              {formatRenewalLabel(record.nextRenewalAt)}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {formatRelativeRenewal(record.nextRenewalAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge className={statusTone(record.status)}>{record.status}</Badge>
                              {(record.reviewFlag ?? 'none') !== 'none' ? (
                                <Badge className={reviewTone(record.reviewFlag ?? 'none')}>
                                  {record.reviewFlag}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${record.name}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openEditModal(record)
                                }}
                              >
                                <Pencil size={14} />
                              </Button>
                              {record.status !== 'archived' ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Archive ${record.name}`}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleArchive(record)
                                  }}
                                >
                                  <Archive size={14} />
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${record.name}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleDelete(record)
                                }}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent side="right">
          <DrawerHeader className="border-b border-[var(--line)] pb-4">
            <DrawerTitle>{draft.id ? 'Edit subscription' : 'Add subscription'}</DrawerTitle>
            <DrawerDescription>
              Update recurring spend, renewal timing, and review signals.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Name</span>
                <Input
                  value={draft.name}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({ ...current, name: value }))
                  }}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Provider</span>
                <Input
                  value={draft.provider}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({ ...current, provider: value }))
                  }}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Category</span>
                <select
                  value={draft.category}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({ ...current, category: value }))
                  }}
                  className="h-9 rounded-lg border border-[var(--input)] bg-transparent px-3 text-sm"
                >
                  <option value="">Select category</option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Amount</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.amount}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({ ...current, amount: value }))
                  }}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Billing cycle</span>
                <select
                  value={draft.billingCycle}
                  onChange={(event) => {
                    const value = event.currentTarget
                      .value as CreateSubscriptionInput['billingCycle']
                    setDraft((current) => ({ ...current, billingCycle: value }))
                  }}
                  className="h-9 rounded-lg border border-[var(--input)] bg-transparent px-3 text-sm"
                >
                  {BILLING_CYCLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              {draft.billingCycle === 'custom' ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span>Billing interval months</span>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={draft.billingIntervalMonths}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setDraft((current) => ({ ...current, billingIntervalMonths: value }))
                    }}
                  />
                </label>
              ) : null}
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Next renewal</span>
                <Input
                  type="date"
                  value={draft.nextRenewalAt}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({ ...current, nextRenewalAt: value }))
                  }}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Status</span>
                <select
                  value={draft.status}
                  onChange={(event) => {
                    const value = event.currentTarget.value as SubscriptionStatus
                    setDraft((current) => ({ ...current, status: value }))
                  }}
                  className="h-9 rounded-lg border border-[var(--input)] bg-transparent px-3 text-sm"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Review flag</span>
                <select
                  value={draft.reviewFlag}
                  onChange={(event) => {
                    const value = event.currentTarget.value as SubscriptionReviewFlag
                    setDraft((current) => ({ ...current, reviewFlag: value }))
                  }}
                  className="h-9 rounded-lg border border-[var(--input)] bg-transparent px-3 text-sm"
                >
                  {REVIEW_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Last used</span>
                <Input
                  type="date"
                  value={draft.lastUsedAt}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({ ...current, lastUsedAt: value }))
                  }}
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1.5 text-sm">
                <span>Tags</span>
                <Input
                  value={draft.tags}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({ ...current, tags: value }))
                  }}
                  placeholder="team, ai, annual"
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1.5 text-sm">
                <span>Notes</span>
                <textarea
                  value={draft.notes}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({ ...current, notes: value }))
                  }}
                  rows={4}
                  className="min-h-[112px] rounded-lg border border-[var(--input)] bg-transparent px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
          <DrawerFooter className="justify-between border-t border-[var(--line)] pt-4">
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving…' : draft.id ? 'Save changes' : 'Add subscription'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
