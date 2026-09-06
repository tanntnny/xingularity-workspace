import { type ReactElement, type ReactNode, useState } from 'react'

import {
  ActionMenuItems,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogShell,
  DialogShellFooter,
  DialogTitle,
  DialogTrigger,
  DragSource,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropZone,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../ui'
import {
  ArchiveOutline,
  Copy,
  Folder,
  GripVertical,
  Keyboard,
  Pencil,
  Search,
  Settings2,
  XCircle
} from '../ui/icons'
import { cn } from '../../lib/utils'

export type DesignAuditOverlayTabId = 'overlays' | 'menus-popovers' | 'command-behavior'

interface SpecimenSectionProps {
  id: DesignAuditOverlayTabId
  heading: string
  description: string
  children: ReactNode
}

function SpecimenSection({
  id,
  heading,
  description,
  children
}: SpecimenSectionProps): ReactElement {
  const headingId = `design-audit-${id}-heading`

  return (
    <section
      id={`design-audit-section-${id}`}
      aria-labelledby={headingId}
      data-testid={`design-audit-section:${id}`}
      className="space-y-8 border-b border-border/70 pb-10 last:border-b-0 last:pb-0"
    >
      <header className="max-w-3xl space-y-2">
        <h2 id={headingId} className="text-xl font-semibold tracking-tight text-foreground">
          {heading}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  )
}

interface SpecimenFrameProps {
  id: string
  title: string
  description: string
  children: ReactNode
}

function SpecimenFrame({ id, title, description, children }: SpecimenFrameProps): ReactElement {
  const headingId = `design-audit-${id}-heading`

  return (
    <article
      aria-labelledby={headingId}
      data-testid={`design-audit-component:${id}`}
      className="min-w-0 space-y-4"
    >
      <header className="space-y-1">
        <h3 id={headingId} className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      <div className="min-w-0 border border-border/70 bg-transparent p-4">{children}</div>
    </article>
  )
}

function VariantLabel({ children }: { children: ReactNode }): ReactElement {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  )
}

function DialogSpecimen(): ReactElement {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState('No dialog action selected')

  return (
    <SpecimenFrame
      id="dialog"
      title="Dialog"
      description="A focused modal task with a labelled title, description, focus return, and explicit close action."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              data-testid="design-audit-variant:dialog:trigger"
              aria-label="Open dialog specimen"
            >
              Open dialog
            </Button>
          </DialogTrigger>
          <DialogContent
            data-testid="design-audit-variant:dialog:content"
            aria-describedby="design-audit-dialog-description"
            showCloseButton
          >
            <DialogShell>
              <DialogHeader>
                <DialogTitle>Dialog specimen</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <DialogDescription id="design-audit-dialog-description">
                  Dialogs keep the user in a focused task while preserving the document behind the
                  overlay.
                </DialogDescription>
              </DialogBody>
              <DialogShellFooter>
                <DialogClose asChild>
                  <Button
                    variant="default"
                    data-testid="design-audit-variant:dialog:confirm"
                    onClick={() => setResult('Dialog confirmed')}
                  >
                    Done
                  </Button>
                </DialogClose>
              </DialogShellFooter>
            </DialogShell>
          </DialogContent>
        </Dialog>
        <span
          aria-live="polite"
          data-testid="design-audit-variant:dialog:result"
          className="text-sm text-muted-foreground"
        >
          {result}
        </span>
      </div>
    </SpecimenFrame>
  )
}

function AlertDialogSpecimen(): ReactElement {
  const [result, setResult] = useState('No destructive action selected')

  return (
    <SpecimenFrame
      id="alert-dialog"
      title="Alert dialog"
      description="A confirmation surface for destructive or irreversible actions, with an intentional escape hatch."
    >
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            data-testid="design-audit-variant:alert-dialog:trigger"
            aria-label="Open destructive alert dialog specimen"
          >
            Delete item
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent
          data-testid="design-audit-variant:alert-dialog:content"
          aria-describedby="design-audit-alert-dialog-description"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete audit item?</AlertDialogTitle>
            <AlertDialogDescription id="design-audit-alert-dialog-description">
              This specimen demonstrates the destructive confirmation treatment. Nothing in the
              workspace will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel
              data-testid="design-audit-variant:alert-dialog:cancel"
              onClick={() => setResult('Destructive action cancelled')}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="design-audit-variant:alert-dialog:confirm"
              onClick={() => setResult('Destructive action confirmed')}
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
        {result}
      </p>
    </SpecimenFrame>
  )
}

