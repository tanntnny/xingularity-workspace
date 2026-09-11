import { ReactElement, KeyboardEvent, ReactNode, useEffect, useState } from 'react'
import {
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectionPopover,
  Switch,
  TabToggleGroup,
  TabToggleGroupItem
} from '../components/ui'
import { WorkspacePageLayout, WorkspaceReadingWidth } from '../components/workspace'
import { WorkspaceHeaderSecondaryActions } from '../components/ui/document-workspace'
import { SettingsRow, SettingsSection } from '../components/settings'
import { VaultSyncSection, type VaultSyncSectionProps } from './VaultSyncPage'
import type {
  CondaEnvironment,
  GoogleDriveAuthorizationStart,
  NoteVimKeyMapping,
  NoteVimMappingAction,
  NoteVimMappingMode,
  WorkspaceFeatureFlags
} from '../../../shared/types'
import {
  APP_FONT_OPTIONS,
  CODE_FONT_OPTIONS,
  getAppFontOption,
  getCodeFontOption,
  isCodeFontId,
  isAppFontId,
  type AppFontCategory,
  type AppFontId
} from '../../../shared/fontCatalog'
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

export type SettingsTabId =
  | 'profile'
  | 'workspace'
  | 'sync'
  | 'appearance'
  | 'editor'
  | 'agent'
  | 'developer'

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

const SETTINGS_PANEL_IDS: Record<SettingsTabId, string> = {
  profile: 'settings-tab-panel-profile',
  workspace: 'settings-tab-panel-workspace',
  sync: 'settings-tab-panel-sync',
  appearance: 'settings-tab-panel-appearance',
  editor: 'settings-tab-panel-editor',
  agent: 'settings-tab-panel-agent',
  developer: 'settings-tab-panel-developer'
}

interface SettingsTabPanelProps {
  tabId: SettingsTabId
  heading: string
  description: ReactNode
  children: ReactNode
}

function SettingsTabPanel({
  tabId,
  heading,
  description,
  children
}: SettingsTabPanelProps): ReactElement {
  const panelId = SETTINGS_PANEL_IDS[tabId]

  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-labelledby={`settings-tab-${tabId}`}
      className="grid gap-5"
    >
      <header className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{heading}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  )
}

