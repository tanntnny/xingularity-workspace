import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, Plus, Search, Star, X } from './ui/icons'
import {
  type RendererVaultApi,
  type SavedVaultState,
  type VaultOpenResult
} from '../../../shared/types'
import { Pallete, PalleteInput, PalleteSearchBar } from './ui/pallete'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { cn } from '../lib/utils'
import { VaultIcon } from '../lib/pageIcons'

interface VaultSwapperDialogProps {
  open: boolean
  vaultApi: RendererVaultApi | undefined
  activeVaultPath: string | null
  onOpenChange: (open: boolean) => void
  onVaultActivated: (result: VaultOpenResult, successMessage?: string) => Promise<void>
  onVaultClosed: () => void
  pushToast: (kind: 'info' | 'error' | 'success', message: string) => void
}

const paletteRowClassName =
  'relative flex min-w-0 items-center gap-2 select-none rounded-lg px-2 py-1.5 text-sm outline-none transition-[background-color,color,box-shadow] disabled:pointer-events-none disabled:opacity-50'

const paletteRowHoverClassName = 'hover:bg-accent'

const paletteRowSelectedClassName = 'bg-accent'

type VaultPaletteSelectionItem =
  | {
      key: string
      kind: 'vault'
      disabled: boolean
      onSelect: () => void
    }
  | {
      key: string
      kind: 'action'
      disabled: boolean
      onSelect: () => void
    }

