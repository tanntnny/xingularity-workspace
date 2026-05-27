import type { AppPage } from '../navigation'
import type { AppPlatform } from './index'

const CORE_MOBILE_PAGES: AppPage[] = ['notes', 'projects', 'calendar', 'settings']

export function getAvailablePages(platform: AppPlatform): AppPage[] {
  if (platform.kind === 'desktop') {
    return [
      'dashboard',
      'knowledge',
      'notes',
      'projects',
      'subscriptions',
      'weeklyPlan',
      'calendar',
      'settings',
      'schedules',
      'scheduleDocs',
      'agentHistory',
      'generativeUi'
    ]
  }

  const pages = [...CORE_MOBILE_PAGES]

  if (platform.capabilities.supportsWeeklyPlan) {
    pages.splice(3, 0, 'weeklyPlan')
  }

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
