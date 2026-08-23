import { test, expect, type Locator, type Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'

declare global {
  interface Window {
    vaultApi: {
      vault: {
        restoreLast: () => Promise<unknown>
      }
    }
  }
}

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-export-submenu-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notebooks', 'archive'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notebooks', 'archive', 'nested.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Nested note\n')),
    'utf-8'
  )
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
  userDataPath: string
}> {
  const userDataPath = await fs.mkdtemp(
    path.join(os.tmpdir(), 'xingularity-export-submenu-e2e-user-')
  )
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )

  const electronApp = await electron.launch({
    args: [`--user-data-dir=${userDataPath}`, '.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1'
    }
  })

  try {
    const actualUserDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    if (actualUserDataPath !== userDataPath) {
      await fs.mkdir(actualUserDataPath, { recursive: true })
      await fs.writeFile(
        path.join(actualUserDataPath, 'settings.json'),
        JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
        'utf-8'
      )
    }

    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')

    const notesPageButton = page.getByTestId('sidebar-page:notes')
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            try {
              await window.vaultApi.vault.restoreLast()
            } catch {
              // Retry while the temporary fixture vault is being initialized.
            }

            const button = document.querySelector<HTMLButtonElement>(
              '[data-testid="sidebar-page:notes"]'
            )

            if (!button) {
              return 'missing'
            }

            return button.disabled ? 'disabled' : 'enabled'
          }),
        { timeout: 60_000 }
      )
      .toBe('enabled')

    await expect(notesPageButton).toBeVisible({ timeout: 20_000 })
    await expect(notesPageButton).toBeEnabled({ timeout: 20_000 })
    await notesPageButton.click()
    await expect(page.getByTestId('notes-tree-view')).toBeVisible({ timeout: 20_000 })

    return { electronApp, page, userDataPath }
  } catch (error) {
    await electronApp.close().catch(() => undefined)
    await fs.rm(userDataPath, { recursive: true, force: true })
    throw error
  }
}

async function expectMenuItemOnTop(
  page: Page,
  locator: ReturnType<Page['getByTestId']>
): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  if (!box) {
    return
  }

  const expectedTestId = await locator.getAttribute('data-testid')
  const hitTest = await page.evaluate(
    ({ x, y, expectedTestId }) => {
      const element = document.elementFromPoint(x, y)
      const target = document.querySelector<HTMLElement>(
        `[data-testid="${CSS.escape(expectedTestId)}"]`
      )
      const targetStyles = target ? getComputedStyle(target) : null
      const targetRect = target?.getBoundingClientRect() ?? null
      const ancestorChain: Array<Record<string, string | null>> = []
      let ancestor: HTMLElement | null = target
      while (ancestor && ancestorChain.length < 8) {
        const styles = getComputedStyle(ancestor)
        ancestorChain.push({
          tag: ancestor.tagName,
          testId: ancestor.getAttribute('data-testid'),
          className: ancestor.getAttribute('class'),
          dataState: ancestor.getAttribute('data-state'),
          position: styles.position,
          zIndex: styles.zIndex,
          pointerEvents: styles.pointerEvents,
          transform: styles.transform
        })
        ancestor = ancestor.parentElement
      }
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
        target: target
          ? {
              dataState: target.getAttribute('data-state'),
              rect: targetRect
                ? {
                    x: targetRect.x,
                    y: targetRect.y,
                    width: targetRect.width,
                    height: targetRect.height
                  }
                : null,
              display: targetStyles?.display,
              visibility: targetStyles?.visibility,
              opacity: targetStyles?.opacity,
              pointerEvents: targetStyles?.pointerEvents,
              position: targetStyles?.position,
              zIndex: targetStyles?.zIndex,
              ancestorChain
            }
          : null,
        element: element
          ? {
              tag: element.tagName,
              testId: element.closest<HTMLElement>('[role="menuitem"]')?.dataset.testid ?? null,
              className: element.getAttribute('class')
            }
          : null,
        stack: document
          .elementsFromPoint(x, y)
          .slice(0, 5)
          .map((item) => ({
            tag: item.tagName,
            testId: item.closest<HTMLElement>('[role="menuitem"]')?.dataset.testid ?? null,
            className: item.getAttribute('class')
          }))
      }
    },
    {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      expectedTestId
    }
  )

  expect(hitTest.element?.testId, JSON.stringify({ box, hitTest })).toBe(expectedTestId)
}