export function VaultSwapperDialog({
  open,
  vaultApi,
  activeVaultPath,
  onOpenChange,
  onVaultActivated,
  onVaultClosed,
  pushToast
}: VaultSwapperDialogProps): ReactElement {
  const [savedVaultState, setSavedVaultState] = useState<SavedVaultState | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const rowRefs = useRef(new Map<string, HTMLButtonElement | null>())

  useEffect(() => {
    if (!open || !vaultApi) {
      return
    }

    let cancelled = false
    setLoading(true)
    void vaultApi.vault
      .listSaved()
      .then((state) => {
        if (!cancelled) {
          setSavedVaultState(state)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          pushToast('error', String(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, pushToast, vaultApi])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedItemKey(null)
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [open])

  const handleActivate = useCallback(
    async (mode: 'open' | 'create'): Promise<void> => {
      if (!vaultApi) {
        return
      }

      setBusyKey(mode)
      try {
        const result = mode === 'open' ? await vaultApi.vault.open() : await vaultApi.vault.create()
        if (!result) {
          return
        }

        await onVaultActivated(result, `Vault ready at ${result.info.rootPath}`)
        onOpenChange(false)
      } catch (error) {
        pushToast('error', String(error))
      } finally {
        setBusyKey(null)
      }
    },
    [onOpenChange, onVaultActivated, pushToast, vaultApi]
  )

  const handleSwitch = useCallback(
    async (rootPath: string): Promise<void> => {
      if (!vaultApi) {
        return
      }

      setBusyKey(`switch:${rootPath}`)
      try {
        const result = await vaultApi.vault.switchSaved(rootPath)
        await onVaultActivated(result, `Switched vault to ${result.info.rootPath}`)
        onOpenChange(false)
      } catch (error) {
        pushToast('error', String(error))
      } finally {
        setBusyKey(null)
      }
    },
    [onOpenChange, onVaultActivated, pushToast, vaultApi]
  )

  const handleRemove = async (rootPath: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    setBusyKey(`remove:${rootPath}`)
    try {
      const result = await vaultApi.vault.removeSaved(rootPath)
      if (result.activation) {
        await onVaultActivated(
          result.activation,
          `Removed active vault and switched to ${result.activation.info.rootPath}`
        )
        onOpenChange(false)
        return
      }

      if (activeVaultPath === rootPath && result.state.currentVaultPath === null) {
        onVaultClosed()
        pushToast('success', 'Removed the active vault from this device list')
        onOpenChange(false)
        return
      }

      setSavedVaultState(result.state)
      pushToast('success', 'Removed vault from saved workspaces')
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setBusyKey(null)
    }
  }

  const handleToggleFavorite = async (rootPath: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    setBusyKey(`favorite:${rootPath}`)
    try {
      const state = await vaultApi.vault.toggleFavoriteSaved(rootPath)
      setSavedVaultState(state)
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setBusyKey(null)
    }
  }

  const normalizedQuery = query.trim().toLowerCase()
  const matchesQuery = useCallback(
    (value: string): boolean =>
      normalizedQuery.length === 0 || value.toLowerCase().includes(normalizedQuery),
    [normalizedQuery]
  )

  const filteredVaults = useMemo(() => {
    if (!savedVaultState) {
      return []
    }

    return savedVaultState.vaults.filter((vault) =>
      matchesQuery(`${vault.name} ${vault.rootPath} ${vault.isAvailable ? '' : 'missing'}`)
    )
  }, [matchesQuery, savedVaultState])

  const filteredActions = useMemo(
    () =>
      [
        {
          key: 'open',
          mode: 'open' as const,
          icon: FolderOpen,
          label: busyKey === 'open' ? 'Adding existing vault...' : 'Add Existing Vault',
          subtitle: 'Open a vault folder that is already on this device'
        },
        {
          key: 'create',
          mode: 'create' as const,
          icon: Plus,
          label: busyKey === 'create' ? 'Creating new vault...' : 'Create New Vault',
          subtitle: 'Make a new vault folder and start using it right away'
        }
      ].filter((action) => matchesQuery(`${action.label} ${action.subtitle}`)),
    [busyKey, matchesQuery]
  )

  const showEmptyState =
    !loading &&
    filteredVaults.length === 0 &&
    filteredActions.length === 0 &&
    savedVaultState !== null

  const showNoSavedVaultsHint =
    !loading &&
    normalizedQuery.length === 0 &&
    savedVaultState !== null &&
    savedVaultState.vaults.length === 0

  const selectionItems = useMemo<VaultPaletteSelectionItem[]>(
    () => [
      ...filteredVaults.map((vault) => {
        const isCurrent = vault.rootPath === (savedVaultState?.currentVaultPath ?? activeVaultPath)
        return {
          key: `vault:${vault.rootPath}`,
          kind: 'vault' as const,
          disabled: !vault.isAvailable || isCurrent || busyKey !== null,
          onSelect: () => {
            void handleSwitch(vault.rootPath)
          }
        }
      }),
      ...filteredActions.map((action) => ({
        key: `action:${action.key}`,
        kind: 'action' as const,
        disabled: busyKey !== null,
        onSelect: () => {
          void handleActivate(action.mode)
        }
      }))
    ],
    [
      activeVaultPath,
      busyKey,
      filteredActions,
      filteredVaults,
      handleActivate,
      handleSwitch,
      savedVaultState?.currentVaultPath
    ]
  )

  const enabledSelectionItems = useMemo(
    () => selectionItems.filter((item) => !item.disabled),
    [selectionItems]
  )

  useEffect(() => {
    if (enabledSelectionItems.length === 0) {
      if (selectedItemKey !== null) {
        setSelectedItemKey(null)
      }
      return
    }

    if (selectedItemKey && enabledSelectionItems.some((item) => item.key === selectedItemKey)) {
      return
    }

    setSelectedItemKey(enabledSelectionItems[0]!.key)
  }, [enabledSelectionItems, selectedItemKey])

  useEffect(() => {
    if (!selectedItemKey) {
      return
    }

    const node = rowRefs.current.get(selectedItemKey)
    node?.scrollIntoView({ block: 'nearest' })
  }, [selectedItemKey])

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (enabledSelectionItems.length === 0) {
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const currentIndex = enabledSelectionItems.findIndex((item) => item.key === selectedItemKey)
        const direction = event.key === 'ArrowDown' ? 1 : -1
        const nextIndex =
          currentIndex === -1
            ? direction === 1
              ? 0
              : enabledSelectionItems.length - 1
            : (currentIndex + direction + enabledSelectionItems.length) %
              enabledSelectionItems.length
        setSelectedItemKey(enabledSelectionItems[nextIndex]!.key)
        return
      }

      if (event.key === 'Enter' && selectedItemKey) {
        const selectedItem = enabledSelectionItems.find((item) => item.key === selectedItemKey)
        if (!selectedItem) {
          return
        }

        event.preventDefault()
        selectedItem.onSelect()
      }
    },
    [enabledSelectionItems, selectedItemKey]
  )

  return (
    <Pallete
      open={open}
      aria-label="Manage vaults"
      className="!p-3"
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
      }}
    >
      <div className="flex w-full flex-col">
        <PalleteSearchBar>
          <PalleteInput
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search vaults or actions..."
          />
        </PalleteSearchBar>

        <div className="max-h-[360px] overflow-y-auto p-1">
          {loading && !savedVaultState ? (
            <div className="rounded-lg px-3 py-3 text-sm text-muted-foreground">
              Loading saved vaults...
            </div>
          ) : null}

          {showNoSavedVaultsHint ? (
            <EmptyState
              className="border-0 bg-transparent px-3 py-6"
              icon={VaultIcon}
              title="No saved vaults yet"
              description="Add an existing vault or create a new one to start switching."
            />
          ) : null}

          {filteredVaults.map((vault) => {
            const isCurrent =
              vault.rootPath === (savedVaultState?.currentVaultPath ?? activeVaultPath)
            const isSwitching = busyKey === `switch:${vault.rootPath}`
            const isFavoriting = busyKey === `favorite:${vault.rootPath}`
            const isRemoving = busyKey === `remove:${vault.rootPath}`
            const selectionKey = `vault:${vault.rootPath}`
            const isSelected = selectionKey === selectedItemKey
            const detailParts = [
              vault.isFavorite ? 'Favorite' : null,
              isSwitching ? 'Switching...' : null,
              !vault.isAvailable ? 'Missing' : null
            ].filter(Boolean)

            return (
              <div
                key={vault.rootPath}
                className={cn(
                  'group flex items-center gap-1 rounded-lg',
                  isCurrent
                    ? 'bg-muted'
                    : isSelected
                      ? paletteRowSelectedClassName
                      : paletteRowHoverClassName
                )}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  ref={(node) => {
                    rowRefs.current.set(selectionKey, node)
                  }}
                  className={cn(paletteRowClassName, 'h-auto flex-1 justify-start text-left')}
                  onClick={() => {
                    setSelectedItemKey(selectionKey)
                    void handleSwitch(vault.rootPath)
                  }}
                  disabled={!vault.isAvailable || isCurrent || busyKey !== null}
                  aria-label={
                    isCurrent ? `${vault.name} is the current vault` : `Switch to ${vault.name}`
                  }
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center text-primary">
                    <VaultIcon size={16} />
                  </div>
                  <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
                    <span className="shrink-0 font-medium text-foreground">{vault.name}</span>
                    <span className="truncate text-muted-foreground">
                      {detailParts.length > 0 ? `${detailParts.join(' · ')} · ` : ''}
                      {vault.rootPath}
                    </span>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    paletteRowClassName,
                    vault.isFavorite
                      ? 'h-9 w-9 shrink-0 justify-center px-0 text-muted-foreground hover:text-muted-foreground group-hover:text-muted-foreground'
                      : 'h-9 w-9 shrink-0 justify-center px-0 text-muted-foreground hover:text-muted-foreground group-hover:text-muted-foreground'
                  )}
                  onClick={() => {
                    setSelectedItemKey(selectionKey)
                    void handleToggleFavorite(vault.rootPath)
                  }}
                  disabled={busyKey !== null}
                  aria-label={
                    isFavoriting
                      ? `Updating favorite for ${vault.name}`
                      : vault.isFavorite
                        ? `Remove ${vault.name} from favorites`
                        : `Add ${vault.name} to favorites`
                  }
                >
                  <Star
                    size={16}
                    className={vault.isFavorite ? 'fill-current text-muted-foreground' : ''}
                  />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    paletteRowClassName,
                    'h-9 w-9 shrink-0 justify-center px-0 text-muted-foreground hover:text-foreground group-hover:text-foreground'
                  )}
                  onClick={() => {
                    setSelectedItemKey(selectionKey)
                    void handleRemove(vault.rootPath)
                  }}
                  disabled={busyKey !== null}
                  aria-label={isRemoving ? `Removing ${vault.name}` : `Remove ${vault.name}`}
                >
                  <X size={16} />
                </Button>
              </div>
            )
          })}

          {filteredVaults.length > 0 && filteredActions.length > 0 ? (
            <div className="mx-1 my-1 h-px bg-border" />
          ) : null}

          {filteredActions.map((action) => {
            const Icon = action.icon
            const selectionKey = `action:${action.key}`
            const isSelected = selectionKey === selectedItemKey
            return (
              <Button
                key={action.key}
                type="button"
                variant="ghost"
                size="sm"
                ref={(node) => {
                  rowRefs.current.set(selectionKey, node)
                }}
                className={cn(
                  paletteRowClassName,
                  isSelected ? paletteRowSelectedClassName : paletteRowHoverClassName,
                  'h-auto w-full justify-start text-left'
                )}
                onClick={() => {
                  setSelectedItemKey(selectionKey)
                  void handleActivate(action.mode)
                }}
                disabled={busyKey !== null}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center text-primary">
                  <Icon size={16} />
                </div>
                <span className="truncate font-medium text-foreground">{action.label}</span>
              </Button>
            )
          })}

          {showEmptyState ? (
            <EmptyState
              className="border-0 bg-transparent px-3 py-6"
              icon={Search}
              title="No matching vaults"
              description="No vaults or actions match your search."
            />
          ) : null}
        </div>
      </div>
    </Pallete>
  )
}
