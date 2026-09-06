export type DesignAuditTokenKind = 'color' | 'value'

export type DesignAuditToken = {
  name: string
  label: string
  kind: DesignAuditTokenKind
}

export type DesignAuditTokenGroup = {
  id: string
  label: string
  description: string
  tokens: readonly DesignAuditToken[]
}

export type DesignAuditComponentSpec = {
  name: string
  variants: readonly string[]
}

export type DesignAuditTab = {
  id: string
  groupId: string
  label: string
  description: string
  icon: string
  components: readonly DesignAuditComponentSpec[]
}

export const DESIGN_AUDIT_TOKEN_GROUPS: readonly DesignAuditTokenGroup[] = [
  {
    id: 'surfaces',
    label: 'Surfaces and text',
    description: 'The document, panel, control, and text ladder used throughout the workspace.',
    tokens: [
      { name: '--app-background', label: 'App background', kind: 'color' },
      { name: '--background', label: 'Background', kind: 'color' },
      { name: '--workspace-background', label: 'Workspace background', kind: 'color' },
      { name: '--panel', label: 'Panel', kind: 'color' },
      { name: '--panel-hover', label: 'Panel hover', kind: 'color' },
      { name: '--card', label: 'Card', kind: 'color' },
      { name: '--card-hover', label: 'Card hover', kind: 'color' },
      { name: '--card-foreground', label: 'Card text', kind: 'color' },
      { name: '--popover', label: 'Popover', kind: 'color' },
      { name: '--popover-hover', label: 'Popover hover', kind: 'color' },
      { name: '--popover-foreground', label: 'Popover text', kind: 'color' },
      { name: '--muted', label: 'Muted surface', kind: 'color' },
      { name: '--muted-foreground', label: 'Muted text', kind: 'color' },
      { name: '--surface-subtle', label: 'Subtle surface', kind: 'color' },
      { name: '--surface-subtle-foreground', label: 'Subtle surface text', kind: 'color' },
      { name: '--surface-subtle-hover', label: 'Subtle surface hover', kind: 'color' },
      { name: '--foreground', label: 'Text', kind: 'color' },
      { name: '--border', label: 'Border', kind: 'color' },
      { name: '--panel-border', label: 'Panel border', kind: 'color' },
      { name: '--input', label: 'Input border', kind: 'color' },
      { name: '--ring', label: 'Focus ring', kind: 'color' }
    ]
  },
  {
    id: 'intent',
    label: 'Intent and feedback',
    description: 'Semantic action, status, progress, and overlay colors.',
    tokens: [
      { name: '--primary', label: 'Primary', kind: 'color' },
      { name: '--primary-foreground', label: 'Primary text', kind: 'color' },
      { name: '--secondary', label: 'Secondary', kind: 'color' },
      { name: '--secondary-foreground', label: 'Secondary text', kind: 'color' },
      { name: '--accent', label: 'Accent', kind: 'color' },
      { name: '--accent-foreground', label: 'Accent text', kind: 'color' },
      { name: '--accent-hover', label: 'Accent hover', kind: 'color' },
      { name: '--destructive', label: 'Destructive', kind: 'color' },
      { name: '--destructive-foreground', label: 'Destructive text', kind: 'color' },
      { name: '--destructive-muted', label: 'Destructive muted', kind: 'color' },
      { name: '--destructive-muted-foreground', label: 'Destructive muted text', kind: 'color' },
      { name: '--destructive-strong', label: 'Destructive strong', kind: 'color' },
      { name: '--success', label: 'Success', kind: 'color' },
      { name: '--success-foreground', label: 'Success text', kind: 'color' },
      { name: '--success-muted', label: 'Success muted', kind: 'color' },
      { name: '--success-muted-foreground', label: 'Success muted text', kind: 'color' },
      { name: '--warning', label: 'Warning', kind: 'color' },
      { name: '--warning-foreground', label: 'Warning text', kind: 'color' },
      { name: '--warning-muted', label: 'Warning muted', kind: 'color' },
      { name: '--warning-muted-foreground', label: 'Warning muted text', kind: 'color' },
      { name: '--info', label: 'Info', kind: 'color' },
      { name: '--info-foreground', label: 'Info text', kind: 'color' },
      { name: '--info-muted', label: 'Info muted', kind: 'color' },
      { name: '--info-muted-foreground', label: 'Info muted text', kind: 'color' },
      { name: '--progress', label: 'Progress', kind: 'color' },
      { name: '--overlay', label: 'Overlay', kind: 'color' },
      { name: '--overlay-muted', label: 'Muted overlay', kind: 'color' }
    ]
  },
  {
    id: 'geometry',
    label: 'Geometry and density',
    description: 'Shared dimensions, radii, and workspace sizing values.',
    tokens: [
      { name: '--border-width', label: 'Border width', kind: 'value' },
      { name: '--radius', label: 'Base radius', kind: 'value' },
      { name: '--radius-surface', label: 'Surface radius', kind: 'value' },
      { name: '--radius-shell', label: 'Shell radius', kind: 'value' },
      { name: '--radius-dialog', label: 'Dialog radius', kind: 'value' },
      { name: '--radius-button', label: 'Button radius', kind: 'value' },
      { name: '--radius-button-pill', label: 'Pill radius', kind: 'value' },
      { name: '--radius-control', label: 'Control radius', kind: 'value' },
      { name: '--control-height', label: 'Control height', kind: 'value' },
      { name: '--compact-control-height', label: 'Compact control height', kind: 'value' },
      { name: '--control-font-size', label: 'Control font size', kind: 'value' },
      { name: '--control-icon-size', label: 'Control icon size', kind: 'value' },
      { name: '--status-chip-icon-size', label: 'Status chip icon size', kind: 'value' },
      { name: '--control-padding-x', label: 'Control horizontal padding', kind: 'value' },
      { name: '--workspace-chrome-height', label: 'Workspace chrome height', kind: 'value' },
      { name: '--workspace-tab-control-height', label: 'Workspace tab height', kind: 'value' },
      { name: '--scrollbar-size', label: 'Scrollbar size', kind: 'value' },
      { name: '--drawer-width', label: 'Drawer width', kind: 'value' },
      { name: '--workspace-pane-width', label: 'Workspace pane width', kind: 'value' },
      { name: '--resize-handle-center', label: 'Resize handle center', kind: 'color' },
      { name: '--resize-handle-edge', label: 'Resize handle edge', kind: 'color' }
    ]
  },
  {
    id: 'motion',
    label: 'Motion and system',
    description: 'Timing, easing, and interaction feedback values used by shared primitives.',
    tokens: [
      { name: '--motion-duration-fast', label: 'Fast duration', kind: 'value' },
      { name: '--motion-duration-content', label: 'Content duration', kind: 'value' },
      { name: '--motion-duration-disclosure', label: 'Disclosure duration', kind: 'value' },
      { name: '--motion-duration-overlay', label: 'Overlay duration', kind: 'value' },
      { name: '--motion-duration-panel', label: 'Panel duration', kind: 'value' },
      { name: '--motion-duration-calendar', label: 'Calendar duration', kind: 'value' },
      { name: '--motion-ease-linear', label: 'Linear easing', kind: 'value' },
      { name: '--motion-ease-standard', label: 'Standard easing', kind: 'value' },
      { name: '--motion-floating-offset-x', label: 'Floating X offset', kind: 'value' },
      { name: '--motion-floating-offset-y', label: 'Floating Y offset', kind: 'value' },
      { name: '--motion-reveal-delay', label: 'Reveal delay', kind: 'value' },
      { name: '--scrollbar-thumb', label: 'Scrollbar thumb', kind: 'color' },
      { name: '--scrollbar-thumb-hover', label: 'Scrollbar thumb hover', kind: 'color' },
      { name: '--drag-preview-bg', label: 'Drag preview surface', kind: 'color' },
      { name: '--drag-preview-border', label: 'Drag preview border', kind: 'color' },
      { name: '--drop-zone-bg', label: 'Drop zone surface', kind: 'color' },
      { name: '--drop-zone-border', label: 'Drop zone border', kind: 'color' },
      { name: '--drop-zone-active-bg', label: 'Active drop zone surface', kind: 'color' },
      { name: '--drop-zone-active-border', label: 'Active drop zone border', kind: 'color' }
    ]
  }
] as const

