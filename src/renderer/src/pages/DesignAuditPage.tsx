import { type ReactElement } from 'react'

import { DEFAULT_DESIGN_AUDIT_TAB, type DesignAuditTabId } from '../lib/designAuditCatalog'
import { WorkspacePage, WorkspaceReadingWidth } from '../components/workspace'
import { DesignAuditActions } from '../components/design-audit/DesignAuditActions'
import { DesignAuditDisplay } from '../components/design-audit/DesignAuditDisplay'
import { DesignAuditFoundations } from '../components/design-audit/DesignAuditFoundations'
import { DesignAuditForms } from '../components/design-audit/DesignAuditForms'
import { DesignAuditOverlays } from '../components/design-audit/DesignAuditOverlays'

export interface DesignAuditPageProps {
  themeVersion: string
  activeTab: DesignAuditTabId
  onTabChange: (tabId: DesignAuditTabId) => void
}

export function DesignAuditPage({
  themeVersion,
  activeTab = DEFAULT_DESIGN_AUDIT_TAB,
  onTabChange
}: DesignAuditPageProps): ReactElement {
  const content = activeTab.startsWith('tokens-') ? (
    <DesignAuditFoundations
      themeVersion={themeVersion}
      tabId={activeTab as 'tokens-surfaces' | 'tokens-intent' | 'tokens-geometry' | 'tokens-motion'}
    />
  ) : activeTab === 'button' ||
    activeTab === 'button-groups' ||
    activeTab === 'toggle-groups' ||
    activeTab === 'keyboard' ? (
    <DesignAuditActions tabId={activeTab} />
  ) : activeTab === 'inputs' || activeTab === 'selection' || activeTab === 'dates' ? (
    <DesignAuditForms tabId={activeTab} />
  ) : activeTab === 'badges-status' ||
    activeTab === 'cards-feedback' ||
    activeTab === 'tables-navigation' ? (
    <DesignAuditDisplay tabId={activeTab} />
  ) : activeTab === 'overlays' ||
    activeTab === 'menus-popovers' ||
    activeTab === 'command-behavior' ? (
    <DesignAuditOverlays tabId={activeTab} />
  ) : null

  return (
    <WorkspacePage data-testid="design-audit-page" className="gap-8">
      <WorkspaceReadingWidth
        data-testid="design-audit-main"
        data-design-audit-tab={activeTab}
        className="py-4"
        onKeyDown={(event) => {
          if (event.key === 'Home') {
            event.preventDefault()
            onTabChange(DEFAULT_DESIGN_AUDIT_TAB)
          }
        }}
      >
        {content}
      </WorkspaceReadingWidth>
    </WorkspacePage>
  )
}