type DrawerSide = 'left' | 'right' | 'top' | 'bottom'

const DRAWER_SIDES: readonly { side: DrawerSide; label: string }[] = [
  { side: 'left', label: 'Left' },
  { side: 'right', label: 'Right' },
  { side: 'top', label: 'Top' },
  { side: 'bottom', label: 'Bottom' }
]

function DrawerSpecimen(): ReactElement {
  const [openSide, setOpenSide] = useState<DrawerSide | null>(null)

  return (
    <SpecimenFrame
      id="drawer"
      title="Drawer sides"
      description="Edge-attached secondary surfaces share one local state so each direction can be reviewed without stacking overlays."
    >
      <div className="flex flex-wrap items-center gap-2">
        {DRAWER_SIDES.map(({ side, label }) => (
          <Drawer
            key={side}
            open={openSide === side}
            onOpenChange={(open) => setOpenSide(open ? side : null)}
          >
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                data-testid={`design-audit-variant:drawer:${side}:trigger`}
                aria-label={`Open ${label.toLowerCase()} drawer specimen`}
              >
                {label} drawer
              </Button>
            </DrawerTrigger>
            <DrawerContent
              side={side}
              data-testid={`design-audit-variant:drawer:${side}:content`}
              aria-describedby={`design-audit-drawer-${side}-description`}
            >
              <DrawerHeader>
                <DrawerTitle>{label} drawer</DrawerTitle>
                <DrawerDescription id={`design-audit-drawer-${side}-description`}>
                  This drawer demonstrates the {side} edge attachment and responsive close path.
                </DrawerDescription>
              </DrawerHeader>
              <div className="min-h-0 flex-1 px-6 py-4 text-sm text-muted-foreground">
                Secondary content stays independent from the document surface.
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button
                    variant="outline"
                    data-testid={`design-audit-variant:drawer:${side}:close`}
                  >
                    Close {label.toLowerCase()} drawer
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Active side: <span className="text-foreground">{openSide ?? 'none'}</span>
      </p>
    </SpecimenFrame>
  )
}

function OverlaysTab(): ReactElement {
  return (
    <SpecimenSection
      id="overlays"
      heading="Focused surfaces and dismissal"
      description="These primitives establish focus management, labelled modal content, edge-attached panels, and predictable dismissal paths."
    >
      <div className="space-y-10">
        <DialogSpecimen />
        <AlertDialogSpecimen />
        <DrawerSpecimen />
      </div>
    </SpecimenSection>
  )
}

function DropdownMenuSpecimen(): ReactElement {
  const [showDetails, setShowDetails] = useState(true)
  const [density, setDensity] = useState('comfortable')
  const [result, setResult] = useState('No menu item selected')

  return (
    <SpecimenFrame
      id="dropdown-menu"
      title="Dropdown menu"
      description="Menu content covers actions, checkboxes, radio choices, submenus, disabled items, and keyboard shortcuts."
    >
      <div className="flex flex-wrap items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              data-testid="design-audit-variant:dropdown-menu:trigger"
              aria-label="Open dropdown menu specimen"
            >
              Open dropdown
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            data-testid="design-audit-variant:dropdown-menu:content"
          >
            <DropdownMenuLabel>Document actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="design-audit-variant:dropdown-menu:item"
              onSelect={() => setResult('Duplicate selected')}
            >
              <Copy aria-hidden="true" />
              Duplicate
              <DropdownMenuShortcut keys={['cmd', 'd']} />
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem
              checked={showDetails}
              data-testid="design-audit-variant:dropdown-menu:checkbox"
              onCheckedChange={(checked) => setShowDetails(checked === true)}
            >
              Show details
              <DropdownMenuShortcut keys={['cmd', 'i']} />
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel inset>Density</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
              <DropdownMenuRadioItem
                value="comfortable"
                data-testid="design-audit-variant:dropdown-menu:radio:comfortable"
              >
                Comfortable
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="compact"
                data-testid="design-audit-variant:dropdown-menu:radio:compact"
              >
                Compact
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-testid="design-audit-variant:dropdown-menu:submenu">
                <Folder aria-hidden="true" />
                Move to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent data-testid="design-audit-variant:dropdown-menu:submenu-content">
                <DropdownMenuItem onSelect={() => setResult('Moved to Projects')}>
                  Projects
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setResult('Moved to Archive')}>
                  Archive
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem disabled data-testid="design-audit-variant:dropdown-menu:disabled">
              <ArchiveOutline aria-hidden="true" />
              Unavailable action
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="design-audit-variant:dropdown-menu:shortcut"
              onSelect={() => setResult('Settings selected')}
            >
              <Settings2 aria-hidden="true" />
              Open settings
              <DropdownMenuShortcut keys={['cmd', ',']} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="text-sm text-muted-foreground">
          <span className="text-foreground">{density}</span> · details {showDetails ? 'on' : 'off'}
        </div>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
        {result}
      </p>
    </SpecimenFrame>
  )
}

function ContextMenuSpecimen(): ReactElement {
  const [checked, setChecked] = useState(false)
  const [mode, setMode] = useState('preview')
  const [result, setResult] = useState('Right-click or press Shift+F10 on the target')

  return (
    <SpecimenFrame
      id="context-menu"
      title="Context menu"
      description="The contextual surface keeps the same item semantics while positioning itself at the user’s pointer or keyboard invocation point."
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            data-testid="design-audit-variant:context-menu:trigger"
            aria-label="Open context menu specimen"
            className="flex min-h-24 w-full max-w-md items-center justify-center border border-dashed border-border px-4 text-sm text-muted-foreground outline-none transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            Right-click this target
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent data-testid="design-audit-variant:context-menu:content">
          <ContextMenuLabel>Selection actions</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setResult('Copy selected')}>
            <Copy aria-hidden="true" />
            Copy
          </ContextMenuItem>
          <ContextMenuCheckboxItem
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
          >
            Pin selection
          </ContextMenuCheckboxItem>
          <ContextMenuRadioGroup value={mode} onValueChange={setMode}>
            <ContextMenuRadioItem value="preview">Preview</ContextMenuRadioItem>
            <ContextMenuRadioItem value="edit">Edit</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Folder aria-hidden="true" />
              Send to
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onSelect={() => setResult('Sent to Projects')}>
                Projects
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => setResult('Sent to Archive')}>
                Archive
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem disabled>Unavailable action</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
        {result} · {checked ? 'pinned' : 'not pinned'} · {mode}
      </p>
    </SpecimenFrame>
  )
}

