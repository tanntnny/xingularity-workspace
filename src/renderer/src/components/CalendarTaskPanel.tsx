import { ReactElement } from 'react'
import { UnscheduledTaskList, type UnscheduledTaskListProps } from './UnscheduledTaskList'
import { WorkspacePanelStack } from './ui/document-workspace'
import { WorkspacePanelSection } from './ui/workspace-panel-section'

export type CalendarTaskPanelProps = UnscheduledTaskListProps

export function CalendarTaskPanel(props: CalendarTaskPanelProps): ReactElement {
  return (
    <WorkspacePanelStack data-testid="calendar-task-panel">
      <WorkspacePanelSection className="overflow-hidden p-0">
        <UnscheduledTaskList {...props} />
      </WorkspacePanelSection>
    </WorkspacePanelStack>
  )
}
