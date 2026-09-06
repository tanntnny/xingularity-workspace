import { describe, expect, it } from 'vitest'
import type { AppPlatform } from '../src/renderer/src/platform'
import { getAvailablePages, isPageAvailable } from '../src/renderer/src/platform/pageAvailability'

const capabilities: AppPlatform['capabilities'] = {
  supportsManagedWorkspace: true,
  supportsNativeMenus: true,
  supportsVaultPicker: true,
  supportsDesktopImport: true,
  supportsDesktopAutomation: true,
  supportsAgentChat: true,
  supportsKnowledgeGraph: true,
  supportsSubscriptions: true
}

describe('Scheduling page availability', () => {
  it('exposes Scheduling on desktop', () => {
    const desktop: AppPlatform = { kind: 'desktop', capabilities }
    const pages = getAvailablePages(desktop)

    expect(pages).toContain('schedules')
    expect(pages).toContain('schedulingGuide')
    expect(isPageAvailable(desktop, 'schedules')).toBe(true)
    expect(isPageAvailable(desktop, 'schedulingGuide')).toBe(true)
  })

  it('keeps Scheduling desktop-only', () => {
    const mobile: AppPlatform = { kind: 'mobile', capabilities }
    const web: AppPlatform = { kind: 'web', capabilities }

    expect(getAvailablePages(mobile)).not.toContain('schedules')
    expect(getAvailablePages(mobile)).not.toContain('schedulingGuide')
    expect(getAvailablePages(web)).not.toContain('schedules')
    expect(getAvailablePages(web)).not.toContain('schedulingGuide')
    expect(isPageAvailable(mobile, 'schedules')).toBe(false)
  })

  it('exposes Tasks on every supported workspace platform', () => {
    for (const kind of ['desktop', 'mobile', 'web'] as const) {
      const platform: AppPlatform = { kind, capabilities }

      expect(getAvailablePages(platform)).toContain('tasks')
      expect(isPageAvailable(platform, 'tasks')).toBe(true)
    }
  })
})