function ActionMenuItemsSpecimen(): ReactElement {
  const [result, setResult] = useState('No action menu item selected')
  const groups = [
    {
      id: 'audit-actions',
      items: [
        {
          id: 'rename',
          label: 'Rename',
          icon: <Pencil aria-hidden="true" />,
          shortcut: '⌘R',
          dropdownTestId: 'design-audit-variant:action-menu:dropdown:item',
          contextTestId: 'design-audit-variant:action-menu:context:item',
          onSelect: () => setResult('Rename selected')
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          icon: <Copy aria-hidden="true" />,
          shortcut: '⌘D',
          dropdownTestId: 'design-audit-variant:action-menu:dropdown:shortcut',
          contextTestId: 'design-audit-variant:action-menu:context:shortcut',
          onSelect: () => setResult('Duplicate selected')
        },
        {
          id: 'move',
          label: 'Move to',
          icon: <Folder aria-hidden="true" />,
          dropdownTestId: 'design-audit-variant:action-menu:dropdown:submenu',
          contextTestId: 'design-audit-variant:action-menu:context:submenu',
          submenu: [
            {
              id: 'projects',
              label: 'Projects',
              onSelect: () => setResult('Move to Projects selected')
            },
            {
              id: 'archive',
              label: 'Archive',
              onSelect: () => setResult('Move to Archive selected')
            }
          ]
        },
        {
          id: 'delete',
          label: 'Delete',
          icon: <XCircle aria-hidden="true" />,
          destructive: true,
          dropdownTestId: 'design-audit-variant:action-menu:dropdown:destructive',
          contextTestId: 'design-audit-variant:action-menu:context:destructive',
          onSelect: () => setResult('Delete selected')
        }
      ]
    }
  ]

  return (
    <SpecimenFrame
      id="action-menu-items"
      title="ActionMenuItems"
      description="One action definition can render the project’s shared actions in both dropdown and context menu variants."
    >
      <div className="flex flex-wrap items-start gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              data-testid="design-audit-variant:action-menu:dropdown:trigger"
              aria-label="Open action menu dropdown specimen"
            >
              Action menu dropdown
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <ActionMenuItems groups={groups} variant="dropdown" />
          </DropdownMenuContent>
        </DropdownMenu>

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              data-testid="design-audit-variant:action-menu:context:trigger"
              aria-label="Open action menu context specimen"
              className="min-h-10 border border-dashed border-border px-3 text-sm text-muted-foreground outline-none transition-colors hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              Action menu context target
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ActionMenuItems groups={groups} variant="context" />
          </ContextMenuContent>
        </ContextMenu>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
        {result}
      </p>
    </SpecimenFrame>
  )
}

