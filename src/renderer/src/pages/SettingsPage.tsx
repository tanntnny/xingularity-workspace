import { ReactElement, KeyboardEvent, useEffect, useState } from 'react'
import { TabMenu, TabMenuItem } from '../components/ui/tab-menu'
import type { ProfileColor } from '../../../shared/profileColors'
import type {
  NoteVimKeyMapping,
  NoteVimMappingAction,
  NoteVimMappingMode
} from '../../../shared/types'
import vimLogo from '../assets/vim-logo.svg'
import { PROFILE_COLOR_OPTIONS } from '../lib/profileColors'

export interface FontOption {
  label: string
  value: string
}

const EDITOR_VIM_MAPPING_MODES: Array<{ value: NoteVimMappingMode; label: string }> = [
  { value: 'insert', label: 'Insert' },
  { value: 'normal', label: 'Normal' },
  { value: 'visual', label: 'Visual' },
  { value: 'visualLine', label: 'Visual Line' }
]

const INSERT_MODE_ACTIONS: Array<{ value: NoteVimMappingAction; label: string }> = [
  { value: 'enterNormalMode', label: 'Enter normal mode' }
]

const NORMAL_MODE_ACTIONS: Array<{ value: NoteVimMappingAction; label: string }> = [
  { value: 'enterInsertMode', label: 'Enter insert mode' },
  { value: 'appendAfterCursor', label: 'Append after cursor' },
  { value: 'appendLineEnd', label: 'Append at line end' },
  { value: 'openLineBelow', label: 'Open line below' },
  { value: 'openLineAbove', label: 'Open line above' },
  { value: 'pasteAfterCursor', label: 'Paste after cursor' },
  { value: 'pasteBeforeCursor', label: 'Paste before cursor' }
]

const VISUAL_MODE_ACTIONS: Array<{ value: NoteVimMappingAction; label: string }> = [
  { value: 'enterNormalMode', label: 'Enter normal mode' },
  { value: 'enterInsertMode', label: 'Enter insert mode' },
  { value: 'deleteSelection', label: 'Delete selection' },
  { value: 'yankSelection', label: 'Yank selection' }
]

function getEditorVimActionOptions(
  mode: NoteVimMappingMode
): Array<{ value: NoteVimMappingAction; label: string }> {
  if (mode === 'insert') {
    return INSERT_MODE_ACTIONS
  }

  if (mode === 'normal') {
    return NORMAL_MODE_ACTIONS
  }

  return VISUAL_MODE_ACTIONS
}

function isEditorVimActionCompatible(
  mode: NoteVimMappingMode,
  action: NoteVimMappingAction
): boolean {
  return getEditorVimActionOptions(mode).some((option) => option.value === action)
}

