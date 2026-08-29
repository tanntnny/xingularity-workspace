import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AppPage } from '../src/renderer/src/navigation'
import { APP_PAGE_ICONS, VaultIcon } from '../src/renderer/src/lib/pageIcons'

const expectedIconClasses: Record<AppPage, string> = {
  capture: 'mail',
  knowledge: 'chart-dots-3',
  notes: 'files',
  projects: 'box',
  resources: 'table',
  subscriptions: 'brand-mastercard',
  calendar: 'calendar-event',
  schedules: 'bolt',
  schedulingGuide: 'book-filled',
  designAudit: 'palette-filled',
  settings: 'settings-filled'
}

describe('shared page icon map', () => {
  it('keeps every app page on its canonical Tabler icon', () => {
    for (const [page, className] of Object.entries(expectedIconClasses) as Array<
      [AppPage, string]
    >) {
      const Icon = APP_PAGE_ICONS[page]
      const markup = renderToStaticMarkup(createElement(Icon, { 'aria-hidden': true }))

      expect(markup, page).toContain(`tabler-icon-${className}`)
    }
  })

  it('uses the project box icon for vault controls', () => {
    const markup = renderToStaticMarkup(createElement(VaultIcon, { 'aria-hidden': true }))

    expect(markup).toContain('tabler-icon-box')
  })
})
