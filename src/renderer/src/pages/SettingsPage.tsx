import { ReactElement, KeyboardEvent, useEffect, useState } from 'react'
import {
  Button,
  Field,
  Input,
  SelectionPopover,
  Switch,
  TabToggleGroup,
  TabToggleGroupItem
} from '../components/ui'
import { WorkspacePageLayout, WorkspaceReadingWidth } from '../components/workspace'
import { WorkspaceHeaderSecondaryActions } from '../components/ui/document-workspace'
import type {
  CondaEnvironment,
  GoogleDriveAuthorizationStart,
  NoteVimKeyMapping,
  NoteVimMappingAction,
  NoteVimMappingMode,
  WorkspaceFeatureFlags
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

function FeatureToggle({
  id,
  label,
  description,
  checked,
  onCheckedChange
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}): ReactElement {
  return (
    <label
      htmlFor={id}
      className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3"
    >
      <span className="grid gap-1">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </label>
  )
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
  mistralApiKeyConfigured: boolean
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
  onMigrateNoteImagePaths: () => void
  onImportLegacyExcalidrawSessions: () => void
  onOpenDesignAudit: () => void
  pythonCondaEnvironmentPath: string | null
  pythonCondaExecutablePath: string | null
  detectedCondaExecutablePath: string | null
  condaEnvironments: CondaEnvironment[]
  condaEnvironmentsLoading: boolean
  condaEnvironmentsError: string | null
  onRefreshCondaEnvironments: () => void
  onSelectCondaEnvironment: (path: string | null) => void
  onChooseCondaExecutable: () => void
  onResetCondaExecutable: () => void
  featureFlags?: Partial<WorkspaceFeatureFlags>
  onUpdateFeatureFlag?: (key: keyof WorkspaceFeatureFlags, enabled: boolean) => void
  googleDriveConnected?: boolean
  onStartGoogleDriveAuthorization?: () => Promise<GoogleDriveAuthorizationStart>
  onCompleteGoogleDriveAuthorization?: (input: {
    connectionId: string
    code: string
    state: string
  }) => Promise<void>
  onDisconnectGoogleDrive?: () => Promise<void>
  onOpenExternal?: (url: string) => Promise<void>
}

export function SettingsPage({
  profileName,
  mistralApiKeyConfigured,
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
  onMigrateNoteImagePaths,
  onImportLegacyExcalidrawSessions,
  onOpenDesignAudit,
  pythonCondaEnvironmentPath,
  pythonCondaExecutablePath,
  detectedCondaExecutablePath,
  condaEnvironments,
  condaEnvironmentsLoading,
  condaEnvironmentsError,
  onRefreshCondaEnvironments,
  onSelectCondaEnvironment,
  onChooseCondaExecutable,
  onResetCondaExecutable,
  featureFlags = {},
  onUpdateFeatureFlag = () => undefined,
  googleDriveConnected = false,
  onStartGoogleDriveAuthorization,
  onCompleteGoogleDriveAuthorization,
  onDisconnectGoogleDrive,
  onOpenExternal
}: SettingsPageProps): ReactElement {
  const [profileDraft, setProfileDraft] = useState(profileName)
  const [mistralApiKeyDraft, setMistralApiKeyDraft] = useState('')
  const [vimMappingDrafts, setVimMappingDrafts] =
    useState<NoteVimKeyMapping[]>(editorVimKeyMappings)
  const [driveAuthorization, setDriveAuthorization] =
    useState<GoogleDriveAuthorizationStart | null>(null)
  const [driveCode, setDriveCode] = useState('')
  const [driveState, setDriveState] = useState('')
  const [driveBusy, setDriveBusy] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    'profile' | 'workspace' | 'appearance' | 'editor' | 'agent' | 'developer'
  >('profile')

  useEffect(() => {
    setProfileDraft(profileName)
  }, [profileName])

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
    if (!mistralApiKeyDraft.trim()) {
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

  const startDriveAuthorization = async (): Promise<void> => {
    if (!onStartGoogleDriveAuthorization || driveBusy) return
    setDriveBusy(true)
    setDriveError(null)
    try {
      const authorization = await onStartGoogleDriveAuthorization()
      setDriveAuthorization(authorization)
      setDriveState(authorization.request.state)
      if (onOpenExternal) await onOpenExternal(authorization.request.url)
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : String(error))
    } finally {
      setDriveBusy(false)
    }
  }

  const completeDriveAuthorization = async (): Promise<void> => {
    if (!driveAuthorization || !onCompleteGoogleDriveAuthorization || driveBusy) return
    const code = driveCode.trim()
    const state = driveState.trim()
    if (!code || !state) {
      setDriveError('Paste the authorization code and state before completing the connection.')
      return
    }
    setDriveBusy(true)
    setDriveError(null)
    try {
      await onCompleteGoogleDriveAuthorization({
        connectionId: driveAuthorization.connectionId,
        code,
        state
      })
      setDriveAuthorization(null)
      setDriveCode('')
      setDriveState('')
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : String(error))
    } finally {
      setDriveBusy(false)
    }
  }

  const disconnectDrive = async (): Promise<void> => {
    if (!onDisconnectGoogleDrive || driveBusy) return
    setDriveBusy(true)
    setDriveError(null)
    try {
      await onDisconnectGoogleDrive()
      setDriveAuthorization(null)
      setDriveCode('')
      setDriveState('')
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : String(error))
    } finally {
      setDriveBusy(false)
    }
  }

  return (
    <WorkspacePageLayout aria-label="App settings">
      <WorkspaceHeaderSecondaryActions>
        <TabToggleGroup
          className="max-w-none [&>button]:rounded-[var(--radius-button-pill)]"
          value={activeTab}
          onValueChange={(value) => value && setActiveTab(value as typeof activeTab)}
          aria-label="Settings sections"
          data-testid="settings-tabs"
        >
          <TabToggleGroupItem
            id="settings-tab-profile"
            aria-controls="settings-tab-panel"
            value="profile"
          >
            Profile
          </TabToggleGroupItem>
          <TabToggleGroupItem
            id="settings-tab-workspace"
            aria-controls="settings-tab-panel"
            value="workspace"
          >
            Workspace
          </TabToggleGroupItem>
          <TabToggleGroupItem
            id="settings-tab-appearance"
            aria-controls="settings-tab-panel"
            value="appearance"
          >
            Appearance
          </TabToggleGroupItem>
          <TabToggleGroupItem
            id="settings-tab-editor"
            aria-controls="settings-tab-panel"
            value="editor"
          >
            Editor
          </TabToggleGroupItem>
          <TabToggleGroupItem
            id="settings-tab-agent"
            aria-controls="settings-tab-panel"
            value="agent"
          >
            Agent
          </TabToggleGroupItem>
          <TabToggleGroupItem
            id="settings-tab-developer"
            aria-controls="settings-tab-panel"
            value="developer"
          >
            Developer
          </TabToggleGroupItem>
        </TabToggleGroup>
      </WorkspaceHeaderSecondaryActions>

      <WorkspaceReadingWidth>
        {activeTab === 'profile' ? (
          <div
            id="settings-tab-panel"
            role="tabpanel"
            aria-labelledby="settings-tab-profile"
            className="grid gap-4"
          >
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
          <div
            id="settings-tab-panel"
            role="tabpanel"
            aria-labelledby="settings-tab-workspace"
            className="grid gap-5"
          >
            <div className="grid gap-1">
              <h3 className="text-lg font-semibold text-foreground">Workspace</h3>
              <p className="w-full text-sm text-muted-foreground">
                Manage the local workspace vaults saved on this device and switch between them when
                you want to work from a different folder.
              </p>
            </div>

            <section
              className="grid w-full gap-1.5"
              aria-labelledby="settings-vault-storage-heading"
            >
              <span id="settings-vault-storage-heading" className="text-sm text-muted-foreground">
                Vault storage
              </span>
              <span className="text-sm text-muted-foreground">Active Vault</span>
              <div className="border border-input bg-card text-foreground w-full break-words rounded-lg border border-border p-2.5 text-sm text-foreground">
                {vaultLocation ??
                  'No vault selected yet. Open or create a vault to set a location.'}
              </div>
              <span className="text-xs text-muted-foreground">
                Saved locally on this device: {savedVaultCount} vault
                {savedVaultCount === 1 ? '' : 's'}
              </span>
              <Button type="button" variant="outline" onClick={onManageVaults}>
                Manage Vaults
              </Button>
            </section>

            <section className="grid gap-3" aria-labelledby="settings-context-features-heading">
              <div>
                <span
                  id="settings-context-features-heading"
                  className="text-sm text-muted-foreground"
                >
                  Context features
                </span>
                <p className="text-xs text-muted-foreground">
                  These switches are stored per vault. External content stays in its source system
                  unless you explicitly publish it.
                </p>
              </div>
              <FeatureToggle
                id="settings-resources-enabled"
                label="Resource links"
                description="Attach local files, folders, and URLs to projects and captures."
                checked={featureFlags.resources ?? true}
                onCheckedChange={(enabled) => onUpdateFeatureFlag('resources', enabled)}
              />
              <FeatureToggle
                id="settings-filesystem-indexing"
                label="Local text indexing"
                description="Allow previews and search excerpts for selected text files."
                checked={featureFlags.filesystemContentIndexing ?? false}
                onCheckedChange={(enabled) =>
                  onUpdateFeatureFlag('filesystemContentIndexing', enabled)
                }
              />
              <FeatureToggle
                id="settings-external-writes"
                label="Explicit external writes"
                description="Enable previewed, hash-checked one-shot writes to authorized local roots."
                checked={featureFlags.externalWrites ?? false}
                onCheckedChange={(enabled) => onUpdateFeatureFlag('externalWrites', enabled)}
              />
              <FeatureToggle
                id="settings-google-drive-resources"
                label="Google Drive resources"
                description="Enable selected-file Drive metadata links; content stays in Google Drive."
                checked={featureFlags.googleDriveResources ?? false}
                onCheckedChange={(enabled) => onUpdateFeatureFlag('googleDriveResources', enabled)}
              />
              <FeatureToggle
                id="settings-google-drive-content"
                label="Selected Drive text previews"
                description="Allow bounded previews for selected Drive files; attached Docs feed agent context and project exports."
                checked={featureFlags.googleDriveContentIndexing ?? false}
                onCheckedChange={(enabled) =>
                  onUpdateFeatureFlag('googleDriveContentIndexing', enabled)
                }
              />
            </section>

            <section className="grid gap-3" aria-labelledby="settings-google-drive-heading">
              <div>
                <span id="settings-google-drive-heading" className="text-sm text-muted-foreground">
                  Google Drive connection
                </span>
                <p className="text-xs leading-5 text-muted-foreground">
                  Uses a narrow selected-file scope. Drive remains the source of truth; Xingularity
                  stores only metadata and relationships.
                </p>
              </div>
              {!featureFlags.googleDriveResources ? (
                <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                  Enable Google Drive resources above to connect an account.
                </p>
              ) : (
                <div className="grid gap-3 rounded-lg border border-border bg-card p-3">
                  <p className="text-sm text-foreground">
                    Status: {googleDriveConnected ? 'Connected' : 'Not connected'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void startDriveAuthorization()}
                      disabled={driveBusy || !onStartGoogleDriveAuthorization}
                    >
                      {googleDriveConnected ? 'Reconnect Google Drive' : 'Connect Google Drive'}
                    </Button>
                    {googleDriveConnected ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void disconnectDrive()}
                        disabled={driveBusy || !onDisconnectGoogleDrive}
                      >
                        Disconnect
                      </Button>
                    ) : null}
                  </div>
                  {driveAuthorization ? (
                    <div className="grid gap-2 border-t border-border pt-3">
                      <p className="text-xs leading-5 text-muted-foreground">
                        A browser window opened for consent. After approval, paste the returned code
                        and state here to finish the connection.
                      </p>
                      <Field label="Authorization code" htmlFor="settings-drive-code">
                        <Input
                          id="settings-drive-code"
                          value={driveCode}
                          onChange={(event) => setDriveCode(event.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="Paste code"
                          disabled={driveBusy}
                        />
                      </Field>
                      <Field label="State" htmlFor="settings-drive-state">
                        <Input
                          id="settings-drive-state"
                          value={driveState}
                          onChange={(event) => setDriveState(event.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          disabled={driveBusy}
                        />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="default"
                          onClick={() => void completeDriveAuthorization()}
                          disabled={driveBusy || !driveCode.trim()}
                        >
                          Complete connection
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setDriveAuthorization(null)}
                          disabled={driveBusy}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {driveError ? <p className="text-xs text-destructive">{driveError}</p> : null}
                </div>
              )}
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
              <Button type="button" variant="outline" onClick={onMigrateNoteImagePaths}>
                Repair note image paths
              </Button>
              <Button type="button" variant="outline" onClick={onImportLegacyExcalidrawSessions}>
                Import legacy Excalidraw drawings
              </Button>
            </section>
          </div>
        ) : null}

        {activeTab === 'appearance' ? (
          <div
            id="settings-tab-panel"
            role="tabpanel"
            aria-labelledby="settings-tab-appearance"
            className="grid gap-5"
          >
            <div className="grid gap-1">
              <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
              <p className="max-w-[56ch] text-sm text-muted-foreground">
                Tune how the app reads with font and surface controls for the main workspace.
              </p>
            </div>

            <div className="border bg-card text-card-foreground grid gap-1.5 rounded-lg p-4">
              <span className="text-sm font-semibold text-foreground">Color Theme</span>
              <span className="text-sm text-muted-foreground">Dark</span>
              <p className="text-xs text-muted-foreground">
                The interface uses a fixed dark palette for consistent contrast across operating
                systems.
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
          <div
            id="settings-tab-panel"
            role="tabpanel"
            aria-labelledby="settings-tab-editor"
            className="grid gap-5"
          >
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
                    Add short key sequences such as <span className="font-mono">ij</span> to run
                    core Vim mode actions.
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
                          <SelectionPopover
                            selectionMode="single"
                            value={mapping.mode}
                            options={EDITOR_VIM_MAPPING_MODES}
                            onValueChange={(value) =>
                              updateVimMapping(mapping.id, { mode: value as NoteVimMappingMode })
                            }
                            label="Mode"
                            searchPlaceholder="Search modes"
                            triggerProps={{
                              id: `vim-mode-${mapping.id}`,
                              'aria-label': 'Mode',
                              className: 'w-full'
                            }}
                          />
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
                          <SelectionPopover
                            selectionMode="single"
                            value={mapping.action}
                            options={getEditorVimActionOptions(mapping.mode)}
                            onValueChange={(value) =>
                              updateVimMapping(mapping.id, {
                                action: value as NoteVimMappingAction
                              })
                            }
                            label="Action"
                            searchPlaceholder="Search actions"
                            triggerProps={{
                              id: `vim-action-${mapping.id}`,
                              'aria-label': 'Action',
                              className: 'w-full'
                            }}
                          />
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
          <div
            id="settings-tab-panel"
            role="tabpanel"
            aria-labelledby="settings-tab-agent"
            className="grid gap-4"
          >
            <div className="grid gap-1">
              <h3 className="text-lg font-semibold text-foreground">Agent</h3>
              <p className="max-w-[56ch] text-sm text-muted-foreground">
                Connect your AI provider for command palette completion and agent workflows.
              </p>
            </div>

            <Field
              label="Mistral API Key"
              htmlFor="settings-mistral-api-key"
              description="Stored in the device credential store for this vault. The key is never written into vault files or exports."
              aria-label="Mistral AI settings"
            >
              <Input
                id="settings-mistral-api-key"
                type="password"
                value={mistralApiKeyDraft}
                placeholder={
                  mistralApiKeyConfigured
                    ? 'Configured — paste to rotate'
                    : 'Paste your Mistral API key'
                }
                onChange={(event) => setMistralApiKeyDraft(event.target.value)}
                onBlur={commitMistralApiKey}
                onKeyDown={onProfileInputKeyDown}
                className="border border-input bg-card text-foreground h-auto w-full rounded-lg border border-border p-2.5"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span role="status">
                  {mistralApiKeyConfigured
                    ? 'A Mistral credential is configured for this vault.'
                    : 'No Mistral credential is configured.'}
                </span>
                {mistralApiKeyConfigured ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSaveMistralApiKey('')}
                  >
                    Remove credential
                  </Button>
                ) : null}
              </div>
            </Field>
          </div>
        ) : null}

        {activeTab === 'developer' ? (
          <div
            id="settings-tab-panel"
            role="tabpanel"
            aria-labelledby="settings-tab-developer"
            className="grid gap-4"
          >
            <div className="grid gap-1">
              <h3 className="text-lg font-semibold text-foreground">Developer</h3>
              <p className="max-w-[56ch] text-sm text-muted-foreground">
                Configure developer tools and the runtime used by Python automations.
              </p>
            </div>

            <section
              className="grid gap-3 rounded-lg border border-border p-4"
              aria-labelledby="settings-python-runtime-heading"
            >
              <div className="grid gap-1">
                <h4
                  id="settings-python-runtime-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  Python runtime
                </h4>
                <p className="text-sm text-muted-foreground">
                  Choose the Conda environment used by all Python automations. System Python is the
                  default, and Conda can be discovered automatically or selected explicitly.
                </p>
              </div>

              <Field
                label="Conda executable"
                description="Automatic discovery checks the app PATH and common installation locations."
              >
                <div className="grid gap-2">
                  <div
                    className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground break-all"
                    role="status"
                    data-testid="settings-conda-executable-status"
                  >
                    {pythonCondaExecutablePath
                      ? `Configured: ${pythonCondaExecutablePath}`
                      : detectedCondaExecutablePath
                        ? `Detected automatically: ${detectedCondaExecutablePath}`
                        : 'Automatic discovery is active'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onChooseCondaExecutable}
                      data-testid="settings-choose-conda-executable"
                    >
                      Choose executable
                    </Button>
                    {pythonCondaExecutablePath ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onResetCondaExecutable}
                        data-testid="settings-reset-conda-executable"
                      >
                        Use automatic discovery
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Field>

              <Field
                label="Python environment"
                htmlFor="settings-python-conda-environment"
                description="The selected environment must remain available when an automation runs."
              >
                <div className="flex flex-wrap items-start gap-2">
                  <SelectionPopover
                    selectionMode="single"
                    value={pythonCondaEnvironmentPath ?? 'system'}
                    options={[
                      { value: 'system', label: 'System Python', searchText: 'system python' },
                      ...condaEnvironments.map((environment) => ({
                        value: environment.path,
                        label: environment.name,
                        searchText: `${environment.name} ${environment.path}`
                      })),
                      ...(pythonCondaEnvironmentPath &&
                      !condaEnvironments.some(
                        (environment) => environment.path === pythonCondaEnvironmentPath
                      )
                        ? [
                            {
                              value: pythonCondaEnvironmentPath,
                              label: `Unavailable: ${pythonCondaEnvironmentPath}`,
                              searchText: pythonCondaEnvironmentPath
                            }
                          ]
                        : [])
                    ]}
                    onValueChange={(value) =>
                      onSelectCondaEnvironment(value === 'system' ? null : value)
                    }
                    label="Python environment"
                    searchPlaceholder="Search Python environments"
                    triggerProps={{
                      id: 'settings-python-conda-environment',
                      'data-testid': 'settings-python-conda-environment',
                      'aria-label': 'Python environment',
                      className: 'min-w-64 flex-1'
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRefreshCondaEnvironments}
                    disabled={condaEnvironmentsLoading}
                    data-testid="settings-refresh-conda-environments"
                  >
                    {condaEnvironmentsLoading ? 'Refreshing…' : 'Refresh'}
                  </Button>
                </div>
              </Field>

              {condaEnvironmentsLoading ? (
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  Looking for Conda environments…
                </p>
              ) : null}
              {condaEnvironmentsError ? (
                <p className="text-xs text-destructive" role="alert">
                  {condaEnvironmentsError}
                </p>
              ) : null}
              {pythonCondaEnvironmentPath &&
              !condaEnvironmentsLoading &&
              !condaEnvironments.some(
                (environment) => environment.path === pythonCondaEnvironmentPath
              ) ? (
                <p className="text-xs text-destructive" role="alert">
                  The selected Conda environment is unavailable. Choose another environment or
                  switch back to System Python.
                </p>
              ) : null}
            </section>

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
      </WorkspaceReadingWidth>
    </WorkspacePageLayout>
  )
}
