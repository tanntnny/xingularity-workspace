import type { ReactElement } from 'react'

import {
  CollapsibleWorkspacePanelSection,
  WorkspaceListRail,
  WorkspaceListRailItem,
  WorkspacePanelStack
} from './ui'
import {
  DESIGN_AUDIT_GROUPS,
  DESIGN_AUDIT_TABS,
  type DesignAuditTabId
} from '../lib/designAuditCatalog'

export interface DesignAuditRightPanelProps {
  activeTab: DesignAuditTabId
  onTabChange: (tab: DesignAuditTabId) => void
}

export function DesignAuditRightPanel({
  activeTab,
  onTabChange
}: DesignAuditRightPanelProps): ReactElement {
  return (
    <WorkspacePanelStack
      data-testid="design-audit-panel"
      data-design-audit-panel-stack="true"
      className="gap-3"
    >
      {DESIGN_AUDIT_GROUPS.map((group) => {
        const tabs = DESIGN_AUDIT_TABS.filter((tab) => tab.groupId === group.id)

        return (
          <CollapsibleWorkspacePanelSection
            key={group.id}
            data-testid={`design-audit-panel-section:${group.id}`}
            aria-label={`${group.label} design audit section`}
            heading={group.label}
            defaultOpen
            className="overflow-hidden p-0"
          >
            <WorkspaceListRail
              aria-label={`${group.label} design audit catalog`}
              data-testid={`design-audit-navigation:${group.id}`}
              className="p-3"
            >
              {tabs.map((tab) => (
                <WorkspaceListRailItem
                  key={tab.id}
                  active={activeTab === tab.id}
                  aria-label={`${tab.label}: ${tab.description}`}
                  data-testid={`design-audit-nav-item:${tab.id}`}
                  labelOverflow="fade"
                  title={tab.label}
                  onClick={() => onTabChange(tab.id)}
                >
                  {tab.label}
                </WorkspaceListRailItem>
              ))}
            </WorkspaceListRail>
          </CollapsibleWorkspacePanelSection>
        )
      })}
    </WorkspacePanelStack>
  )
}