export const DESIGN_AUDIT_GROUPS = [
  { id: 'foundations', label: 'Foundations', description: 'Semantic tokens and system values.' },
  { id: 'actions', label: 'Actions', description: 'Buttons, selection, and keyboard affordances.' },
  { id: 'forms', label: 'Forms', description: 'Inputs, pickers, and date controls.' },
  { id: 'display', label: 'Display', description: 'Information, navigation, and data surfaces.' },
  { id: 'overlays', label: 'Overlays', description: 'Layered surfaces and interaction behavior.' }
] as const

export const DESIGN_AUDIT_TABS = [
  {
    id: 'tokens-surfaces',
    groupId: 'foundations',
    label: 'Surfaces and text',
    description: 'Live document surfaces and foreground roles.',
    icon: 'palette',
    components: []
  },
  {
    id: 'tokens-intent',
    groupId: 'foundations',
    label: 'Intent and feedback',
    description: 'Primary, semantic, progress, and overlay roles.',
    icon: 'sparkles',
    components: []
  },
  {
    id: 'tokens-geometry',
    groupId: 'foundations',
    label: 'Geometry and density',
    description: 'Radii, control dimensions, and workspace sizing.',
    icon: 'ruler',
    components: []
  },
  {
    id: 'tokens-motion',
    groupId: 'foundations',
    label: 'Motion and system',
    description: 'Timing, easing, and drag/drop feedback tokens.',
    icon: 'activity',
    components: []
  },
  {
    id: 'button',
    groupId: 'actions',
    label: 'Button',
    description: 'Action hierarchy, sizes, shapes, and disabled state.',
    icon: 'mouse-pointer',
    components: [
      {
        name: 'Button',
        variants: [
          'default',
          'accent',
          'secondary',
          'outline',
          'ghost',
          'muted',
          'destructive',
          'rowAction',
          'link',
          'disabled',
          'sm',
          'default size',
          'lg',
          'icon',
          'pill'
        ]
      }
    ]
  },
  {
    id: 'button-groups',
    groupId: 'actions',
    label: 'Button groups',
    description: 'Grouped actions with density, focus, and divider states.',
    icon: 'layout-grid',
    components: [
      {
        name: 'ButtonGroup',
        variants: ['default', 'outline', 'ghost', 'sm', 'default size', 'lg']
      },
      {
        name: 'ActionButtonGroup',
        variants: [
          'focus none',
          'focus glow',
          'dividers on',
          'dividers off',
          'sm',
          'default size',
          'lg'
        ]
      }
    ]
  },
  {
    id: 'toggle-groups',
    groupId: 'actions',
    label: 'Toggle groups',
    description: 'Single, multiple, tab-like, selected, and disabled states.',
    icon: 'switch-horizontal',
    components: [
      {
        name: 'ToggleGroup',
        variants: [
          'default',
          'outline',
          'single',
          'multiple',
          'sm',
          'default size',
          'lg',
          'selected',
          'disabled',
          'animated indicator',
          'static indicator'
        ]
      },
      { name: 'TabToggleGroup', variants: ['selected', 'idle', 'disabled', 'long label'] }
    ]
  },
  {
    id: 'keyboard',
    groupId: 'actions',
    label: 'Keyboard hints',
    description: 'Compact keyboard affordances for commands and shortcuts.',
    icon: 'keyboard',
    components: [
      {
        name: 'Kbd / Shortcut',
        variants: ['single key', 'modifier chord', 'alternative key', 'long shortcut']
      }
    ]
  },
  {
    id: 'inputs',
    groupId: 'forms',
    label: 'Inputs and fields',
    description: 'Labels, descriptions, input variants, and multiline fields.',
    icon: 'forms',
    components: [
      { name: 'Field', variants: ['label', 'description', 'error', 'required'] },
      {
        name: 'Input',
        variants: [
          'default',
          'ghost',
          'plain',
          'default radius',
          'control radius',
          'pill radius',
          'focus radius',
          'empty',
          'filled',
          'disabled',
          'read-only'
        ]
      },
      { name: 'Textarea', variants: ['empty', 'filled', 'disabled', 'focused'] },
      { name: 'Checkbox / Switch', variants: ['unchecked', 'checked', 'disabled', 'mixed'] }
    ]
  },
  {
    id: 'selection',
    groupId: 'forms',
    label: 'Selection controls',
    description: 'Single and multiple selection with search and long labels.',
    icon: 'list-check',
    components: [
      { name: 'Select', variants: ['default', 'disabled', 'grouped', 'long label'] },
      {
        name: 'SelectionPopover',
        variants: [
          'single',
          'multiple',
          'searchable',
          'empty',
          'disabled option',
          'long label',
          'create action'
        ]
      },
      {
        name: 'ResponsivePicker',
        variants: ['desktop popover', 'mobile sheet', 'single', 'multiple']
      },
      { name: 'StatusChipSelect', variants: ['single', 'multiple', 'searchable', 'disabled'] }
    ]
  },
  {
    id: 'dates',
    groupId: 'forms',
    label: 'Dates and pickers',
    description: 'Calendar modes and compact date/time editing controls.',
    icon: 'calendar',
    components: [
      {
        name: 'Calendar',
        variants: ['single', 'range', 'multiple', 'disabled day', 'outside day', 'selected']
      },
      {
        name: 'CalendarDateEditPopover',
        variants: [
          'button trigger',
          'status chip trigger',
          'empty',
          'selected',
          'error',
          'disabled'
        ]
      },
      {
        name: 'CalendarTimeEditPopover',
        variants: ['with icon', 'without icon', 'empty', 'selected', 'disabled']
      },
      { name: 'DatePicker', variants: ['default', 'ISO value'] }
    ]
  },
  {
    id: 'badges-status',
    groupId: 'display',
    label: 'Badges and status',
    description: 'Compact semantic labels, tones, surfaces, and overflow behavior.',
    icon: 'tag',
    components: [
      {
        name: 'Badge',
        variants: [
          'default',
          'secondary',
          'pill',
          'destructive',
          'outline',
          'neutral',
          'tag0',
          'tag1',
          'tag2',
          'tag3',
          'tag4',
          'tag5',
          'subtle tone',
          'neutral tone',
          'info tone',
          'accent tone',
          'attention tone',
          'success tone',
          'warning tone',
          'danger tone'
        ]
      },
      {
        name: 'StatusChip',
        variants: [
          'default',
          'bare',
          'none surface',
          'pill surface',
          'attention surface',
          'hover surface',
          'hover pill',
          'truncate',
          'wrap',
          'fade',
          'muted label',
          'button'
        ]
      },
      { name: 'StatusChipSelect', variants: ['single', 'multiple', 'disabled'] }
    ]
  },
  {
    id: 'cards-feedback',
    groupId: 'display',
    label: 'Cards and feedback',
    description: 'Content hierarchy, empty states, and progress boundaries.',
    icon: 'layers',
    components: [
      { name: 'Card', variants: ['header', 'description', 'content', 'footer', 'hover'] },
      { name: 'EmptyState', variants: ['default', 'with icon', 'with action', 'compact'] },
      { name: 'ProgressRing', variants: ['0%', 'partial', '100%', 'large', 'small'] },
      { name: 'Separator', variants: ['horizontal', 'vertical'] }
    ]
  },
  {
    id: 'tables-navigation',
    groupId: 'display',
    label: 'Tables and navigation',
    description: 'Data density and workspace navigation primitives.',
    icon: 'table',
    components: [
      {
        name: 'Table / TableRowList',
        variants: ['headers', 'sortable', 'grouped', 'empty', 'long content', 'row action']
      },
      { name: 'Breadcrumb', variants: ['link', 'button', 'current', 'ellipsis'] },
      {
        name: 'WorkspaceListRail',
        variants: ['active', 'idle', 'description', 'leading', 'trailing', 'empty']
      },
      { name: 'ChipGroup', variants: ['default', 'empty', 'long labels'] }
    ]
  },
  {
    id: 'overlays',
    groupId: 'overlays',
    label: 'Dialogs and drawers',
    description: 'Modal, alert, and directional layered surfaces.',
    icon: 'panels',
    components: [
      { name: 'Dialog', variants: ['default', 'with close', 'with footer', 'long content'] },
      { name: 'AlertDialog', variants: ['confirm', 'cancel', 'destructive'] },
      { name: 'Drawer', variants: ['left', 'right', 'top', 'bottom', 'with footer'] }
    ]
  },
  {
    id: 'menus-popovers',
    groupId: 'overlays',
    label: 'Menus and popovers',
    description: 'Context actions, selection surfaces, alignment, and tooltips.',
    icon: 'menu',
    components: [
      {
        name: 'DropdownMenu',
        variants: ['item', 'checkbox', 'radio', 'submenu', 'disabled', 'shortcut']
      },
      { name: 'ContextMenu', variants: ['item', 'checkbox', 'radio', 'submenu', 'disabled'] },
      { name: 'ActionMenuItems', variants: ['dropdown', 'context', 'destructive', 'disabled'] },
      {
        name: 'Popover / Tooltip',
        variants: ['start', 'center', 'end', 'hover', 'focus', 'long content']
      }
    ]
  },
  {
    id: 'command-behavior',
    groupId: 'overlays',
    label: 'Command and behavior',
    description: 'Command search, disclosure, and drag/drop feedback states.',
    icon: 'command',
    components: [
      {
        name: 'Command',
        variants: ['group', 'item', 'shortcut', 'separator', 'empty', 'disabled']
      },
      { name: 'Collapsible', variants: ['open', 'closed', 'animated', 'reduced motion'] },
      {
        name: 'DragSource / DropZone',
        variants: ['preview', 'idle', 'active', 'invalid', 'disabled']
      }
    ]
  }
] as const

export type DesignAuditTabId = (typeof DESIGN_AUDIT_TABS)[number]['id']

export const DEFAULT_DESIGN_AUDIT_TAB: DesignAuditTabId = 'tokens-surfaces'

export const DESIGN_AUDIT_TAB_IDS = new Set<DesignAuditTabId>(
  DESIGN_AUDIT_TABS.map((tab) => tab.id)
)

export function getDesignAuditTab(tabId: string): DesignAuditTab {
  return DESIGN_AUDIT_TABS.find((tab) => tab.id === tabId) ?? DESIGN_AUDIT_TABS[0]
}

export function getDesignAuditTokenGroup(groupId: string): DesignAuditTokenGroup {
  return (
    DESIGN_AUDIT_TOKEN_GROUPS.find((group) => group.id === groupId) ?? DESIGN_AUDIT_TOKEN_GROUPS[0]
  )
}
