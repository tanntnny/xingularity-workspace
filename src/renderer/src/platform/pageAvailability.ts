import type { AppPage } from '../navigation'
import type { AppPlatform } from './index'

const CORE_MOBILE_PAGES: AppPage[] = [
  'capture',
  'notes',
  'projects',
  'tasks',
  'resources',
  'calendar',
  'settings'
]

export function getAvailablePages(platform: AppPlatform): AppPage[] {
  if (platform.kind === 'desktop') {
    return [
      'capture',
      'stickyNote',
      'knowledge',
      'notes',
      'projects',
      'tasks',
      'resources',
      'subscriptions',
      'calendar',
      'schedules',
      'schedulingGuide',
      'designAudit',
      'settings'
    ]
  }

  const pages = [...CORE_MOBILE_PAGES]

  if (platform.capabilities.supportsSubscriptions) {
    pages.splice(pages.length - 1, 0, 'subscriptions')
  }

  if (platform.capabilities.supportsKnowledgeGraph) {
    pages.unshift('knowledge')
  }

  return pages
}

export function isPageAvailable(platform: AppPlatform, page: AppPage): boolean {
  return getAvailablePages(platform).includes(page)
}

export function getFallbackPage(platform: AppPlatform): AppPage {
  const availablePages = getAvailablePages(platform)
  return availablePages[0] ?? 'notes'
}

export function normalizePageForPlatform(platform: AppPlatform, page: AppPage): AppPage {
  return isPageAvailable(platform, page) ? page : getFallbackPage(platform)
}
