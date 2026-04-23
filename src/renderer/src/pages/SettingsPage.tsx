import { ReactElement, KeyboardEvent, useEffect, useState } from 'react'
import { TabMenu, TabMenuItem } from '../components/ui/tab-menu'

export interface FontOption {
  label: string
  value: string
}

interface SettingsPageProps {
  profileName: string
  mistralApiKey: string
  fontOptions: FontOption[]
  selectedFontFamily: string
  workspaceVibrancyEnabled: boolean
  vaultLocation: string | null
  onSaveProfile: (name: string) => void
  onSaveMistralApiKey: (apiKey: string) => void
  onSelectFont: (fontFamily: string) => void
  onToggleWorkspaceVibrancy: (enabled: boolean) => void
  onChangeVaultLocation: () => void
  onMigrateBlockNoteNotes: () => void
  onMigrateTaggedNoteBodyFrontmatter: () => void
}

export function SettingsPage({
  profileName,
  mistralApiKey,
  fontOptions,
  selectedFontFamily,
  workspaceVibrancyEnabled,
  vaultLocation,
  onSaveProfile,
  onSaveMistralApiKey,
  onSelectFont,
  onToggleWorkspaceVibrancy,
  onChangeVaultLocation,
  onMigrateBlockNoteNotes,
  onMigrateTaggedNoteBodyFrontmatter
}: SettingsPageProps): ReactElement {
  const [profileDraft, setProfileDraft] = useState(profileName)
  const [mistralApiKeyDraft, setMistralApiKeyDraft] = useState(mistralApiKey)
  const [activeTab, setActiveTab] = useState<'profile' | 'workspace' | 'appearance' | 'agent'>(
    'profile'
  )

  useEffect(() => {
    setProfileDraft(profileName)
  }, [profileName])

  useEffect(() => {
    setMistralApiKeyDraft(mistralApiKey)
  }, [mistralApiKey])

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

  return (
    <section className="grid gap-3.5 p-5" aria-label="App settings">
      <h2 className="text-2xl font-bold">Settings</h2>
      <p className="max-w-[56ch] text-sm text-[var(--muted)]">
        Manage your identity, workspace storage, appearance, and AI connection settings.
      </p>

      <TabMenu
        className="settings-tab-menu"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <TabMenuItem className="settings-tab-menu-item" value="profile">
          Profile
        </TabMenuItem>
        <TabMenuItem className="settings-tab-menu-item" value="workspace">
          Workspace
        </TabMenuItem>
        <TabMenuItem className="settings-tab-menu-item" value="appearance">
          Appearance
        </TabMenuItem>
        <TabMenuItem className="settings-tab-menu-item" value="agent">
          Agent
        </TabMenuItem>
      </TabMenu>

      {activeTab === 'profile' ? (
        <div className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
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
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2.5"
            />
            <span className="text-xs text-[var(--muted)]">Press Enter or click away to save.</span>
          </div>
        </div>
      ) : null}

      {activeTab === 'workspace' ? (
        <div className="grid gap-5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-[var(--text)]">Workspace</h3>
            <p className="w-full text-sm text-[var(--muted)]">
              Review where your local vault lives and change it when you want to work from a
              different folder.
            </p>
          </div>

          <div className="grid w-full gap-1.5" aria-label="Vault location">
            <span className="text-sm text-[var(--muted)]">Vault Location</span>
            <div className="w-full break-words rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2.5 text-sm text-[var(--text)]">
              {vaultLocation ?? 'No vault selected yet. Open or create a vault to set a location.'}
            </div>
            <button
              type="button"
              className="w-fit rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 hover:border-[var(--accent)]"
              onClick={onChangeVaultLocation}
            >
              Change Vault Location
            </button>
          </div>

          <div className="grid w-full gap-1.5" aria-label="Note migration">
            <span className="text-sm text-[var(--muted)]">Old Note Conversion</span>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Convert old BlockNote JSON note files into normal markdown in your vault.
            </p>
            <button
              type="button"
              className="w-fit rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 hover:border-[var(--accent)]"
              onClick={onMigrateBlockNoteNotes}
            >
              Convert old BlockNote notes
            </button>
            <button
              type="button"
              className="w-fit rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 hover:border-[var(--accent)]"
              onClick={onMigrateTaggedNoteBodyFrontmatter}
            >
              Normalize tagged note bodies
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'appearance' ? (
        <div className="grid gap-5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-[var(--text)]">Appearance</h3>
            <p className="max-w-[56ch] text-sm text-[var(--muted)]">
              Tune how the app reads with font and surface controls for the main workspace.
            </p>
          </div>

          <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
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
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors ${
                  workspaceVibrancyEnabled
                    ? 'border-[var(--accent-line)] bg-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--panel)]'
                }`}
                onClick={() => onToggleWorkspaceVibrancy(!workspaceVibrancyEnabled)}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow-[0_8px_18px_rgba(15,23,42,0.22)] transition-transform ${
                    workspaceVibrancyEnabled ? 'translate-x-[1.45rem]' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Keeps the global sidebar glassy and extends the effect through the workspace shell.
            </p>
          </div>

          <label className="grid w-full gap-1.5" htmlFor="font-family-select">
            <span className="text-sm text-[var(--muted)]">App Font</span>
            <select
              id="font-family-select"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2.5"
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
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5"
            style={{ fontFamily: selectedFontFamily }}
          >
            The quick brown fox jumps over the lazy dog.
          </p>
        </div>
      ) : null}

      {activeTab === 'agent' ? (
        <div className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
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
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2.5"
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
