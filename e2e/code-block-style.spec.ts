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
        'Inline `const value = 42` code\n\n```ts\nconst value = 42\n```\n\n| Name | Value |\n| --- | --- |\n| alpha | 42 |\n\n---\n\n> A consistent quote\n\n> [!INFO] Informational callout\n> Details\n\nBroken inline $2^{\n'
      )
    ),
    'utf-8'
  )
  return rootPath
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`renders major markdown blocks with the ${colorScheme} editor palette`, async () => {
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
      await page.waitForLoadState('domcontentloaded')
      if (userDataPathMismatch) {
        await page.reload({ waitUntil: 'domcontentloaded' })
      }
      await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
      await page.waitForFunction(
        () => typeof window.__XINGULARITY_E2E__?.getLastPageLeaveSaveDebug === 'function'
      )
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
      await page.emulateMedia({ colorScheme })

      const editorRoot = page.getByTestId('note-block-editor')
      const editor = editorRoot.locator('.milkdown').first()
      await expect(editor).toBeVisible({ timeout: 20_000 })

      const editorThemeStyles = await editor.evaluate((element) => {
        const resolveColor = (
          property: 'backgroundColor' | 'borderTopColor' | 'color',
          token: string
        ): string => {
          const probe = document.createElement('span')
          probe.style[property] = `var(${token})`
          element.append(probe)
          const value = getComputedStyle(probe)[property]
          probe.remove()
          return value
        }

        const paragraph = element.querySelector<HTMLElement>('.ProseMirror p')
        const toolbar = element.querySelector<HTMLElement>('.milkdown-toolbar')
        const toolbarIcon = toolbar?.querySelector<SVGElement>('.toolbar-item:not(.active) svg')
        const linkPreview = element.querySelector<HTMLElement>(
          '.milkdown-link-preview > .link-preview'
        )
        return {
          selectionBackground: paragraph
            ? getComputedStyle(paragraph, '::selection').backgroundColor
            : null,
          selectionColor: paragraph ? getComputedStyle(paragraph, '::selection').color : null,
          expectedSelectionBackground: resolveColor('backgroundColor', '--accent'),
          expectedSelectionColor: resolveColor('color', '--accent-foreground'),
          toolbarBackground: toolbar ? getComputedStyle(toolbar).backgroundColor : null,
          toolbarBorderColor: toolbar ? getComputedStyle(toolbar).borderTopColor : null,
          toolbarIconColor: toolbarIcon ? getComputedStyle(toolbarIcon).color : null,
          linkPreviewBackground: linkPreview ? getComputedStyle(linkPreview).backgroundColor : null,
          expectedSurface: resolveColor('backgroundColor', '--popover'),
          expectedPopupBorder: resolveColor('borderTopColor', '--note-editor-popup-border'),
          expectedMutedForeground: resolveColor('color', '--note-editor-muted-foreground')
        }
      })

      expect(editorThemeStyles.selectionBackground).toBe(
        editorThemeStyles.expectedSelectionBackground
      )
      expect(editorThemeStyles.selectionColor).toBe(editorThemeStyles.expectedSelectionColor)
      expect(editorThemeStyles.toolbarBackground).toBe(editorThemeStyles.expectedSurface)
      expect(editorThemeStyles.toolbarBorderColor).toBe(editorThemeStyles.expectedPopupBorder)
      expect(editorThemeStyles.toolbarIconColor).toBe(editorThemeStyles.expectedMutedForeground)
      expect(editorThemeStyles.linkPreviewBackground).toBe(editorThemeStyles.expectedSurface)

      const callout = editorRoot.locator('.note-callout-info').first()
      await expect(callout).toBeVisible({ timeout: 20_000 })
      await expect(editorRoot.locator('.note-inline-latex-error').first()).toBeVisible({
        timeout: 20_000
      })

      const calloutStyles = await callout.evaluate((element) => {
        const computed = getComputedStyle(element)
        return {
          backgroundColor: computed.backgroundColor,
          borderTopColor: computed.borderTopColor
        }
      })
      expect(calloutStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(calloutStyles.borderTopColor).not.toBe('rgba(0, 0, 0, 0)')

      const codeBlock = editorRoot.locator('.ProseMirror pre[data-language]').first()
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

      const inlineCode = editorRoot.locator('.ProseMirror p code').first()
      await expect(inlineCode).toBeVisible({ timeout: 20_000 })

      const inlineCodeStyles = await inlineCode.evaluate((element) => {
        const computed = getComputedStyle(element)
        return {
          backgroundColor: computed.backgroundColor,
          borderTopColor: computed.borderTopColor,
          borderTopStyle: computed.borderTopStyle,
          borderTopWidth: computed.borderTopWidth,
          color: computed.color,
          fontFamily: computed.fontFamily
        }
      })

      expect(inlineCodeStyles).toMatchObject({
        backgroundColor: colorScheme === 'dark' ? 'rgb(34, 34, 34)' : 'rgb(238, 238, 238)',
        borderTopColor: colorScheme === 'dark' ? 'rgb(74, 74, 74)' : 'rgb(199, 199, 199)',
        borderTopStyle: 'solid',
        borderTopWidth: '1px',
        color: colorScheme === 'dark' ? 'rgb(238, 238, 238)' : 'rgb(26, 26, 26)'
      })
      expect(inlineCodeStyles.fontFamily).toContain('JetBrains Mono')

      const tableBlock = editorRoot.locator('.ProseMirror .milkdown-table-block').first()
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

      const table = editorRoot.locator('.ProseMirror .milkdown-table-block table').first()
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

      const tableCellStyles = await tableBlock.evaluate((element) => {
        const cell = element.querySelector<HTMLElement>('th, td')
        if (!cell) {
          throw new Error(
            `Expected a rendered table cell. HTML: ${element.outerHTML.slice(0, 2000)}`
          )
        }

        return {
          borderTopColor: getComputedStyle(cell).borderTopColor
        }
      })
      expect(tableCellStyles.borderTopColor).toBe(styles.borderTopColor)

      const separator = editorRoot.locator('.ProseMirror hr').first()
      await expect(separator).toHaveCount(1, { timeout: 20_000 })
      await expect(separator).toHaveCSS('border-top-color', styles.borderTopColor)
      await expect(separator).toHaveCSS('border-top-style', 'solid')
      await expect(separator).toHaveCSS('border-top-width', '1px')

      const quote = editorRoot.locator('.ProseMirror blockquote').first()
      await expect(quote).toHaveCount(1, { timeout: 20_000 })
      const quoteAccentColors = await quote.evaluate((element) => {
        const probe = document.createElement('span')
        probe.style.backgroundColor = 'var(--border)'
        document.body.append(probe)
        const expected = getComputedStyle(probe).backgroundColor
        probe.remove()

        return {
          actual: getComputedStyle(element, '::before').backgroundColor,
          expected
        }
      })
      expect(quoteAccentColors.actual).toBe(quoteAccentColors.expected)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
      await fs.rm(userDataPath, { recursive: true, force: true })
    }
  })
}
