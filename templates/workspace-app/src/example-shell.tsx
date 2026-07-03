import { ReactElement } from 'react'

import { SidebarInset, SidebarProvider } from '../../../src/renderer/src/components/ui'
import {
  WorkspaceMain,
  WorkspaceMainContent,
  WorkspaceMainHeader,
  WorkspaceShell,
  WorkspaceSidePanel,
  WorkspaceSidePanelContent,
  WorkspaceSidePanelHeader
} from '../../../src/renderer/src/components/workspace'

export function ExampleWorkspaceShell(): ReactElement {
  return (
    <SidebarProvider className="h-full">
      <SidebarInset className="!min-h-0 overflow-hidden text-[var(--text)] antialiased [font-family:var(--app-font-family)]">
        <div className="workspace-vibrancy-scope flex h-full min-w-0">
          <WorkspaceShell>
            <WorkspaceMain>
              <WorkspaceMainHeader />
              <WorkspaceMainContent />
            </WorkspaceMain>
            <WorkspaceSidePanel>
              <WorkspaceSidePanelHeader />
              <WorkspaceSidePanelContent />
            </WorkspaceSidePanel>
          </WorkspaceShell>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
