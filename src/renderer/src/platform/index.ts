import {
  createContext,
  createElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo
} from 'react'
import type { RendererVaultApi } from '../../../shared/types'

export type AppPlatformKind = 'desktop' | 'mobile' | 'web'

export interface AppPlatformCapabilities {
  supportsManagedWorkspace: boolean
  supportsNativeMenus: boolean
  supportsVaultPicker: boolean
  supportsDesktopImport: boolean
  supportsDesktopAutomation: boolean
  supportsAgentChat: boolean
  supportsGenerativeUi: boolean
  supportsKnowledgeGraph: boolean
  supportsSubscriptions: boolean
  supportsWeeklyPlan: boolean
}

export interface AppPlatform {
  kind: AppPlatformKind
  api?: RendererVaultApi
  capabilities: AppPlatformCapabilities
}

type WindowWithVaultApi = Window & { vaultApi?: RendererVaultApi }

const DESKTOP_CAPABILITIES: AppPlatformCapabilities = {
  supportsManagedWorkspace: true,
  supportsNativeMenus: true,
  supportsVaultPicker: true,
  supportsDesktopImport: true,
  supportsDesktopAutomation: true,
  supportsAgentChat: true,
  supportsGenerativeUi: true,
  supportsKnowledgeGraph: true,
  supportsSubscriptions: true,
  supportsWeeklyPlan: true
}

const MOBILE_CAPABILITIES: AppPlatformCapabilities = {
  supportsManagedWorkspace: false,
  supportsNativeMenus: false,
  supportsVaultPicker: false,
  supportsDesktopImport: false,
  supportsDesktopAutomation: false,
  supportsAgentChat: false,
  supportsGenerativeUi: false,
  supportsKnowledgeGraph: false,
  supportsSubscriptions: false,
  supportsWeeklyPlan: false
}

const FALLBACK_PLATFORM: AppPlatform = {
  kind: 'web',
  capabilities: MOBILE_CAPABILITIES
}

function getWindowTarget(target?: Window): Window | undefined {
  if (target) {
    return target
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  return window
}

function detectPlatformKind(target: Window): AppPlatformKind {
  const api = (target as WindowWithVaultApi).vaultApi
  if (api) {
    return 'desktop'
  }

  const userAgent = target.navigator.userAgent.toLowerCase()
  const isTouchDevice = target.navigator.maxTouchPoints > 1
  const isMobileUserAgent = /iphone|ipad|ipod|android/.test(userAgent)
  const prefersCompactLayout = target.matchMedia('(max-width: 1024px)').matches

  if (isMobileUserAgent || (isTouchDevice && prefersCompactLayout)) {
    return 'mobile'
  }

  return 'web'
}

export function getRendererVaultApi(target?: Window): RendererVaultApi | undefined {
  return (getWindowTarget(target) as WindowWithVaultApi | undefined)?.vaultApi
}

export function resolveAppPlatform(target?: Window): AppPlatform {
  const windowTarget = getWindowTarget(target)
  if (!windowTarget) {
    return FALLBACK_PLATFORM
  }

  const kind = detectPlatformKind(windowTarget)
  const api = getRendererVaultApi(windowTarget)

  if (kind === 'desktop' && api) {
    return {
      kind,
      api,
      capabilities: {
        ...DESKTOP_CAPABILITIES,
        supportsNativeMenus:
          api.ui.platform === 'darwin' && typeof api.ui.showNativeMenu === 'function'
      }
    }
  }

  return {
    kind,
    capabilities: MOBILE_CAPABILITIES
  }
}

const AppPlatformContext = createContext<AppPlatform>(FALLBACK_PLATFORM)

export function AppPlatformProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const platform = useMemo(() => resolveAppPlatform(), [])
  return createElement(AppPlatformContext.Provider, { value: platform }, children)
}

export function useAppPlatform(): AppPlatform {
  return useContext(AppPlatformContext)
}