function getEditorVimMappingErrors(mappings: NoteVimKeyMapping[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  const seen = new Map<string, string>()

  for (const mapping of mappings) {
    const rowErrors: string[] = []

    if (!mapping.sequence.trim()) {
      rowErrors.push('Sequence is required.')
    } else if (!/^(?=.*\S)[\x20-\x7E]{1,8}$/.test(mapping.sequence)) {
      rowErrors.push('Use 1-8 printable ASCII characters.')
    }

    if (!isEditorVimActionCompatible(mapping.mode, mapping.action)) {
      rowErrors.push('Action is not available in this mode.')
    }

    const conflictKey = `${mapping.mode}:${mapping.sequence}`
    const existingId = seen.get(conflictKey)
    if (mapping.sequence && existingId && existingId !== mapping.id) {
      rowErrors.push('Duplicate mode and sequence.')
    }
    seen.set(conflictKey, mapping.id)

    if (rowErrors.length > 0) {
      errors[mapping.id] = rowErrors
    }
  }

  return errors
}

interface SettingsPageProps {
  profileName: string
  mistralApiKey: string
  fontOptions: FontOption[]
  selectedFontFamily: string
  profileColor: ProfileColor
  workspaceVibrancyEnabled: boolean
  editorVimModeEnabled: boolean
  editorVimKeyMappings: NoteVimKeyMapping[]
  vaultLocation: string | null
  savedVaultCount: number
  onSaveProfile: (name: string) => void
  onSaveMistralApiKey: (apiKey: string) => void
  onSelectFont: (fontFamily: string) => void
  onSelectProfileColor: (color: ProfileColor) => void
  onToggleWorkspaceVibrancy: (enabled: boolean) => void
  onToggleEditorVimMode: (enabled: boolean) => void
  onUpdateEditorVimKeyMappings: (mappings: NoteVimKeyMapping[]) => void
  onManageVaults: () => void
  onMigrateBlockNoteNotes: () => void
  onMigrateTaggedNoteBodyFrontmatter: () => void
  onImportLegacyExcalidrawSessions: () => void
}

export function SettingsPage({
  profileName,
  mistralApiKey,
  fontOptions,
  selectedFontFamily,
  profileColor,
  workspaceVibrancyEnabled,
  editorVimModeEnabled,
  editorVimKeyMappings,
  vaultLocation,
  savedVaultCount,
  onSaveProfile,
  onSaveMistralApiKey,
  onSelectFont,
  onSelectProfileColor,
  onToggleWorkspaceVibrancy,
  onToggleEditorVimMode,
  onUpdateEditorVimKeyMappings,
  onManageVaults,
  onMigrateBlockNoteNotes,
  onMigrateTaggedNoteBodyFrontmatter,
  onImportLegacyExcalidrawSessions
}: SettingsPageProps): ReactElement {
  const [profileDraft, setProfileDraft] = useState(profileName)
  const [mistralApiKeyDraft, setMistralApiKeyDraft] = useState(mistralApiKey)
  const [vimMappingDrafts, setVimMappingDrafts] =
    useState<NoteVimKeyMapping[]>(editorVimKeyMappings)
  const [activeTab, setActiveTab] = useState<
    'profile' | 'workspace' | 'appearance' | 'editor' | 'agent'
  >('profile')

  useEffect(() => {
    setProfileDraft(profileName)
  }, [profileName])

  useEffect(() => {
    setMistralApiKeyDraft(mistralApiKey)
  }, [mistralApiKey])

  useEffect(() => {
    setVimMappingDrafts(editorVimKeyMappings)
  }, [editorVimKeyMappings])

  const commitProfileName = (): void => {
    const trimmedName = profileDraft.trim()
    if (!trimmedName) {
      setProfileDraft(profileName)
      return
    }

    if (trimmedName === profileName) {
      return
    }

    onSaveProfile(trimmedName)
  }

  const onProfileInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') {
      return
    }

    event.currentTarget.blur()
  }

  const commitMistralApiKey = (): void => {
    if (mistralApiKeyDraft === mistralApiKey) {
      return
    }

    onSaveMistralApiKey(mistralApiKeyDraft.trim())
  }

  const mappingErrors = getEditorVimMappingErrors(vimMappingDrafts)
  const hasMappingErrors = Object.keys(mappingErrors).length > 0

  const commitVimMappings = (nextMappings: NoteVimKeyMapping[]): void => {
    if (Object.keys(getEditorVimMappingErrors(nextMappings)).length > 0) {
      return
    }

    onUpdateEditorVimKeyMappings(nextMappings)
  }

  const updateVimMapping = (
    mappingId: string,
    update: Partial<Pick<NoteVimKeyMapping, 'mode' | 'sequence' | 'action'>>
  ): void => {
    const nextMappings = vimMappingDrafts.map((mapping) => {
      if (mapping.id !== mappingId) {
        return mapping
      }

      const nextMapping = { ...mapping, ...update }
      if (update.mode && !isEditorVimActionCompatible(update.mode, nextMapping.action)) {
        nextMapping.action = getEditorVimActionOptions(update.mode)[0]?.value ?? 'enterNormalMode'
      }

      return nextMapping
    })
    setVimMappingDrafts(nextMappings)
    commitVimMappings(nextMappings)
  }

  const addVimMapping = (): void => {
    setVimMappingDrafts((current) => [
      ...current,
      {
        id: `vim-map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: 'insert',
        sequence: '',
        action: 'enterNormalMode'
      }
    ])
  }

  const removeVimMapping = (mappingId: string): void => {
    const nextMappings = vimMappingDrafts.filter((mapping) => mapping.id !== mappingId)
    setVimMappingDrafts(nextMappings)
    commitVimMappings(nextMappings)
  }

  return (
    <section className="grid gap-3.5 p-5" aria-label="App settings">
      <h2 className="text-2xl font-bold">Settings</h2>
      <p className="max-w-[56ch] text-sm text-[var(--muted)]">
        Manage your identity, workspace storage, editor behavior, appearance, and AI connection
        settings.
      </p>

      <TabMenu
        variant="inline-accent"
        className="settings-tab-menu"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <TabMenuItem variant="inline-accent" className="settings-tab-menu-item" value="profile">
          Profile
        </TabMenuItem>
        <TabMenuItem variant="inline-accent" className="settings-tab-menu-item" value="workspace">
          Workspace
        </TabMenuItem>
        <TabMenuItem variant="inline-accent" className="settings-tab-menu-item" value="appearance">
          Appearance
        </TabMenuItem>
        <TabMenuItem variant="inline-accent" className="settings-tab-menu-item" value="editor">
          Editor
        </TabMenuItem>
        <TabMenuItem variant="inline-accent" className="settings-tab-menu-item" value="agent">
          Agent
        </TabMenuItem>
      </TabMenu>

      {activeTab === 'profile' ? (
        <div className="workspace-subtle-surface grid gap-4 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-[var(--text)]">Profile</h3>
            <p className="max-w-[56ch] text-sm text-[var(--muted)]">
              Choose how your workspace introduces you across the app.
            </p>
          </div>

          <div className="grid w-full gap-1.5" aria-label="Profile settings">
            <span className="text-sm text-[var(--muted)]">Profile Name</span>
            <input
              type="text"
              maxLength={100}
              value={profileDraft}
              placeholder="Your name"
              onChange={(event) => setProfileDraft(event.target.value)}
              onBlur={commitProfileName}
              onKeyDown={onProfileInputKeyDown}
              className="workspace-subtle-control w-full rounded-lg border border-[var(--line)] p-2.5"
            />
            <span className="text-xs text-[var(--muted)]">Press Enter or click away to save.</span>
          </div>
        </div>
      ) : null}

      {activeTab === 'workspace' ? (
        <div className="workspace-subtle-surface grid gap-5 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-[var(--text)]">Workspace</h3>
            <p className="w-full text-sm text-[var(--muted)]">
              Manage the local workspace vaults saved on this device and switch between them when
              you want to work from a different folder.
            </p>
          </div>

          <div className="grid w-full gap-1.5" aria-label="Vault storage">
            <span className="text-sm text-[var(--muted)]">Active Vault</span>
            <div className="workspace-subtle-control w-full break-words rounded-lg border border-[var(--line)] p-2.5 text-sm text-[var(--text)]">
              {vaultLocation ?? 'No vault selected yet. Open or create a vault to set a location.'}
            </div>
            <span className="text-xs text-[var(--muted)]">
              Saved locally on this device: {savedVaultCount} vault
              {savedVaultCount === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className="workspace-subtle-control w-fit rounded-lg border border-[var(--line)] px-3 py-2"
              onClick={onManageVaults}
            >
              Manage Vaults
            </button>
          </div>

          <div className="grid w-full gap-1.5" aria-label="Note migration">
            <span className="text-sm text-[var(--muted)]">Old Note Conversion</span>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Convert old BlockNote JSON note files into normal markdown in your vault.
            </p>
            <button
              type="button"
              className="workspace-subtle-control w-fit rounded-lg border border-[var(--line)] px-3 py-2"
              onClick={onMigrateBlockNoteNotes}
            >
              Convert old BlockNote notes
            </button>
            <button
              type="button"
              className="workspace-subtle-control w-fit rounded-lg border border-[var(--line)] px-3 py-2"
              onClick={onMigrateTaggedNoteBodyFrontmatter}
            >
              Normalize tagged note bodies
            </button>
            <button
              type="button"
              className="workspace-subtle-control w-fit rounded-lg border border-[var(--line)] px-3 py-2"
              onClick={onImportLegacyExcalidrawSessions}
            >
              Import legacy Excalidraw drawings
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'appearance' ? (
        <div className="workspace-subtle-surface grid gap-5 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-[var(--text)]">Appearance</h3>
            <p className="max-w-[56ch] text-sm text-[var(--muted)]">
              Tune how the app reads with font and surface controls for the main workspace.
            </p>
          </div>

          <div className="workspace-subtle-surface grid gap-2 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)]">Workspace Vibrancy</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Blur and soften the main workspace and right sidebar with translucent glass
                  surfaces.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={workspaceVibrancyEnabled}
                aria-label="Toggle workspace vibrancy"
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-lg border transition-colors ${
                  workspaceVibrancyEnabled
                    ? 'border-[var(--accent-line)]'
                    : 'workspace-subtle-control border-[var(--line)]'
                }`}
                onClick={() => onToggleWorkspaceVibrancy(!workspaceVibrancyEnabled)}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-lg bg-white shadow-[0_8px_18px_rgba(15,23,42,0.22)] transition-transform ${
                    workspaceVibrancyEnabled ? 'translate-x-[1.45rem]' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Keeps the global sidebar glassy and extends the effect through the workspace shell.
            </p>
          </div>

          <div className="grid gap-2">
            <span className="text-sm text-[var(--muted)]">Accent Color</span>
            <div className="flex flex-wrap gap-2">
              {PROFILE_COLOR_OPTIONS.map((option) => {
                const isActive = option.value === profileColor
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSelectProfileColor(option.value)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      isActive
                        ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
                        : 'workspace-subtle-control border-[var(--line)] text-[var(--text)]'
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-lg border"
                      style={{
                        background: option.swatch,
                        borderColor: option.swatchBorder
                      }}
                    />
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-[var(--muted)]">
              Changes the app-wide accent color. `Monotone` becomes dark in light mode and white in
              dark mode.
            </p>
          </div>

          <label className="grid w-full gap-1.5" htmlFor="font-family-select">
            <span className="text-sm text-[var(--muted)]">App Font</span>
            <select
              id="font-family-select"
              className="workspace-subtle-control w-full rounded-lg border border-[var(--line)] p-2.5"
              value={selectedFontFamily}
              onChange={(event) => onSelectFont(event.target.value)}
            >
              {fontOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <p
            className="workspace-subtle-surface w-full rounded-lg p-3.5"
            style={{ fontFamily: selectedFontFamily }}
          >
            The quick brown fox jumps over the lazy dog.
          </p>
        </div>
      ) : null}

      {activeTab === 'editor' ? (
        <div className="workspace-subtle-surface grid gap-5 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-[var(--text)]">Editor</h3>
            <p className="max-w-[56ch] text-sm text-[var(--muted)]">
              Tune note editing behavior for the main workspace editor.
            </p>
          </div>

          <div className="workspace-subtle-surface grid gap-2 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2" data-testid="vim-mode-setting">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)]">
                    <img
                      src={vimLogo}
                      alt=""
                      aria-hidden="true"
                      data-testid="vim-mode-setting-icon"
                      className="h-4 w-4 shrink-0"
                    />
                  </span>
                  <p className="text-sm font-semibold text-[var(--text)]">Vim Mode</p>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Use modal keyboard controls in notes, including insert, normal, and visual modes
                  with common Vim motions.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={editorVimModeEnabled}
                aria-label="Toggle Vim mode"
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-lg border transition-colors ${
                  editorVimModeEnabled
                    ? 'border-[var(--accent-line)]'
                    : 'workspace-subtle-control border-[var(--line)]'
                }`}
                onClick={() => onToggleEditorVimMode(!editorVimModeEnabled)}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-lg bg-white shadow-[0_8px_18px_rgba(15,23,42,0.22)] transition-transform ${
                    editorVimModeEnabled ? 'translate-x-[1.45rem]' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Disabled by default. Press Escape in the note editor to enter normal mode.
            </p>
          </div>

          <div className="workspace-subtle-surface grid gap-3 rounded-lg p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)]">Vim Key Mappings</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Add short key sequences such as <span className="font-mono">ij</span> to run core
                  Vim mode actions.
                </p>
              </div>
              <button
                type="button"
                className="workspace-subtle-control rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                onClick={addVimMapping}
              >
                Add Mapping
              </button>
            </div>

            {vimMappingDrafts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
                No custom mappings yet. Add one like insert / ij / Enter normal mode.
              </p>
            ) : (
              <div className="grid gap-2">
                {vimMappingDrafts.map((mapping) => {
                  const rowErrors = mappingErrors[mapping.id] ?? []

                  return (
                    <div
                      key={mapping.id}
                      className="grid gap-2 rounded-lg border border-[var(--line)] p-3 md:grid-cols-[minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(11rem,1.4fr)_auto]"
                    >
                      <label className="grid gap-1 text-xs text-[var(--muted)]">
                        Mode
                        <select
                          className="workspace-subtle-control rounded-lg border border-[var(--line)] p-2 text-sm text-[var(--text)]"
                          value={mapping.mode}
                          onChange={(event) =>
                            updateVimMapping(mapping.id, {
                              mode: event.target.value as NoteVimMappingMode
                            })
                          }
                        >
                          {EDITOR_VIM_MAPPING_MODES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-1 text-xs text-[var(--muted)]">
                        Sequence
                        <input
                          className="workspace-subtle-control rounded-lg border border-[var(--line)] p-2 font-mono text-sm text-[var(--text)]"
                          value={mapping.sequence}
                          maxLength={8}
                          placeholder="ij"
                          onChange={(event) =>
                            updateVimMapping(mapping.id, { sequence: event.target.value })
                          }
                          spellCheck={false}
                        />
                      </label>

                      <label className="grid gap-1 text-xs text-[var(--muted)]">
                        Action
                        <select
                          className="workspace-subtle-control rounded-lg border border-[var(--line)] p-2 text-sm text-[var(--text)]"
                          value={mapping.action}
                          onChange={(event) =>
                            updateVimMapping(mapping.id, {
                              action: event.target.value as NoteVimMappingAction
                            })
                          }
                        >
                          {getEditorVimActionOptions(mapping.mode).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        className="workspace-subtle-control self-end rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                        onClick={() => removeVimMapping(mapping.id)}
                      >
                        Remove
                      </button>

                      {rowErrors.length > 0 ? (
                        <p className="text-xs text-[var(--danger)] md:col-span-4">
                          {rowErrors.join(' ')}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}

            {hasMappingErrors ? (
              <p className="text-xs text-[var(--muted)]">
                Fix mapping errors to save changes. Valid sequences use 1-8 printable characters.
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                Custom mappings override built-in Vim keys when the same sequence is used.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'agent' ? (
        <div className="workspace-subtle-surface grid gap-4 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-[var(--text)]">Agent</h3>
            <p className="max-w-[56ch] text-sm text-[var(--muted)]">
              Connect your AI provider for command palette completion and agent workflows.
            </p>
          </div>

          <div className="grid w-full gap-1.5" aria-label="Mistral AI settings">
            <span className="text-sm text-[var(--muted)]">Mistral API Key</span>
            <input
              type="password"
              value={mistralApiKeyDraft}
              placeholder="Paste your Mistral API key"
              onChange={(event) => setMistralApiKeyDraft(event.target.value)}
              onBlur={commitMistralApiKey}
              onKeyDown={onProfileInputKeyDown}
              className="workspace-subtle-control w-full rounded-lg border border-[var(--line)] p-2.5"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="text-xs text-[var(--muted)]">
              Used for `?` AI note completion in the command palette. Press Enter or click away to
              save.
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