type PopoverAlign = 'start' | 'center' | 'end'

const POPOVER_ALIGNS: readonly PopoverAlign[] = ['start', 'center', 'end']

function PopoverSpecimen(): ReactElement {
  const [openAlign, setOpenAlign] = useState<PopoverAlign | null>(null)

  return (
    <SpecimenFrame
      id="popover"
      title="Popover alignment"
      description="The same floating surface is reviewed against all three horizontal alignments while keeping its trigger and content labelled."
    >
      <div className="flex flex-wrap items-center gap-3">
        {POPOVER_ALIGNS.map((align) => (
          <Popover
            key={align}
            open={openAlign === align}
            onOpenChange={(open) => setOpenAlign(open ? align : null)}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                data-testid={`design-audit-variant:popover:${align}:trigger`}
                aria-label={`Open ${align} aligned popover specimen`}
              >
                {align} aligned
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align={align}
              data-testid={`design-audit-variant:popover:${align}:content`}
              aria-label={`${align} aligned popover`}
              className="space-y-2"
            >
              <p className="text-sm font-semibold text-foreground">{align} alignment</p>
              <p className="text-sm leading-5 text-muted-foreground">
                Content stays attached to its trigger while the alignment changes.
              </p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Open alignment: <span className="text-foreground">{openAlign ?? 'none'}</span>
      </p>
    </SpecimenFrame>
  )
}

function TooltipSpecimen(): ReactElement {
  return (
    <SpecimenFrame
      id="tooltip"
      title="Tooltip hover and focus"
      description="Both pointer hover and keyboard focus expose the same concise supporting label without changing layout."
    >
      <TooltipProvider delayDuration={0}>
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                data-testid="design-audit-variant:tooltip:hover:trigger"
                aria-label="Hover to show tooltip specimen"
              >
                Hover tooltip
              </Button>
            </TooltipTrigger>
            <TooltipContent data-testid="design-audit-variant:tooltip:hover:content">
              Shown on pointer hover
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                data-testid="design-audit-variant:tooltip:focus:trigger"
                aria-label="Focus to show tooltip specimen"
              >
                Focus tooltip
              </Button>
            </TooltipTrigger>
            <TooltipContent data-testid="design-audit-variant:tooltip:focus:content">
              Shown on keyboard focus
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </SpecimenFrame>
  )
}

function MenusPopoversTab(): ReactElement {
  return (
    <SpecimenSection
      id="menus-popovers"
      heading="Contextual actions and floating content"
      description="Menus expose actions and selection affordances; popovers and tooltips add context without turning the document into a stack of cards."
    >
      <div className="space-y-10">
        <DropdownMenuSpecimen />
        <ContextMenuSpecimen />
        <ActionMenuItemsSpecimen />
        <PopoverSpecimen />
        <TooltipSpecimen />
      </div>
    </SpecimenSection>
  )
}

function CommandSpecimen(): ReactElement {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('Open settings')
  const hasQuery = query.trim().length > 0

  return (
    <SpecimenFrame
      id="command"
      title="Command states"
      description="The command surface demonstrates searchable content, a selected item, shortcuts, disabled actions, and an explicit no-results state."
    >
      <div className="max-w-lg border border-border/70 bg-transparent p-1">
        <Command
          value={selected}
          onValueChange={setSelected}
          shouldFilter={false}
          data-testid="design-audit-variant:command:root"
          className="min-h-56"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            aria-label="Search command specimens"
            placeholder="Search commands"
          />
          <CommandList>
            {hasQuery ? (
              <CommandEmpty data-testid="design-audit-variant:command:empty">
                No commands match “{query}”
              </CommandEmpty>
            ) : (
              <>
                <CommandGroup heading="Suggested">
                  <CommandItem
                    value="Open settings"
                    data-testid="design-audit-variant:command:selected"
                    onSelect={setSelected}
                  >
                    <Settings2 aria-hidden="true" />
                    Open settings
                    <CommandShortcut keys={['cmd', ',']} />
                  </CommandItem>
                  <CommandItem
                    value="Search workspace"
                    data-testid="design-audit-variant:command:item"
                    onSelect={setSelected}
                  >
                    <Search aria-hidden="true" />
                    Search workspace
                    <CommandShortcut keys={['cmd', 'k']} />
                  </CommandItem>
                  <CommandItem
                    value="Unavailable command"
                    disabled
                    data-testid="design-audit-variant:command:disabled"
                  >
                    <Keyboard aria-hidden="true" />
                    Unavailable command
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="More">
                  <CommandItem value="Create note" onSelect={setSelected}>
                    <Pencil aria-hidden="true" />
                    Create note
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
        Selected command: <span className="text-foreground">{selected}</span>
      </p>
    </SpecimenFrame>
  )
}

function CollapsibleSpecimen(): ReactElement {
  const [open, setOpen] = useState(true)
  const [reducedMotionOpen, setReducedMotionOpen] = useState(false)

  return (
    <SpecimenFrame
      id="collapsible"
      title="Collapsible behavior"
      description="Open, closed, and reduced-motion treatments use the same disclosure primitive and preserve a logical keyboard order."
    >
      <div className="grid gap-6 md:grid-cols-3">
        <div data-testid="design-audit-variant:collapsible:open" className="space-y-3">
          <VariantLabel>Open</VariantLabel>
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                aria-label="Toggle open collapsible specimen"
              >
                Open disclosure
                <span aria-hidden="true">{open ? '−' : '+'}</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 text-sm leading-5 text-muted-foreground">
              This content is open by default and can be closed with the trigger.
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div data-testid="design-audit-variant:collapsible:closed" className="space-y-3">
          <VariantLabel>Closed</VariantLabel>
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                aria-label="Toggle closed collapsible specimen"
              >
                Closed disclosure
                <span aria-hidden="true">+</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 text-sm leading-5 text-muted-foreground">
              This content starts collapsed and is revealed on demand.
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div
          data-testid="design-audit-variant:collapsible:reduced-motion"
          data-reduced-motion="true"
          className="space-y-3"
        >
          <VariantLabel>Reduced motion</VariantLabel>
          <Collapsible open={reducedMotionOpen} onOpenChange={setReducedMotionOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="motion-reduce:transition-none w-full justify-between"
                aria-label="Toggle reduced motion collapsible specimen"
              >
                Reduced-motion disclosure
                <span aria-hidden="true">{reducedMotionOpen ? '−' : '+'}</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="motion-reduce:animate-none pt-3 text-sm leading-5 text-muted-foreground">
              The shared motion class is disabled when the user prefers reduced motion.
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </SpecimenFrame>
  )
}

type DropAuditState = 'idle' | 'active' | 'invalid' | 'disabled'

const DROP_AUDIT_STATES: readonly { state: DropAuditState; label: string }[] = [
  { state: 'idle', label: 'Idle' },
  { state: 'active', label: 'Active' },
  { state: 'invalid', label: 'Invalid' },
  { state: 'disabled', label: 'Disabled' }
]

function DragDropSpecimen(): ReactElement {
  const [dragging, setDragging] = useState(false)
  const [selectedDropState, setSelectedDropState] = useState<DropAuditState>('idle')

  return (
    <SpecimenFrame
      id="drag-drop"
      title="DragSource and DropZone"
      description="Drag states remain visible in the source, while drop zones distinguish idle, active, invalid, and disabled acceptance paths."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={dragging ? 'default' : 'outline'}
            data-testid="design-audit-variant:drag-source:toggle"
            onClick={() => setDragging((value) => !value)}
            aria-pressed={dragging}
          >
            {dragging ? 'Stop simulated drag' : 'Simulate drag'}
          </Button>
          <span className="text-sm text-muted-foreground">
            Dragging: <span className="text-foreground">{dragging ? 'active' : 'idle'}</span>
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <DragSource
            dragging={dragging}
            preview="floating"
            previewVariant="surface"
            previewSizing="fit-content"
            previewAxis="both"
            previewMotion="smooth"
            previewElevation="strong"
            hideFromPreview
            data-testid="design-audit-variant:drag-source:active"
            aria-label="Draggable audit source"
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
            className="flex min-h-16 items-center gap-2 border border-border bg-transparent px-3 text-sm text-foreground"
          >
            <GripVertical aria-hidden="true" className="text-muted-foreground" />
            <span>Source item</span>
            <span data-drag-preview-ignore="true" className="ml-auto text-xs text-muted-foreground">
              drag
            </span>
          </DragSource>
          <DragSource
            visual="preview"
            preview="none"
            previewVariant="content"
            previewSizing="fit-content"
            previewAxis="y"
            previewMotion="smooth"
            previewElevation="strong"
            draggable={false}
            data-testid="design-audit-variant:drag-source:preview"
            aria-label="Drag preview specimen"
            className="flex min-h-16 items-center gap-2 border border-dashed border-primary bg-transparent px-3 text-sm text-foreground shadow-lg"
          >
            <GripVertical aria-hidden="true" className="text-primary" />
            <span>Preview visual</span>
          </DragSource>
          <DragSource
            draggable={false}
            aria-disabled="true"
            data-testid="design-audit-variant:drag-source:disabled"
            aria-label="Disabled draggable audit source"
            className="flex min-h-16 cursor-not-allowed items-center gap-2 border border-border bg-transparent px-3 text-sm text-muted-foreground opacity-60"
          >
            <GripVertical aria-hidden="true" />
            <span>Disabled source</span>
          </DragSource>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DROP_AUDIT_STATES.map(({ state, label }) => {
            const isActive = state === 'active' || state === 'invalid'
            const isInvalid = state === 'invalid'
            const isDisabled = state === 'disabled'

            return (
              <DropZone
                key={state}
                variant="surface"
                active={isActive}
                disabled={isDisabled}
                data-audit-state={state}
                data-testid={`design-audit-variant:drop-zone:${state}`}
                role="group"
                aria-label={`${label} drop zone specimen`}
                tabIndex={isDisabled ? -1 : 0}
                onClick={() => setSelectedDropState(state)}
                className={cn(
                  'flex min-h-20 cursor-pointer items-center justify-center border-dashed px-3 text-center text-sm transition-colors motion-reduce:transition-none',
                  isInvalid &&
                    'border-destructive bg-destructive/10 text-destructive data-[drag-over=true]:bg-destructive/10',
                  isDisabled && 'cursor-not-allowed border-border text-muted-foreground opacity-60'
                )}
              >
                <span>
                  {label} <span className="text-muted-foreground">drop zone</span>
                </span>
              </DropZone>
            )
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Selected drop state: <span className="text-foreground">{selectedDropState}</span>
        </p>
      </div>
    </SpecimenFrame>
  )
}

function CommandBehaviorTab(): ReactElement {
  return (
    <SpecimenSection
      id="command-behavior"
      heading="Keyboard-first interaction states"
      description="These specimens make selection, disclosure, motion preferences, drag previews, and drop acceptance states easy to inspect in one focused view."
    >
      <div className="space-y-10">
        <CommandSpecimen />
        <CollapsibleSpecimen />
        <DragDropSpecimen />
      </div>
    </SpecimenSection>
  )
}

export function DesignAuditOverlays({ tabId }: { tabId: DesignAuditOverlayTabId }): ReactElement {
  return (
    <div
      data-testid="design-audit-overlays"
      data-audit-tab={tabId}
      className="w-full min-w-0 space-y-8 text-foreground"
    >
      {tabId === 'overlays' ? <OverlaysTab /> : null}
      {tabId === 'menus-popovers' ? <MenusPopoversTab /> : null}
      {tabId === 'command-behavior' ? <CommandBehaviorTab /> : null}
    </div>
  )
}
