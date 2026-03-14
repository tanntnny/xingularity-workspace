import { ReactElement, KeyboardEvent, useEffect, useState } from 'react'

export interface FontOption {
  label: string
  value: string
}

interface SettingsPageProps {
  profileName: string
  fontOptions: FontOption[]
  selectedFontFamily: string
  vaultLocation: string | null
  onSaveProfile: (name: string) => void
  onSelectFont: (fontFamily: string) => void
  onChangeVaultLocation: () => void
}

export function SettingsPage({
  profileName,
  fontOptions,
  selectedFontFamily,
  vaultLocation,
  onSaveProfile,
  onSelectFont,
  onChangeVaultLocation
}: SettingsPageProps): ReactElement {
  const [profileDraft, setProfileDraft] = useState(profileName)

  useEffect(() => {
    setProfileDraft(profileName)
  }, [profileName])

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

  return (
    <section className="grid gap-3.5 p-5" aria-label="App settings">
      <h2 className="text-2xl font-bold">Settings</h2>
      <p className="max-w-[56ch] text-sm text-[var(--muted)]">
        Update your profile and choose your preferred app appearance.
      </p>

      <div className="grid max-w-[360px] gap-1.5" aria-label="Profile settings">
        <span className="text-sm text-[var(--muted)]">Profile Name</span>
        <input
          type="text"
          maxLength={100}
          value={profileDraft}
          placeholder="Your name"
          onChange={(event) => setProfileDraft(event.target.value)}
          onBlur={commitProfileName}
          onKeyDown={onProfileInputKeyDown}
          className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2.5"
        />
        <span className="text-xs text-[var(--muted)]">Press Enter or click away to save.</span>
      </div>

      <label className="grid max-w-[360px] gap-1.5" htmlFor="font-family-select">
        <span className="text-sm text-[var(--muted)]">App Font</span>
        <select
          id="font-family-select"
          className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2.5"
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

      <div className="grid max-w-[360px] gap-1.5" aria-label="Vault location">
        <span className="text-sm text-[var(--muted)]">Vault Location</span>
        <div className="break-words rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2.5 text-sm text-[var(--text)]">
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

      <p
        className="max-w-[560px] rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5"
        style={{ fontFamily: selectedFontFamily }}
      >
        The quick brown fox jumps over the lazy dog.
      </p>
    </section>
  )
}
