import * as React from 'react'

import {
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbIconLabel,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from './breadcrumb'
import { Button } from './button'
import { ChevronDown, ChevronRight, Search } from './icons'
import { Input } from './input'
import { NotebookFolderIcon } from './notebook-folder-icon'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { cn } from '../../lib/utils'
import { WorkspaceTextFade } from './workspace-text-fade'

export interface ColumnFolderPickerNode {
  value: string
  label: React.ReactNode
  searchText?: string
  pathLabel?: string
  children?: readonly ColumnFolderPickerNode[]
  disabled?: boolean
  status?: React.ReactNode
  color?: string
}

export interface ColumnFolderPickerProps {
  nodes: readonly ColumnFolderPickerNode[]
  value: string
  onValueChange: (value: string) => void
  label: string
  placeholder?: React.ReactNode
  searchPlaceholder?: string
  maxVisibleColumns?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  testId?: string
  children?: React.ReactElement
}

interface FolderColumn {
  key: string
  path: string[]
  folder: ColumnFolderPickerNode | null
  nodes: readonly ColumnFolderPickerNode[]
}

interface SearchResult {
  node: ColumnFolderPickerNode
  path: string[]
  pathLabel: string
}

function findNodePath(
  nodes: readonly ColumnFolderPickerNode[],
  value: string,
  ancestors: string[] = []
): string[] | null {
  for (const node of nodes) {
    const path = [...ancestors, node.value]
    if (node.value === value) return path

    const descendantPath = findNodePath(node.children ?? [], value, path)
    if (descendantPath) return descendantPath
  }

  return null
}

function flattenNodes(
  nodes: readonly ColumnFolderPickerNode[],
  ancestors: readonly ColumnFolderPickerNode[] = [],
  values: readonly string[] = []
): SearchResult[] {
  return nodes.flatMap((node) => {
    const path = [...values, node.value]
    const pathLabel =
      node.pathLabel ??
      [...ancestors, node]
        .map(
          (entry) => entry.pathLabel ?? entry.value.split('/').filter(Boolean).pop() ?? entry.value
        )
        .join(' / ')

    return [
      { node, path, pathLabel },
      ...flattenNodes(node.children ?? [], [...ancestors, node], path)
    ]
  })
}

function encodeTestId(value: string): string {
  return encodeURIComponent(value)
}

export function ColumnFolderPicker({
  nodes,
  value,
  onValueChange,
  label,
  placeholder,
  searchPlaceholder = 'Search folders',
  maxVisibleColumns = 3,
  open,
  onOpenChange,
  testId,
  children
}: ColumnFolderPickerProps): React.ReactElement {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [activePath, setActivePath] = React.useState<string[]>([])
  const [query, setQuery] = React.useState('')
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const isOpen = open ?? uncontrolledOpen
  const visibleColumnCount = Math.max(1, Math.floor(maxVisibleColumns))

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setUncontrolledOpen(nextOpen)
      onOpenChange?.(nextOpen)
    },
    [onOpenChange]
  )

  React.useEffect(() => {
    if (!isOpen) return

    setQuery('')
    setActivePath(findNodePath(nodes, value) ?? [])
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [isOpen, nodes, value])

  const columns = React.useMemo<FolderColumn[]>(() => {
    const nextColumns: FolderColumn[] = [{ key: 'root', path: [], folder: null, nodes }]
    let currentNodes = nodes
    let currentPath: string[] = []

    for (const valueAtPath of activePath) {
      const folder = currentNodes.find((node) => node.value === valueAtPath)
      if (!folder) break

      currentPath = [...currentPath, folder.value]
      currentNodes = folder.children ?? []
      nextColumns.push({
        key: folder.value,
        path: currentPath,
        folder,
        nodes: currentNodes
      })
    }

    return nextColumns
  }, [activePath, nodes])

  const selectedPath = React.useMemo(() => findNodePath(nodes, value) ?? [], [nodes, value])

  const searchResults = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return []

    return flattenNodes(nodes).filter(({ node, pathLabel }) =>
      [node.searchText, node.pathLabel, pathLabel, node.value]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    )
  }, [nodes, query])

  const selectNode = React.useCallback(
    (node: ColumnFolderPickerNode, path: string[]) => {
      setActivePath(path)
      if (!node.disabled) onValueChange(node.value)
    },
    [onValueChange]
  )

  const selectSearchResult = React.useCallback(
    (result: SearchResult) => {
      selectNode(result.node, result.path)
      setQuery('')
    },
    [selectNode]
  )

  const popoverWidth = `${visibleColumnCount * 13 + (visibleColumnCount - 1) * 0.5 + 2}rem`
  const defaultTrigger = (
    <Button
      type="button"
      variant="outline"
      aria-label={label}
      aria-haspopup="dialog"
      className="h-10 w-full justify-between px-3 text-left"
    >
      <WorkspaceTextFade className={cn(value ? 'text-foreground' : 'text-muted-foreground')}>
        {value ? value : (placeholder ?? `Select ${label.toLocaleLowerCase()}`)}
      </WorkspaceTextFade>
      <ChevronDown className="shrink-0 opacity-60" aria-hidden="true" />
    </Button>
  )

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children ?? defaultTrigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="overflow-hidden p-3"
        style={{ width: `min(${popoverWidth}, calc(100vw - 1rem))` }}
        data-testid={testId}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              type="search"
              role="combobox"
              aria-label={searchPlaceholder}
              aria-expanded={isOpen}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
              data-testid={testId ? `${testId}-search` : undefined}
            />
          </div>

          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap gap-1 overflow-x-auto whitespace-nowrap">
              <BreadcrumbItem className="min-w-0">
                {activePath.length === 0 ? (
                  <BreadcrumbPage>
                    <BreadcrumbIconLabel icon={<NotebookFolderIcon variant="open" size={14} />}>
                      Notebooks
                    </BreadcrumbIconLabel>
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbButton
                    aria-label="Browse notebook root"
                    data-testid={testId ? `${testId}-breadcrumb:root` : undefined}
                    onClick={() => setActivePath([])}
                  >
                    <BreadcrumbIconLabel icon={<NotebookFolderIcon variant="open" size={14} />}>
                      Notebooks
                    </BreadcrumbIconLabel>
                  </BreadcrumbButton>
                )}
              </BreadcrumbItem>
              {columns.slice(1).map((column, index) => {
                if (!column.folder) return null
                const isCurrent = index === columns.length - 2
                const path = column.path

                return (
                  <React.Fragment key={column.key}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="min-w-0">
                      {isCurrent ? (
                        <BreadcrumbPage>
                          <BreadcrumbIconLabel
                            icon={
                              <NotebookFolderIcon
                                variant="open"
                                color={column.folder.color}
                                size={14}
                              />
                            }
                          >
                            {column.folder.label}
                          </BreadcrumbIconLabel>
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbButton
                          aria-label={`Browse ${column.folder.pathLabel ?? column.folder.value}`}
                          data-testid={
                            testId
                              ? `${testId}-breadcrumb:${encodeTestId(column.folder.value)}`
                              : undefined
                          }
                          onClick={() => setActivePath(path)}
                        >
                          <BreadcrumbIconLabel
                            icon={
                              <NotebookFolderIcon
                                variant="closed"
                                color={column.folder.color}
                                size={14}
                              />
                            }
                          >
                            {column.folder.label}
                          </BreadcrumbIconLabel>
                        </BreadcrumbButton>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>

          {query.trim() ? (
            <div
              className="max-h-64 space-y-1 overflow-y-auto rounded-md border bg-card p-1"
              role="listbox"
              aria-label="Folder search results"
              data-testid={testId ? `${testId}-search-results` : undefined}
            >
              {searchResults.length > 0 ? (
                searchResults.map((result) => {
                  const isSelected = result.node.value === value
                  const isInSelectedPath = selectedPath.includes(result.node.value)
                  const canNavigate = Boolean(result.node.children?.length)
                  const isDisabled = Boolean(result.node.disabled)

                  return (
                    <button
                      key={result.node.value}
                      type="button"
                      role="option"
                      aria-label={result.pathLabel}
                      aria-selected={isSelected}
                      aria-disabled={isDisabled || undefined}
                      disabled={isDisabled && !canNavigate}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                        isSelected
                          ? 'bg-card-hover text-foreground hover:bg-card-hover focus-visible:bg-card-hover'
                          : isInSelectedPath
                            ? 'bg-card-hover hover:bg-card-hover focus-visible:bg-card-hover'
                            : 'hover:bg-card-hover focus-visible:bg-card-hover',
                        'focus-visible:outline-none',
                        isDisabled && 'cursor-not-allowed opacity-50'
                      )}
                      data-testid={
                        testId ? `${testId}-folder:${encodeTestId(result.node.value)}` : undefined
                      }
                      onClick={() => selectSearchResult(result)}
                    >
                      <NotebookFolderIcon
                        variant="closed"
                        color={result.node.color}
                        size={16}
                        className="shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <WorkspaceTextFade className="font-medium">
                          {result.node.label}
                        </WorkspaceTextFade>
                        <WorkspaceTextFade className="text-xs text-muted-foreground">
                          {result.pathLabel}
                        </WorkspaceTextFade>
                      </span>
                      {result.node.status}
                    </button>
                  )
                })
              ) : (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No folders match “{query.trim()}”.
                </p>
              )}
            </div>
          ) : (
            <div
              className="flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1"
              data-testid={testId ? `${testId}-columns` : undefined}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  className="flex h-56 min-w-52 w-52 shrink-0 flex-col overflow-hidden"
                  role="listbox"
                  aria-label={
                    column.folder
                      ? `${column.folder.pathLabel ?? column.folder.value} subfolders`
                      : 'Notebook folders'
                  }
                  data-testid={
                    testId
                      ? `${testId}-column:${column.path.length > 0 ? encodeTestId(column.path.join('/')) : 'root'}`
                      : undefined
                  }
                >
                  <div className="min-h-0 flex-1 overflow-y-auto p-1">
                    {column.nodes.length > 0 ? (
                      column.nodes.map((node) => {
                        const nodePath = [...column.path, node.value]
                        const isSelected = node.value === value
                        const isInSelectedPath = selectedPath.includes(node.value)
                        const hasChildren = Boolean(node.children?.length)
                        const isDisabled = Boolean(node.disabled)

                        return (
                          <button
                            key={node.value}
                            type="button"
                            role="option"
                            aria-label={node.pathLabel ?? node.value}
                            aria-selected={isSelected}
                            aria-expanded={
                              hasChildren ? activePath.at(-1) === node.value : undefined
                            }
                            aria-disabled={isDisabled || undefined}
                            disabled={isDisabled && !hasChildren}
                            className={cn(
                              'flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              isSelected
                                ? 'bg-card-hover text-foreground hover:bg-card-hover focus-visible:bg-card-hover'
                                : isInSelectedPath
                                  ? 'bg-card-hover hover:bg-card-hover focus-visible:bg-card-hover'
                                  : 'hover:bg-card-hover focus-visible:bg-card-hover',
                              'focus-visible:outline-none',
                              isDisabled && 'cursor-not-allowed opacity-50'
                            )}
                            data-testid={
                              testId ? `${testId}-folder:${encodeTestId(node.value)}` : undefined
                            }
                            onClick={() => selectNode(node, nodePath)}
                          >
                            <NotebookFolderIcon
                              variant={hasChildren ? 'open' : 'closed'}
                              color={node.color}
                              size={16}
                              className="shrink-0"
                            />
                            <WorkspaceTextFade className="min-w-0 flex-1">
                              {node.label}
                            </WorkspaceTextFade>
                            {node.status}
                            {hasChildren ? (
                              <ChevronRight
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            ) : null}
                          </button>
                        )
                      })
                    ) : (
                      <p className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                        {column.folder ? 'No subfolders' : 'No notebook folders'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end border-t pt-2">
            <Button
              type="button"
              variant="accent"
              size="sm"
              shape="pill"
              disabled={!value}
              onClick={() => handleOpenChange(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