interface SettingsPageProps {
  initialTab?: SettingsTabId
  syncHealth?: VaultSyncSectionProps
  profileName: string
  fontFamily: string
  codeFontFamily: string
  mistralApiKeyConfigured: boolean
  editorVimModeEnabled: boolean
  editorVimKeyMappings: NoteVimKeyMapping[]
  vaultLocation: string | null
  savedVaultCount: number
  onSaveProfile: (name: string) => void
  onSaveFont: (fontId: AppFontId) => void
  onSaveCodeFont: (fontId: AppFontId) => void
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
  initialTab,
  syncHealth,
  profileName,
  fontFamily,
  codeFontFamily,
  mistralApiKeyConfigured,
  editorVimModeEnabled,
  editorVimKeyMappings,
  vaultLocation,
  savedVaultCount,
  onSaveProfile,
  onSaveFont,
  onSaveCodeFont,
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
  const syncHealthAvailable = Boolean(syncHealth)
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
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    initialTab === 'sync' && !syncHealthAvailable ? 'profile' : (initialTab ?? 'profile')
  )
  const selectedFont = getAppFontOption(fontFamily)
  const selectedCodeFont = getCodeFontOption(codeFontFamily)

  useEffect(() => {
    setProfileDraft(profileName)
  }, [profileName])

  useEffect(() => {
    setVimMappingDrafts(editorVimKeyMappings)
  }, [editorVimKeyMappings])

  useEffect(() => {
    if (initialTab === 'sync' && !syncHealthAvailable) {
      setActiveTab('profile')
      return
    }

    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab, syncHealthAvailable])

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
            aria-controls={SETTINGS_PANEL_IDS.profile}
            value="profile"
          >
            Profile
          </TabToggleGroupItem>
          <TabToggleGroupItem
            id="settings-tab-workspace"
            aria-controls={SETTINGS_PANEL_IDS.workspace}
            value="workspace"
          >
            Workspace
          </TabToggleGroupItem>
          {syncHealthAvailable ? (
            <TabToggleGroupItem
              id="settings-tab-sync"
              aria-controls={SETTINGS_PANEL_IDS.sync}
              value="sync"
            >
              Sync
            </TabToggleGroupItem>
          ) : null}
          <TabToggleGroupItem
            id="settings-tab-appearance"
            aria-controls={SETTINGS_PANEL_IDS.appearance}
            value="appearance"
          >
            Appearance
          </TabToggleGroupItem>
          <TabToggleGroupItem
            id="settings-tab-editor"
            aria-controls={SETTINGS_PANEL_IDS.editor}
            value="editor"
          >
            Editor
          </TabToggleGroupItem>
          <TabToggleGroupItem
            id="settings-tab-agent"
            aria-controls={SETTINGS_PANEL_IDS.agent}
            value="agent"
          >
            Agent
          </TabToggleGroupItem>
          <TabToggleGroupItem
            id="settings-tab-developer"
            aria-controls={SETTINGS_PANEL_IDS.developer}
            value="developer"
          >
            Developer
          </TabToggleGroupItem>
        </TabToggleGroup>
      </WorkspaceHeaderSecondaryActions>

      <WorkspaceReadingWidth>
        {activeTab === 'profile' ? (
          <SettingsTabPanel
            tabId="profile"
            heading="Profile"
            description="Choose how your workspace introduces you across the app."
          >
            <SettingsSection heading="Profile details" headingId="settings-profile-details-heading">
              <SettingsRow
                label="Profile name"
                labelId="settings-profile-name-label"
                description="Press Enter or click away to save."
                descriptionId="settings-profile-name-description"
                htmlFor="settings-profile-name"
                valueClassName="max-w-xl"
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
                  aria-describedby="settings-profile-name-description"
                />
              </SettingsRow>
            </SettingsSection>
          </SettingsTabPanel>
        ) : null}

        {activeTab === 'workspace' ? (
          <SettingsTabPanel
            tabId="workspace"
            heading="Workspace"
            description="Manage local vaults, context features, integrations, and note migrations."
          >
            <SettingsSection
              heading="Vault storage"
              headingId="settings-vault-storage-heading"
              description="Choose which local vault is active on this device."
            >
              <SettingsRow
                label="Active vault"
                labelId="settings-active-vault-label"
                description={`Saved locally on this device: ${savedVaultCount} vault${savedVaultCount === 1 ? '' : 's'}.`}
                valueClassName="max-w-2xl"
              >
                <div className="break-words rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground">
                  {vaultLocation ??
                    'No vault selected yet. Open or create a vault to set a location.'}
                </div>
                <Button type="button" variant="outline" onClick={onManageVaults}>
                  Manage Vaults
                </Button>
              </SettingsRow>
            </SettingsSection>

            <SettingsSection
              heading="Context features"
              headingId="settings-context-features-heading"
              description="These switches are stored per vault. External content stays in its source system unless you explicitly publish it."
            >
              <SettingsRow
                label="Resource links"
                labelId="settings-resources-enabled-label"
                description="Attach local files, folders, and URLs to projects and captures."
                valueClassName="items-center"
              >
                <Switch
                  id="settings-resources-enabled"
                  checked={featureFlags.resources ?? true}
                  onCheckedChange={(enabled) => onUpdateFeatureFlag('resources', enabled)}
                  aria-labelledby="settings-resources-enabled-label"
                />
              </SettingsRow>
              <SettingsRow
                label="Local text indexing"
                labelId="settings-filesystem-indexing-label"
                description="Allow previews and search excerpts for selected text files."
                valueClassName="items-center"
              >
                <Switch
                  id="settings-filesystem-indexing"
                  checked={featureFlags.filesystemContentIndexing ?? false}
                  onCheckedChange={(enabled) =>
                    onUpdateFeatureFlag('filesystemContentIndexing', enabled)
                  }
                  aria-labelledby="settings-filesystem-indexing-label"
                />
              </SettingsRow>
              <SettingsRow
                label="Explicit external writes"
                labelId="settings-external-writes-label"
                description="Enable previewed, hash-checked one-shot writes to authorized local roots."
                valueClassName="items-center"
              >
                <Switch
                  id="settings-external-writes"
                  checked={featureFlags.externalWrites ?? false}
                  onCheckedChange={(enabled) => onUpdateFeatureFlag('externalWrites', enabled)}
                  aria-labelledby="settings-external-writes-label"
                />
              </SettingsRow>
              <SettingsRow
                label="Google Drive resources"
                labelId="settings-google-drive-resources-label"
                description="Enable selected-file Drive metadata links; content stays in Google Drive."
                valueClassName="items-center"
              >
                <Switch
                  id="settings-google-drive-resources"
                  checked={featureFlags.googleDriveResources ?? false}
                  onCheckedChange={(enabled) =>
                    onUpdateFeatureFlag('googleDriveResources', enabled)
                  }
                  aria-labelledby="settings-google-drive-resources-label"
                />
              </SettingsRow>
              <SettingsRow
                label="Selected Drive text previews"
                labelId="settings-google-drive-content-label"
                description="Allow bounded previews for selected Drive files; attached Docs feed agent context and project exports."
                valueClassName="items-center"
              >
                <Switch
                  id="settings-google-drive-content"
                  checked={featureFlags.googleDriveContentIndexing ?? false}
                  onCheckedChange={(enabled) =>
                    onUpdateFeatureFlag('googleDriveContentIndexing', enabled)
                  }
                  aria-labelledby="settings-google-drive-content-label"
                />
              </SettingsRow>
            </SettingsSection>

            <SettingsSection
              heading="Google Drive connection"
              headingId="settings-google-drive-heading"
              description="Uses a narrow selected-file scope. Drive remains the source of truth; Xingularity stores only metadata and relationships."
            >
              <SettingsRow
                label="Connection"
                labelId="settings-google-drive-connection-label"
                description={
                  featureFlags.googleDriveResources
                    ? 'Authorize the account used for selected Drive resources.'
                    : 'Enable Google Drive resources above to connect an account.'
                }
                error={driveError ?? undefined}
                errorId="settings-google-drive-error"
                valueClassName="max-w-2xl"
              >
                {featureFlags.googleDriveResources ? (
                  <div className="grid gap-3">
                    <p className="text-sm text-foreground" role="status">
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
                      <div className="grid gap-3 border-t border-border pt-3">
                        <p className="text-xs leading-5 text-muted-foreground">
                          A browser window opened for consent. After approval, paste the returned
                          code and state here to finish the connection.
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
                  </div>
                ) : (
                  <p className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                    Enable Google Drive resources above to connect an account.
                  </p>
                )}
              </SettingsRow>
            </SettingsSection>

            <SettingsSection
              heading="Note migration"
              headingId="settings-note-migration-heading"
              description="Convert or repair legacy note and drawing files in the active vault."
            >
              <SettingsRow
                label="Old Note Conversion"
                description="Convert old BlockNote JSON note files into normal markdown in your vault."
              >
                <Button type="button" variant="outline" onClick={onMigrateBlockNoteNotes}>
                  Convert old BlockNote notes
                </Button>
              </SettingsRow>
              <SettingsRow
                label="Tagged note bodies"
                description="Normalize legacy tag data that is still visible in note bodies."
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={onMigrateTaggedNoteBodyFrontmatter}
                >
                  Normalize tagged note bodies
                </Button>
              </SettingsRow>
              <SettingsRow
                label="Note image paths"
                description="Repair legacy image links and recover available attachments."
              >
                <Button type="button" variant="outline" onClick={onMigrateNoteImagePaths}>
                  Repair note image paths
                </Button>
              </SettingsRow>
              <SettingsRow
                label="Legacy Excalidraw drawings"
                description="Import standalone legacy drawings into the active notebook."
              >
                <Button type="button" variant="outline" onClick={onImportLegacyExcalidrawSessions}>
                  Import legacy Excalidraw drawings
                </Button>
              </SettingsRow>
            </SettingsSection>
          </SettingsTabPanel>
        ) : null}

        {activeTab === 'sync' && syncHealth ? (
          <section
            id={SETTINGS_PANEL_IDS.sync}
            role="tabpanel"
            aria-labelledby="settings-tab-sync"
            data-testid="settings-sync-panel"
            className="grid gap-5"
          >
            <VaultSyncSection {...syncHealth} />
          </section>
        ) : null}

        {activeTab === 'appearance' ? (
          <SettingsTabPanel
            tabId="appearance"
            heading="Appearance"
            description="Tune how the app reads with font and surface controls for the main workspace."
          >
            <SettingsSection
              heading="Interface defaults"
              headingId="settings-appearance-defaults-heading"
            >
              <SettingsRow
                label="Color theme"
                labelId="settings-color-theme-label"
                description="The interface uses a fixed dark palette for consistent contrast across operating systems."
              >
                <span className="text-sm text-foreground">Dark</span>
              </SettingsRow>
              <SettingsRow
                label="App font"
                labelId="settings-app-font-label"
                description="Choose the interface font. Changes apply immediately and are saved to this vault."
                htmlFor="settings-app-font"
                valueClassName="max-w-xl"
              >
                <Select
                  value={selectedFont.id}
                  onValueChange={(value) => {
                    if (isAppFontId(value)) {
                      onSaveFont(value)
                    }
                  }}
                >
                  <SelectTrigger
                    id="settings-app-font"
                    aria-labelledby="settings-app-font-label"
                    data-testid="settings-app-font-select"
                    className="rounded-md"
                    style={{ fontFamily: selectedFont.cssFamily }}
                  >
                    <SelectValue placeholder="Select a font" />
                  </SelectTrigger>
                  <SelectContent>
                    {(['sans', 'serif', 'mono', 'system'] as AppFontCategory[]).map((category) => (
                      <SelectGroup key={category}>
                        <SelectLabel>
                          {category === 'sans'
                            ? 'Sans serif'
                            : category === 'mono'
                              ? 'Monospace'
                              : category[0].toUpperCase() + category.slice(1)}
                        </SelectLabel>
                        {APP_FONT_OPTIONS.filter((option) => option.category === category).map(
                          (option) => (
                            <SelectItem
                              key={option.id}
                              value={option.id}
                              style={{ fontFamily: option.cssFamily }}
                            >
                              {option.label}
                            </SelectItem>
                          )
                        )}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
              <SettingsRow
                label="Code font"
                labelId="settings-code-font-label"
                description="Choose the monospace font for inline and fenced code in notes."
                htmlFor="settings-code-font"
                valueClassName="max-w-xl"
              >
                <Select
                  value={selectedCodeFont.id}
                  onValueChange={(value) => {
                    if (isCodeFontId(value)) {
                      onSaveCodeFont(value)
                    }
                  }}
                >
                  <SelectTrigger
                    id="settings-code-font"
                    aria-labelledby="settings-code-font-label"
                    data-testid="settings-code-font-select"
                    className="rounded-md"
                    style={{ fontFamily: selectedCodeFont.cssFamily }}
                  >
                    <SelectValue placeholder="Select a code font" />
                  </SelectTrigger>
                  <SelectContent>
                    {CODE_FONT_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.id}
                        value={option.id}
                        style={{ fontFamily: option.cssFamily }}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
            </SettingsSection>
          </SettingsTabPanel>
        ) : null}

        {activeTab === 'editor' ? (
          <SettingsTabPanel
            tabId="editor"
            heading="Editor"
            description="Tune note editing behavior for the main workspace editor."
          >
            <SettingsSection
              heading="Vim mode"
              headingId="settings-vim-mode-heading"
              description="Use modal keyboard controls in notes, including insert, normal, and visual modes with common Vim motions."
            >
              <SettingsRow
                label={
                  <span className="inline-flex items-center gap-2" data-testid="vim-mode-setting">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                      <img
                        src={vimLogo}
                        alt=""
                        aria-hidden="true"
                        data-testid="vim-mode-setting-icon"
                        className="h-4 w-4 shrink-0"
                      />
                    </span>
                    <span>Enable Vim mode</span>
                  </span>
                }
                labelId="settings-vim-mode-label"
                description="Disabled by default. Press Escape in the note editor to enter normal mode."
                valueClassName="items-center"
              >
                <Switch
                  checked={editorVimModeEnabled}
                  onCheckedChange={onToggleEditorVimMode}
                  aria-labelledby="settings-vim-mode-label"
                />
              </SettingsRow>
            </SettingsSection>

            <SettingsSection
              heading="Vim key mappings"
              headingId="settings-vim-mappings-heading"
              description="Add short key sequences such as ij to run core Vim mode actions."
              actions={
                <Button type="button" variant="outline" onClick={addVimMapping}>
                  Add mapping
                </Button>
              }
            >
              <SettingsRow
                label="Custom mappings"
                description={
                  hasMappingErrors
                    ? 'Fix mapping errors to save changes. Valid sequences use 1-8 printable characters.'
                    : 'Custom mappings override built-in Vim keys when the same sequence is used.'
                }
                valueClassName="min-w-0"
              >
                {vimMappingDrafts.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border bg-card px-3 py-3 text-sm text-muted-foreground">
                    No custom mappings yet. Add one like insert / ij / Enter normal mode.
                  </p>
                ) : (
                  <div className="grid min-w-0 gap-2">
                    {vimMappingDrafts.map((mapping) => {
                      const rowErrors = mappingErrors[mapping.id] ?? []
                      const rowErrorId = `vim-mapping-error-${mapping.id}`

                      return (
                        <div
                          key={mapping.id}
                          className="grid min-w-0 gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-[minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(11rem,1.4fr)_auto]"
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
                                'aria-describedby': rowErrors.length ? rowErrorId : undefined,
                                className: 'w-full rounded-md'
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
                              className="font-mono"
                              value={mapping.sequence}
                              maxLength={8}
                              placeholder="ij"
                              onChange={(event) =>
                                updateVimMapping(mapping.id, { sequence: event.target.value })
                              }
                              aria-describedby={rowErrors.length ? rowErrorId : undefined}
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
                                'aria-describedby': rowErrors.length ? rowErrorId : undefined,
                                className: 'w-full rounded-md'
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
                            <p
                              id={rowErrorId}
                              className="text-xs text-destructive md:col-span-4"
                              role="alert"
                            >
                              {rowErrors.join(' ')}
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </SettingsRow>
            </SettingsSection>
          </SettingsTabPanel>
        ) : null}

        {activeTab === 'agent' ? (
          <SettingsTabPanel
            tabId="agent"
            heading="Agent"
            description="Connect your AI provider for command palette completion and agent workflows."
          >
            <SettingsSection
              heading="Provider credentials"
              headingId="settings-agent-credentials-heading"
            >
              <SettingsRow
                label="Mistral API key"
                description="Stored in the device credential store for this vault. The key is never written into vault files or exports."
                htmlFor="settings-mistral-api-key"
                valueClassName="max-w-2xl"
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
              </SettingsRow>
            </SettingsSection>
          </SettingsTabPanel>
        ) : null}

        {activeTab === 'developer' ? (
          <SettingsTabPanel
            tabId="developer"
            heading="Developer"
            description="Configure developer tools and the runtime used by Python automations."
          >
            <SettingsSection
              heading="Python runtime"
              headingId="settings-python-runtime-heading"
              description="Choose the Conda environment used by all Python automations. System Python is the default, and Conda can be discovered automatically or selected explicitly."
            >
              <SettingsRow
                label="Conda executable"
                description="Automatic discovery checks the app PATH and common installation locations."
                valueClassName="max-w-2xl"
              >
                <div
                  className="break-all rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
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
              </SettingsRow>

              <SettingsRow
                label="Python environment"
                description="The selected environment must remain available when an automation runs."
                valueClassName="max-w-2xl"
              >
                <div className="flex min-w-0 flex-wrap items-start gap-2">
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
                      className: 'min-w-0 flex-1 rounded-md sm:min-w-64'
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
              </SettingsRow>
            </SettingsSection>

            <SettingsSection
              heading="Design Audit"
              headingId="settings-design-audit-heading"
              description="Review the live visual language and interactive component specimens."
            >
              <SettingsRow label="Component specimens">
                <Button
                  type="button"
                  data-testid="settings-open-design-audit"
                  variant="outline"
                  size="sm"
                  onClick={onOpenDesignAudit}
                >
                  Open Design Audit
                </Button>
              </SettingsRow>
            </SettingsSection>
          </SettingsTabPanel>
        ) : null}
      </WorkspaceReadingWidth>
    </WorkspacePageLayout>
  )
}
