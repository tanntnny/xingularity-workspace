import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-code-style-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notes', 'alpha.md'),
    serializeStoredNoteDocument(
      createStoredNoteDocumentFromText(
        '```ts\nconst value = 42\n```\n\n| Name | Value |\n| --- | --- |\n| alpha | 42 |\n'
      )
    ),
    'utf-8'
  )
  return rootPath
}

test('renders fenced code blocks with a transparent background and visible border', async () => {
  const vaultRoot = await createFixtureVault()
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-code-style-user-'))
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )

  const electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${userDataPath}`],
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' }
  })

  try {
    const actualUserDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    const userDataPathMismatch = actualUserDataPath !== userDataPath
    if (userDataPathMismatch) {
      await fs.mkdir(actualUserDataPath, { recursive: true })
      await fs.writeFile(
        path.join(actualUserDataPath, 'settings.json'),
        JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
        'utf-8'
      )
    }

    const page = await electronApp.firstWindow()
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForLoadState('domcontentloaded')
    if (userDataPathMismatch) {
      await page.reload({ waitUntil: 'domcontentloaded' })
    }
    await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
    await expect
      .poll(
        async () => {
          try {
            await page.evaluate(() => window.vaultApi.vault.restoreLast())
          } catch {
            // Retry until the fixture vault is available to the renderer.
          }

          return await page.evaluate(() => {
            const button = document.querySelector<HTMLButtonElement>(
              '[data-testid="sidebar-page:notes"]'
            )

            if (!button) {
              return 'missing'
            }

            return button.disabled ? 'disabled' : 'enabled'
          })
        },
        { timeout: 60_000 }
      )
      .toBe('enabled')
    await page.getByTestId('sidebar-page:notes').click()
    await page.getByTestId('note-tree-row:alpha.md').click()

    const codeBlock = page
      .getByTestId('note-block-editor')
      .locator('.ProseMirror pre[data-language]')
      .first()
    await expect(codeBlock).toBeVisible({ timeout: 20_000 })

    const styles = await codeBlock.evaluate((element) => {
      const code = element.querySelector('code')
      const computed = getComputedStyle(element)
      const codeComputed = code ? getComputedStyle(code) : null

      return {
        backgroundColor: computed.backgroundColor,
        borderTopColor: computed.borderTopColor,
        borderTopStyle: computed.borderTopStyle,
        borderTopWidth: computed.borderTopWidth,
        borderTopLeftRadius: computed.borderTopLeftRadius,
        codeBackgroundColor: codeComputed?.backgroundColor ?? null,
        codeFontFamily: codeComputed?.fontFamily ?? null
      }
    })

    expect(styles).toMatchObject({
      backgroundColor: 'rgba(0, 0, 0, 0)',
      borderTopStyle: 'solid',
      borderTopWidth: '1px',
      codeBackgroundColor: 'rgba(0, 0, 0, 0)'
    })
    expect(styles.borderTopColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(styles.codeFontFamily).toContain('JetBrains Mono')

    const tableBlock = page
      .getByTestId('note-block-editor')
      .locator('.ProseMirror .milkdown-table-block')
      .first()
    await expect(tableBlock).toHaveCount(1, { timeout: 20_000 })

    const tableBlockStyles = await tableBlock.evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        borderTopColor: computed.borderTopColor,
        borderTopStyle: computed.borderTopStyle,
        borderTopWidth: computed.borderTopWidth,
        borderTopLeftRadius: computed.borderTopLeftRadius
      }
    })

    expect(tableBlockStyles.borderTopColor).toBe(styles.borderTopColor)
    expect(tableBlockStyles.borderTopStyle).toBe('solid')
    expect(tableBlockStyles.borderTopWidth).toBe('1px')
    expect(tableBlockStyles.borderTopLeftRadius).toBe(styles.borderTopLeftRadius)

    const table = page
      .getByTestId('note-block-editor')
      .locator('.ProseMirror .milkdown-table-block table')
      .first()
    await expect(table).toHaveCount(1, { timeout: 20_000 })

    const tableStyles = await table.evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        borderTopColor: computed.borderTopColor,
        borderTopLeftRadius: computed.borderTopLeftRadius
      }
    })

    expect(tableStyles.borderTopColor).toBe(styles.borderTopColor)
    expect(tableStyles.borderTopLeftRadius).toBe(styles.borderTopLeftRadius)
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
    await fs.rm(userDataPath, { recursive: true, force: true })
  }
})
