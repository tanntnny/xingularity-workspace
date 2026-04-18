import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

declare global {
  interface Window {
    vaultApi: {
      vault: {
        restoreLast: () => Promise<unknown>
      }
    }
  }
}

function getSubscriptionsPath(vaultRoot: string): string {
  return path.join(vaultRoot, '.xingularity', 'subscriptions.json')
}

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-subscriptions-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1'
    }
  })

  const userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  await fs.mkdir(userDataPath, { recursive: true })
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => window.vaultApi.vault.restoreLast())
  await expect(page.getByTestId('sidebar-page:subscriptions')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('sidebar-page:subscriptions')).toBeEnabled({ timeout: 20_000 })

  return { electronApp, page }
}

test.describe('subscriptions page', () => {
  test('can be opened from Finance, created from the table row, edited in the drawer, and persists after relaunch', async () => {
    const vaultRoot = await createFixtureVault()
    let electronApp: ElectronApplication | null = null

    try {
      ;({ electronApp } = await launchWithFixture(vaultRoot))
      const page = await electronApp.firstWindow()

      await page.getByRole('button', { name: 'Open command palette' }).click()
      await page.getByPlaceholder('Search notes and projects...').fill('>subscriptions')
      await expect(page.getByText('Go to Subscriptions')).toBeVisible()
      await page.keyboard.press('Escape')

      await page.getByTestId('sidebar-page:subscriptions').click()
      await expect(page.getByTestId('subscriptions-page')).toBeVisible()

      await page.getByRole('button', { name: '+ New subscription' }).click()
      await page.getByLabel('Name').fill('ChatGPT Plus')
      await page.getByLabel('Provider').fill('OpenAI')
      await page.getByRole('textbox', { name: 'Category' }).fill('AI Tools')
      await page.getByLabel('Amount').fill('20')
      await page.getByLabel('Next renewal').fill('2026-04-18')
      await page.getByLabel('Tags').fill('ai, assistant')
      await page.getByRole('button', { name: 'Add subscription' }).last().click()

      await expect
        .poll(async () => {
          const raw = await fs.readFile(getSubscriptionsPath(vaultRoot), 'utf-8')
          return JSON.parse(raw) as Array<{
            name: string
            currency: string
            normalizedMonthlyAmount: number
          }>
        })
        .toEqual([
          expect.objectContaining({
            name: 'ChatGPT Plus',
            currency: 'THB',
            normalizedMonthlyAmount: 20
          })
        ])

      await expect(page.getByRole('table').getByText('ChatGPT Plus')).toBeVisible()
      await expect(page.getByRole('table').getByText('AI Tools')).toBeVisible()

      await page.getByLabel('Edit ChatGPT Plus').click()
      await page.getByLabel('Billing cycle').selectOption('yearly')
      await page.getByLabel('Amount').fill('240')
      await page.getByRole('button', { name: 'Save changes' }).click()

      await expect
        .poll(async () => {
          const raw = await fs.readFile(getSubscriptionsPath(vaultRoot), 'utf-8')
          return JSON.parse(raw) as Array<{
            name: string
            billingCycle: string
            currency: string
            amount: number
            normalizedMonthlyAmount: number
          }>
        })
        .toEqual([
          expect.objectContaining({
            name: 'ChatGPT Plus',
            billingCycle: 'yearly',
            currency: 'THB',
            amount: 240,
            normalizedMonthlyAmount: 20
          })
        ])

      await electronApp.close()
      electronApp = null
      ;({ electronApp } = await launchWithFixture(vaultRoot))
      const relaunchedPage = await electronApp.firstWindow()
      await relaunchedPage.getByTestId('sidebar-page:subscriptions').click()
      await expect(relaunchedPage.getByTestId('subscriptions-page')).toBeVisible()
      await expect(relaunchedPage.getByRole('table').getByText('ChatGPT Plus')).toBeVisible()
    } finally {
      if (electronApp) {
        await electronApp.close()
      }
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
