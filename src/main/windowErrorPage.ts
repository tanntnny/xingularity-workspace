import type { AppErrorEvent } from '../shared/types'
import { formatAppErrorDetails, formatAppErrorSource } from '../shared/appErrors'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

export function createWindowErrorPageHtml(error: AppErrorEvent): string {
  const details = formatAppErrorDetails(error)
  const serializedDetails = serializeForInlineScript(details)
  const sourceLabel = formatAppErrorSource(error.source)
  const channelMarkup = error.channel
    ? `<span class="chip chip-mono">${escapeHtml(error.channel)}</span>`
    : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Xingularity Error</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #0b1018;
        --panel: rgba(15, 23, 42, 0.9);
        --panel-2: rgba(15, 23, 42, 0.72);
        --line: rgba(148, 163, 184, 0.24);
        --text: #f8fafc;
        --muted: #cbd5e1;
        --accent: #38bdf8;
        --danger: #f87171;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family:
          Iowan Old Style, Palatino Linotype, Book Antiqua, Palatino, serif;
        background:
          radial-gradient(circle at top, rgba(248, 113, 113, 0.16), transparent 34%),
          linear-gradient(180deg, #020617 0%, #0f172a 100%);
        color: var(--text);
      }

      .shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
      }

      .panel {
        width: min(960px, 100%);
        border-radius: 8px;
        border: 1px solid rgba(248, 113, 113, 0.34);
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.84));
        box-shadow: 0 32px 120px rgba(2, 6, 23, 0.48);
        overflow: hidden;
      }

      .hero {
        padding: 32px;
        background: linear-gradient(135deg, rgba(248, 113, 113, 0.14), transparent 60%);
      }

      .badge, .chip {
        display: inline-flex;
        align-items: center;
        border-radius: 8px;
        border: 1px solid var(--line);
        padding: 7px 12px;
      }

      .badge {
        margin-bottom: 16px;
        border-color: rgba(248, 113, 113, 0.4);
        background: rgba(248, 113, 113, 0.12);
        color: #fecaca;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.24em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0 0 8px;
        font-size: clamp(32px, 6vw, 42px);
        line-height: 1.02;
      }

      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
      }

      .content {
        display: grid;
        gap: 20px;
        padding: 0 32px 32px;
      }

      .summary, pre {
        border-radius: 8px;
        border: 1px solid var(--line);
        background: var(--panel-2);
      }

      .summary {
        display: grid;
        gap: 14px;
        padding: 20px;
      }

      .summary p {
        color: var(--text);
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .chip-mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      button {
        appearance: none;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
        padding: 12px 18px;
        font: inherit;
      }

      .primary {
        background: var(--accent);
        color: #082f49;
        font-weight: 700;
      }

      .secondary {
        background: rgba(15, 23, 42, 0.9);
        color: var(--text);
        border: 1px solid var(--line);
      }

      pre {
        margin: 0;
        max-height: 52vh;
        overflow: auto;
        padding: 20px;
        font-size: 12px;
        line-height: 1.7;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="panel">
        <div class="hero">
          <div class="badge">Fatal Application Error</div>
          <h1>Xingularity could not continue.</h1>
          <p>The app hit a blocking failure before the normal workspace could recover.</p>
        </div>
        <div class="content">
          <div class="summary">
            <div class="chips">
              <span class="chip">${escapeHtml(sourceLabel)}</span>
              ${channelMarkup}
            </div>
            <p>${escapeHtml(error.message)}</p>
            <div class="actions">
              <button type="button" class="primary" id="reload-app">Reload app</button>
              <button type="button" class="secondary" id="copy-details">Copy details</button>
            </div>
          </div>
          <pre>${escapeHtml(details)}</pre>
        </div>
      </section>
    </main>
    <script>
      const errorDetails = ${serializedDetails}
      const reloadButton = document.getElementById('reload-app')
      const copyButton = document.getElementById('copy-details')

      reloadButton?.addEventListener('click', () => {
        window.vaultApi?.ui?.reloadApp?.()
      })

      copyButton?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(errorDetails)
          copyButton.textContent = 'Copied'
        } catch {
          copyButton.textContent = 'Copy failed'
        }
      })
    </script>
  </body>
</html>`
}
