import { expect, type Page } from '@playwright/test'

export async function expectSingleRightPanelScrollport(page: Page): Promise<void> {
  const rightPanel = page.getByTestId('workspace-right-panel')
  await expect(rightPanel).toBeVisible()

  const scrollports = rightPanel.locator('[data-workspace-scrollport="true"]')
  await expect(scrollports).toHaveCount(1)

  const scrollportStyles = await scrollports.evaluateAll((elements) =>
    elements.map((element) => {
      const node = element as HTMLElement
      return {
        className: node.className,
        scrollbarWidth: getComputedStyle(node).getPropertyValue('scrollbar-width').trim()
      }
    })
  )

  expect(scrollportStyles.every(({ className }) => !className.includes('scrollbar-none'))).toBe(
    true
  )
  expect(scrollportStyles.every(({ scrollbarWidth }) => scrollbarWidth !== 'none')).toBe(true)

  const nestedScrollableElements = await rightPanel.evaluate((element) =>
    Array.from(element.querySelectorAll<HTMLElement>('*'))
      .filter((candidate) => !candidate.matches('[data-workspace-scrollport="true"]'))
      .filter((candidate) => /(auto|scroll)/.test(getComputedStyle(candidate).overflowY))
      .filter((candidate) => candidate.scrollHeight > candidate.clientHeight + 1)
      .map((candidate) => candidate.dataset.testid ?? candidate.tagName.toLowerCase())
  )

  expect(nestedScrollableElements).toEqual([])
}
