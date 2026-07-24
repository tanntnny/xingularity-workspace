export {
  DocumentWorkspace as WorkspaceShell,
  DocumentWorkspaceMain as WorkspaceMain,
  DocumentWorkspaceMainHeader as WorkspaceMainHeader,
  DocumentWorkspaceMainContent as WorkspaceMainContent,
  DocumentWorkspacePanel as WorkspaceSidePanel,
  DocumentWorkspacePanelHeader as WorkspaceSidePanelHeader,
  DocumentWorkspacePanelContent as WorkspaceSidePanelContent,
  WorkspaceHeaderActions as WorkspaceToolbar,
  WorkspaceHeaderActionGroup as WorkspaceToolbarGroup,
  WorkspaceHeaderActionDivider as WorkspaceToolbarDivider,
  WorkspaceActionButton as WorkspaceIconButton
} from '../ui/document-workspace'

export {
  DocumentWorkspace,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainHeader,
  DocumentWorkspaceMainContent,
  DocumentWorkspacePanel,
  DocumentWorkspacePanelHeader,
  DocumentWorkspacePanelContent,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionGroup,
  WorkspaceHeaderActionDivider,
  WorkspaceActionButton
} from '../ui/document-workspace'

export { WorkspaceTabManager } from '../ui/document-workspace'

import * as React from 'react'

import { SidebarInset, SidebarProvider } from '../ui/sidebar'
import { cn } from '../lib/utils'

export interface WorkspaceAppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  sidebar: React.ReactNode
  tabs?: React.ReactNode
}

export function WorkspaceAppShell({
  sidebar,
  tabs,
  children,
  className,
  ...props
}: WorkspaceAppShellProps): React.ReactElement {
  return (
    <SidebarProvider>
      {sidebar}
      <SidebarInset
        {...props}
        className={cn('min-h-0 overflow-hidden text-[var(--text)]', className)}
      >
        <div className="workspace-vibrancy-scope flex h-full min-w-0 flex-col">
          {tabs}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
