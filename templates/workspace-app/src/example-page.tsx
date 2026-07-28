import { LayoutDashboard } from 'lucide-react'
import { ReactElement } from 'react'

import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspaceSectionCard
} from '../../../src/renderer/src/components/workspace'

export function ExampleWorkspacePage(): ReactElement {
  return (
    <WorkspacePage width="wide">
      <WorkspaceSectionCard>
        <div className="flex items-center gap-3">
          <LayoutDashboard className="text-primary" size={20} />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Example page</h2>
            <p className="text-sm text-muted-foreground">
              Use shared cards and empty states before adding page-local styling.
            </p>
          </div>
        </div>
      </WorkspaceSectionCard>

      <WorkspaceEmptyState
        icon={<LayoutDashboard className="text-primary" size={18} />}
        heading="No data yet"
        description="This is the default empty-state pattern for future workspace pages."
      />
    </WorkspacePage>
  )
}
