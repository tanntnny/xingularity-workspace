import { ReactElement, KeyboardEvent, useEffect, useState } from 'react'
import {
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  ToggleGroup,
  ToggleGroupItem
} from '../components/ui'
import { WorkspacePageLayout } from '../components/workspace'
import type {
  NoteVimKeyMapping,
  NoteVimMappingAction,
  NoteVimMappingMode
} from '../../../shared/types'
import vimLogo from '../assets/vim-logo.svg'

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
  editorVimModeEnabled: boolean
  editorVimKeyMappings: NoteVimKeyMapping[]
  vaultLocation: string | null
  savedVaultCount: number
  onSaveProfile: (name: string) => void
  onSaveMistralApiKey: (apiKey: string) => void
  onToggleEditorVimMode: (enabled: boolean) => void
  onUpdateEditorVimKeyMappings: (mappings: NoteVimKeyMapping[]) => void
  onManageVaults: () => void
  onMigrateBlockNoteNotes: () => void
  onMigrateTaggedNoteBodyFrontmatter: () => void
  onImportLegacyExcalidrawSessions: () => void
  onOpenDesignAudit: () => void
}

export function SettingsPage({
  profileName,
  mistralApiKey,
  editorVimModeEnabled,
  editorVimKeyMappings,
  vaultLocation,
  savedVaultCount,
  onSaveProfile,
  onSaveMistralApiKey,
  onToggleEditorVimMode,
  onUpdateEditorVimKeyMappings,
  onManageVaults,
  onMigrateBlockNoteNotes,
  onMigrateTaggedNoteBodyFrontmatter,
  onImportLegacyExcalidrawSessions,
  onOpenDesignAudit
}: SettingsPageProps): ReactElement {
  const [profileDraft, setProfileDraft] = useState(profileName)
  const [mistralApiKeyDraft, setMistralApiKeyDraft] = useState(mistralApiKey)
  const [vimMappingDrafts, setVimMappingDrafts] =
    useState<NoteVimKeyMapping[]>(editorVimKeyMappings)
  const [activeTab, setActiveTab] = useState<
    'profile' | 'workspace' | 'appearance' | 'editor' | 'agent' | 'developer'
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
    <WorkspacePageLayout heading="Settings" aria-label="App settings">
      <ToggleGroup
        type="single"
        className="w-full"
        value={activeTab}
        onValueChange={(value) => value && setActiveTab(value as typeof activeTab)}
        variant="outline"
        aria-label="Settings sections"
      >
        <ToggleGroupItem className="min-w-0 flex-1 justify-center text-center" value="profile">
          Profile
        </ToggleGroupItem>
        <ToggleGroupItem className="min-w-0 flex-1 justify-center text-center" value="workspace">
          Workspace
        </ToggleGroupItem>
        <ToggleGroupItem className="min-w-0 flex-1 justify-center text-center" value="appearance">
          Appearance
        </ToggleGroupItem>
        <ToggleGroupItem className="min-w-0 flex-1 justify-center text-center" value="editor">
          Editor
        </ToggleGroupItem>
        <ToggleGroupItem className="min-w-0 flex-1 justify-center text-center" value="agent">
          Agent
        </ToggleGroupItem>
        <ToggleGroupItem className="min-w-0 flex-1 justify-center text-center" value="developer">
          Developer
        </ToggleGroupItem>
      </ToggleGroup>

      {activeTab === 'profile' ? (
        <div className="border bg-card text-card-foreground grid gap-4 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-foreground">Profile</h3>
            <p className="max-w-[56ch] text-sm text-muted-foreground">
              Choose how your workspace introduces you across the app.
            </p>
          </div>

          <Field
            label="Profile Name"
            htmlFor="settings-profile-name"
            description="Press Enter or click away to save."
            aria-label="Profile settings"
          >
            <Input
              id="settings-profile-name"
              type="text"
              maxLength={100}
              value={profileDraft}
              placeholder="Your name"
              onChange={(event) => setProfileDraft(event.target.value)}
              onBlur={commitProfileName}
              onKeyDown={onProfileInputKeyDown}
              className="border border-input bg-card text-foreground h-auto w-full rounded-lg border border-border p-2.5"
            />
          </Field>
        </div>
      ) : null}

      {activeTab === 'workspace' ? (
        <div className="border bg-card text-card-foreground grid gap-5 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-foreground">Workspace</h3>
            <p className="w-full text-sm text-muted-foreground">
              Manage the local workspace vaults saved on this device and switch between them when
              you want to work from a different folder.
            </p>
          </div>

          <section className="grid w-full gap-1.5" aria-labelledby="settings-vault-storage-heading">
            <span id="settings-vault-storage-heading" className="text-sm text-muted-foreground">
              Vault storage
            </span>
            <span className="text-sm text-muted-foreground">Active Vault</span>
            <div className="border border-input bg-card text-foreground w-full break-words rounded-lg border border-border p-2.5 text-sm text-foreground">
              {vaultLocation ?? 'No vault selected yet. Open or create a vault to set a location.'}
            </div>
            <span className="text-xs text-muted-foreground">
              Saved locally on this device: {savedVaultCount} vault
              {savedVaultCount === 1 ? '' : 's'}
            </span>
            <Button type="button" variant="outline" onClick={onManageVaults}>
              Manage Vaults
            </Button>
          </section>

          <section
            className="grid w-full gap-1.5"
            aria-labelledby="settings-note-migration-heading"
          >
            <span id="settings-note-migration-heading" className="text-sm text-muted-foreground">
              Note migration
            </span>
            <span className="text-sm text-muted-foreground">Old Note Conversion</span>
            <p className="text-sm leading-6 text-muted-foreground">
              Convert old BlockNote JSON note files into normal markdown in your vault.
            </p>
            <Button type="button" variant="outline" onClick={onMigrateBlockNoteNotes}>
              Convert old BlockNote notes
            </Button>
            <Button type="button" variant="outline" onClick={onMigrateTaggedNoteBodyFrontmatter}>
              Normalize tagged note bodies
            </Button>
            <Button type="button" variant="outline" onClick={onImportLegacyExcalidrawSessions}>
              Import legacy Excalidraw drawings
            </Button>
          </section>
        </div>
      ) : null}

      {activeTab === 'appearance' ? (
        <div className="border bg-card text-card-foreground grid gap-5 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
            <p className="max-w-[56ch] text-sm text-muted-foreground">
              Tune how the app reads with font and surface controls for the main workspace.
            </p>
          </div>

          <div className="border bg-card text-card-foreground grid gap-1.5 rounded-lg p-4">
            <span className="text-sm font-semibold text-foreground">Color Theme</span>
            <span className="text-sm text-muted-foreground">Monotone</span>
            <p className="text-xs text-muted-foreground">
              The interface uses a fixed neutral palette that adapts to the system light or dark
              appearance.
            </p>
          </div>

          <Field
            label="App Font"
            htmlFor="settings-app-font"
            description="The interface uses Inter for consistent readability."
          >
            <Input id="settings-app-font" value="Inter" readOnly aria-label="App font" />
          </Field>
        </div>
      ) : null}

      {activeTab === 'editor' ? (
        <div className="border bg-card text-card-foreground grid gap-5 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-foreground">Editor</h3>
            <p className="max-w-[56ch] text-sm text-muted-foreground">
              Tune note editing behavior for the main workspace editor.
            </p>
          </div>

          <div className="border bg-card text-card-foreground grid gap-2 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2" data-testid="vim-mode-setting">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                    <img
                      src={vimLogo}
                      alt=""
                      aria-hidden="true"
                      data-testid="vim-mode-setting-icon"
                      className="h-4 w-4 shrink-0"
                    />
                  </span>
                  <p className="text-sm font-semibold text-foreground">Vim Mode</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use modal keyboard controls in notes, including insert, normal, and visual modes
                  with common Vim motions.
                </p>
              </div>
              <Switch
                className="self-center"
                checked={editorVimModeEnabled}
                onCheckedChange={onToggleEditorVimMode}
                aria-label="Enable Vim mode"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Disabled by default. Press Escape in the note editor to enter normal mode.
            </p>
          </div>

          <div className="border bg-card text-card-foreground grid gap-3 rounded-lg p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Vim Key Mappings</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add short key sequences such as <span className="font-mono">ij</span> to run core
                  Vim mode actions.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addVimMapping}>
                Add Mapping
              </Button>
            </div>

            {vimMappingDrafts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                No custom mappings yet. Add one like insert / ij / Enter normal mode.
              </p>
            ) : (
              <div className="grid gap-2">
                {vimMappingDrafts.map((mapping) => {
                  const rowErrors = mappingErrors[mapping.id] ?? []

                  return (
                    <div
                      key={mapping.id}
                      className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(11rem,1.4fr)_auto]"
                    >
                      <Field
                        className="gap-1 text-xs text-muted-foreground"
                        label="Mode"
                        htmlFor={`vim-mode-${mapping.id}`}
                      >
                        <Select
                          value={mapping.mode}
                          onValueChange={(value) =>
                            updateVimMapping(mapping.id, { mode: value as NoteVimMappingMode })
                          }
                        >
                          <SelectTrigger id={`vim-mode-${mapping.id}`} className="w-full">
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            {EDITOR_VIM_MAPPING_MODES.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field
                        className="gap-1 text-xs text-muted-foreground"
                        label="Sequence"
                        htmlFor={`vim-sequence-${mapping.id}`}
                      >
                        <Input
                          id={`vim-sequence-${mapping.id}`}
                          className="rounded-lg border border-border bg-card p-3 font-mono text-sm text-foreground"
                          value={mapping.sequence}
                          maxLength={8}
                          placeholder="ij"
                          onChange={(event) =>
                            updateVimMapping(mapping.id, { sequence: event.target.value })
                          }
                          spellCheck={false}
                        />
                      </Field>

                      <Field
                        className="gap-1 text-xs text-muted-foreground"
                        label="Action"
                        htmlFor={`vim-action-${mapping.id}`}
                      >
                        <Select
                          value={mapping.action}
                          onValueChange={(value) =>
                            updateVimMapping(mapping.id, { action: value as NoteVimMappingAction })
                          }
                        >
                          <SelectTrigger id={`vim-action-${mapping.id}`} className="w-full">
                            <SelectValue placeholder="Select action" />
                          </SelectTrigger>
                          <SelectContent>
                            {getEditorVimActionOptions(mapping.mode).map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Button
                        type="button"
                        variant="outline"
                        className="self-end"
                        onClick={() => removeVimMapping(mapping.id)}
                      >
                        Remove
                      </Button>

                      {rowErrors.length > 0 ? (
                        <p className="text-xs text-destructive md:col-span-4">
                          {rowErrors.join(' ')}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}

            {hasMappingErrors ? (
              <p className="text-xs text-muted-foreground">
                Fix mapping errors to save changes. Valid sequences use 1-8 printable characters.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Custom mappings override built-in Vim keys when the same sequence is used.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'agent' ? (
        <div className="border bg-card text-card-foreground grid gap-4 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-foreground">Agent</h3>
            <p className="max-w-[56ch] text-sm text-muted-foreground">
              Connect your AI provider for command palette completion and agent workflows.
            </p>
          </div>

          <Field
            label="Mistral API Key"
            htmlFor="settings-mistral-api-key"
            description="Used for `?` AI note completion in the command palette. Press Enter or click away to save."
            aria-label="Mistral AI settings"
          >
            <Input
              id="settings-mistral-api-key"
              type="password"
              value={mistralApiKeyDraft}
              placeholder="Paste your Mistral API key"
              onChange={(event) => setMistralApiKeyDraft(event.target.value)}
              onBlur={commitMistralApiKey}
              onKeyDown={onProfileInputKeyDown}
              className="border border-input bg-card text-foreground h-auto w-full rounded-lg border border-border p-2.5"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
      ) : null}

      {activeTab === 'developer' ? (
        <div className="border bg-card text-card-foreground grid gap-4 rounded-lg p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-foreground">Developer</h3>
            <p className="max-w-[56ch] text-sm text-muted-foreground">
              Inspect the app&apos;s design-system primitives, tokens, and component states.
            </p>
          </div>

          <div className="border bg-card text-card-foreground flex flex-wrap items-center justify-between gap-4 rounded-lg p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Design Audit</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Review the live visual language and interactive component specimens.
              </p>
            </div>
            <Button
              type="button"
              data-testid="settings-open-design-audit"
              variant="outline"
              size="sm"
              onClick={onOpenDesignAudit}
            >
              Open Design Audit
            </Button>
          </div>
        </div>
      ) : null}
    </WorkspacePageLayout>
  )
}
