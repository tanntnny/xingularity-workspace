import { ReactElement } from 'react'

export interface FontOption {
  label: string
  value: string
}

interface SettingsPageProps {
  fontOptions: FontOption[]
  selectedFontFamily: string
  vaultLocation: string | null
  onSelectFont: (fontFamily: string) => void
  onChangeVaultLocation: () => void
}

export function SettingsPage({
  fontOptions,
  selectedFontFamily,
  vaultLocation,
  onSelectFont,
  onChangeVaultLocation
}: SettingsPageProps): ReactElement {
  return (
    <section className="grid gap-3.5 p-5" aria-label="App settings">
      <h2 className="text-2xl font-bold">Settings</h2>
      <p className="max-w-[56ch] text-sm text-[var(--muted)]">
        Choose your preferred font and apply it across Beacon Vault.
      </p>

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
