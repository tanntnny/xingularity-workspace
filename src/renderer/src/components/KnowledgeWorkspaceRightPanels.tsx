import { ReactElement } from 'react'

import { Button } from './ui/button'
import { Input } from './ui/input'
import { Switch } from './ui/switch'
import { WorkspacePanelSection, WorkspacePanelSectionHeader } from './ui/workspace-panel-section'

interface KnowledgeGraphSettingsPanelProps {
  orphanRingRadiusInput: string
  orphanRingRadiusPx: number | null
  onOrphanRingRadiusInputChange: (value: string) => void
  onResetOrphanRingRadius: () => void
}

export function KnowledgeGraphSettingsPanel({
  orphanRingRadiusInput,
  orphanRingRadiusPx,
  onOrphanRingRadiusInputChange,
  onResetOrphanRingRadius
}: KnowledgeGraphSettingsPanelProps): ReactElement {
  return (
    <WorkspacePanelSection data-testid="knowledge-graph-editor">
      <WorkspacePanelSectionHeader
        heading="Graph view"
        description="Configure how disconnected notes are arranged."
      />
      <div className="space-y-2">
        <label
          htmlFor="knowledge-orphan-radius-input"
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Orphan ring radius
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="knowledge-orphan-radius-input"
            data-testid="knowledge-orphan-radius-input"
            type="number"
            min={72}
            step={1}
            value={orphanRingRadiusInput}
            onChange={(event) => onOrphanRingRadiusInputChange(event.target.value)}
            placeholder="Auto"
            className="min-w-0 flex-1"
            aria-label="Orphan ring radius in pixels"
          />
          <span className="text-xs text-muted-foreground">px</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Applied radius: {orphanRingRadiusPx == null ? 'Auto' : `${orphanRingRadiusPx}px`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onResetOrphanRingRadius}>
          Reset
        </Button>
      </div>
    </WorkspacePanelSection>
  )
}

interface KnowledgeOrphanVisibilityPanelProps {
  showOrphans: boolean
  onShowOrphansChange: (showOrphans: boolean) => void
}

export function KnowledgeOrphanVisibilityPanel({
  showOrphans,
  onShowOrphansChange
}: KnowledgeOrphanVisibilityPanelProps): ReactElement {
  return (
    <WorkspacePanelSection data-testid="knowledge-orphan-visibility-panel">
      <WorkspacePanelSectionHeader
        heading="Orphan notes"
        description="Control whether notes without connections appear in the graph."
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor="knowledge-show-orphans" className="text-sm font-medium leading-none">
            Show orphan notes
          </label>
          <p id="knowledge-show-orphans-description" className="mt-1 text-xs text-muted-foreground">
            Display disconnected notes around the graph.
          </p>
        </div>
        <Switch
          id="knowledge-show-orphans"
          data-testid="knowledge-show-orphans"
          checked={showOrphans}
          onCheckedChange={onShowOrphansChange}
          aria-describedby="knowledge-show-orphans-description"
          aria-label="Show orphan notes"
        />
      </div>
    </WorkspacePanelSection>
  )
}