async function expectMenuItemsToHighlightOnHover(page: Page, menu: Locator): Promise<void> {
  const items = menu.locator('[role="menuitem"]:visible:not([data-disabled="true"])')
  const count = await items.count()
  expect(count).toBeGreaterThan(0)

  for (let index = 0; index < count; index += 1) {
    const item = items.nth(index)
    const before = await item.evaluate((element) => getComputedStyle(element).backgroundColor)
    await item.hover()
    await expect
      .poll(async () => item.evaluate((element) => getComputedStyle(element).backgroundColor), {
        timeout: 2_000
      })
      .not.toBe(before)
  }
}

async function expectVisibleMenuLayersToHighlightOnHover(page: Page): Promise<void> {
  const menus = page.locator('[role="menu"]:visible')
  let checkedMenuCount = 0
  const count = await menus.count()
  expect(count).toBeGreaterThan(0)

  for (let index = 0; index < count; index += 1) {
    const menu = menus.nth(index)
    const items = menu.locator('[role="menuitem"]:visible:not([data-disabled="true"])')

    if ((await items.count()) === 0) {
      continue
    }

    await expectMenuItemsToHighlightOnHover(page, menu)
    checkedMenuCount += 1
  }

  expect(checkedMenuCount).toBeGreaterThan(0)
}

test('highlights every folder context-menu option on hover', async () => {
  const vaultRoot = await createFixtureVault()
  const { electronApp, page, userDataPath } = await launchWithFixture(vaultRoot)

  try {
    const archiveRow = page.getByTestId('note-tree-row:archive')
    await expect(archiveRow).toBeVisible({ timeout: 20_000 })

    await archiveRow.hover()
    await page.getByTestId('note-tree-menu:archive').click()

    const dropdownParent = page.getByTestId('note-tree-export-folder-dropdown:archive')
    const dropdownPdf = page.getByTestId('note-tree-export-folder-pdf-dropdown:archive')
    const dropdownMarkdown = page.getByTestId('note-tree-export-folder-markdown-dropdown:archive')
    await expect(dropdownParent).toBeVisible()
    await expect(dropdownPdf).not.toBeVisible()
    await expect(dropdownMarkdown).not.toBeVisible()

    await expectVisibleMenuLayersToHighlightOnHover(page)
    await dropdownParent.hover()
    await expect(dropdownParent).toHaveAttribute('data-state', 'open')
    await expect(dropdownPdf).toBeVisible()
    await expect(dropdownMarkdown).toBeVisible()
    await expectMenuItemOnTop(page, dropdownPdf)
    await expectMenuItemOnTop(page, dropdownMarkdown)
    await expectMenuItemsToHighlightOnHover(page, page.locator('[role="menu"]:visible').last())

    await page.keyboard.press('Escape')
    await archiveRow.click({ button: 'right' })

    const contextParent = page.getByTestId('note-tree-export-folder-context:archive')
    const contextPdf = page.getByTestId('note-tree-export-folder-pdf-context:archive')
    const contextMarkdown = page.getByTestId('note-tree-export-folder-markdown-context:archive')
    await expect(contextParent).toBeVisible()
    await expect(contextPdf).not.toBeVisible()
    await expect(contextMarkdown).not.toBeVisible()

    await expectVisibleMenuLayersToHighlightOnHover(page)
    await contextParent.hover()
    await expect(contextParent).toHaveAttribute('data-state', 'open')
    await expect(contextPdf).toBeVisible()
    await expect(contextMarkdown).toBeVisible()
    await expectMenuItemOnTop(page, contextPdf)
    await expectMenuItemOnTop(page, contextMarkdown)
    await expectMenuItemsToHighlightOnHover(page, page.locator('[role="menu"]:visible').last())
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
    await fs.rm(userDataPath, { recursive: true, force: true })
  }
})
