import { type CSSProperties, ReactElement, useEffect, useMemo, useState } from 'react'
import { Check, Layers3, Palette, PanelsTopLeft, Sparkles } from '../components/ui/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCloseAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Calendar,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogClose,
  DialogCloseAction,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogShell,
  DialogShellFooter,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  Input,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SelectionPopover,
  Shortcut,
  StatusChip,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../components/ui'
import { WorkspacePage, WorkspacePageHeader, WorkspaceSectionCard } from '../components/workspace'
import {
  getCalendarTaskTypeChipItem,
  getTaskPriorityChipItem,
  getTaskStatusChipItem
} from '../lib/statusChipMeta'

type AuditCategory = 'all' | 'foundations' | 'actions' | 'forms' | 'display' | 'overlays'

type TokenDefinition = {
  name: string
  label: string
}

type TokenGroup = {
  id: string
  label: string
  tokens: TokenDefinition[]
}

const AUDIT_CATEGORIES: Array<{ value: AuditCategory; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'foundations', label: 'Foundations' },
  { value: 'actions', label: 'Actions' },
  { value: 'forms', label: 'Forms' },
  { value: 'display', label: 'Display' },
  { value: 'overlays', label: 'Overlays' }
]

const TOKEN_GROUPS: TokenGroup[] = [
  {
    id: 'surfaces',
    label: 'Surfaces and text',
    tokens: [
      { name: '--background', label: 'Background' },
      { name: '--card', label: 'Card' },
      { name: '--popover', label: 'Popover' },
      { name: '--foreground', label: 'Text' },
      { name: '--muted-foreground', label: 'Muted text' },
      { name: '--border', label: 'Border' },
      { name: '--input', label: 'Input' }
    ]
  },
  {
    id: 'accent',
    label: 'Accent and feedback',
    tokens: [
      { name: '--primary', label: 'Primary' },
      { name: '--secondary', label: 'Secondary' },
      { name: '--accent', label: 'Accent' },
      { name: '--surface-subtle', label: 'Subtle surface' },
      { name: '--surface-subtle-hover', label: 'Subtle surface hover' },
      { name: '--ring', label: 'Focus ring' },
      { name: '--destructive', label: 'Destructive' },
      { name: '--success', label: 'Success' },
      { name: '--warning', label: 'Warning' },
      { name: '--info', label: 'Info' }
    ]
  }
]

const COMPONENT_INVENTORY = [
  ['Actions', 'Button', 'ButtonGroup', 'ToggleGroup'],
  ['Forms', 'Field', 'Input', 'SelectionPopover', 'Textarea', 'Switch', 'Calendar'],
  [
    'Display',
    'Badge',
    'StatusChip',
    'StatusChipSelect',
    'Card',
    'Table',
    'Kbd',
    'Shortcut',
    'Breadcrumb'
  ],
  ['Overlays', 'Dialog', 'AlertDialog', 'Drawer', 'DropdownMenu', 'Popover', 'Tooltip'],
  ['Shell', 'Sidebar', 'DocumentWorkspace', 'WorkspacePage', 'WorkspaceSectionCard']
] as const

function isVisible(
  activeCategory: AuditCategory,
  category: Exclude<AuditCategory, 'all'>
): boolean {
  return activeCategory === 'all' || activeCategory === category
}

function readTokenValues(): Record<string, string> {
  const styles = window.getComputedStyle(document.documentElement)
  const tokenNames = TOKEN_GROUPS.flatMap((group) => group.tokens.map((token) => token.name))
  tokenNames.push('--app-font-family', '--radius')

  return Object.fromEntries(tokenNames.map((name) => [name, styles.getPropertyValue(name).trim()]))
}

function TokenSwatch({ token, value }: { token: TokenDefinition; value: string }): ReactElement {
  return (
    <div
      className="rounded-lg border border-border bg-card p-3"
      data-testid={`design-audit-token:${token.name.slice(2)}`}
    >
      <div
        role="img"
        className="h-10 rounded-md border border-border shadow-sm"
        style={{ background: `var(${token.name})` } as CSSProperties}
        aria-label={`${token.label} swatch`}
      />
      <p className="mt-3 text-sm font-medium text-foreground">{token.label}</p>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{token.name}</p>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{value || '—'}</p>
    </div>
  )
}

function SpecimenSection({
  id,
  eyebrow,
  heading,
  children
}: {
  id: string
  eyebrow: string
  heading: string
  children: React.ReactNode
}): ReactElement {
  return (
    <section id={id} data-testid={`design-audit-section:${id}`} className="scroll-mt-6">
      <div className="mb-3">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">{heading}</h2>
      </div>
      {children}
    </section>
  )
}

export function DesignAuditPage({ themeVersion }: { themeVersion: string }): ReactElement {
  const [activeCategory, setActiveCategory] = useState<AuditCategory>('all')
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({})
  const [switchEnabled, setSwitchEnabled] = useState(true)
  const [selectedButtonGroup, setSelectedButtonGroup] = useState('grid')
  const [selectedToggle, setSelectedToggle] = useState('comfortable')
  const [selectedTab, setSelectedTab] = useState('overview')
  const [selectedWorkspace, setSelectedWorkspace] = useState('workspace')
  const [selectedAuditStatus, setSelectedAuditStatus] = useState('review')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setTokenValues(readTokenValues()))
    return () => window.cancelAnimationFrame(frameId)
  }, [themeVersion])

  const visibleTokenGroups = useMemo(
    () => (isVisible(activeCategory, 'foundations') ? TOKEN_GROUPS : []),
    [activeCategory]
  )

  return (
    <WorkspacePage data-testid="design-audit-page">
      <WorkspacePageHeader
        heading="Design Audit"
        icon={<Palette size={30} className="text-primary" aria-hidden="true" />}
      />

      <ToggleGroup
        type="single"
        value={activeCategory}
        onValueChange={(value) => value && setActiveCategory(value as AuditCategory)}
        variant="outline"
        aria-label="Design audit categories"
      >
        {AUDIT_CATEGORIES.map((category) => (
          <ToggleGroupItem key={category.value} value={category.value}>
            {category.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {isVisible(activeCategory, 'foundations') ? (
        <SpecimenSection id="foundations" eyebrow="Live CSS variables" heading="Foundations">
          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <WorkspaceSectionCard>
              <div className="flex items-start gap-3">
                <div className="rounded-lg border border-ring bg-muted p-3 text-foreground">
                  <Palette size={18} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Theme snapshot</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Values are read from the active document styles rather than a duplicated
                    palette.
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Font
                  </dt>
                  <dd className="mt-1 break-words text-sm text-foreground">
                    {tokenValues['--app-font-family'] || 'Loading…'}
                  </dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Base radius
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {tokenValues['--radius'] || 'Loading…'}
                  </dd>
                </div>
              </dl>
            </WorkspaceSectionCard>
            <WorkspaceSectionCard className="flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Audit intent</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Use this page to compare the actual shared primitives before introducing new
                  visual patterns.
                </p>
              </div>
              <div className="mt-5 inline-flex items-center gap-2 text-sm text-primary">
                <Check size={16} aria-hidden="true" />
                Manual visual review
              </div>
            </WorkspaceSectionCard>
          </div>

          <div className="mt-4 space-y-4">
            {visibleTokenGroups.map((group) => (
              <WorkspaceSectionCard key={group.id}>
                <h3 className="text-base font-semibold text-foreground">{group.label}</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {group.tokens.map((token) => (
                    <TokenSwatch
                      key={token.name}
                      token={token}
                      value={tokenValues[token.name] ?? ''}
                    />
                  ))}
                </div>
              </WorkspaceSectionCard>
            ))}
          </div>
        </SpecimenSection>
      ) : null}

      {isVisible(activeCategory, 'actions') ? (
        <SpecimenSection
          id="actions"
          eyebrow="Interaction primitives"
          heading="Actions and selection"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <WorkspaceSectionCard data-testid="design-audit-component:button">
              <h3 className="font-semibold text-foreground">Button</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Variants, sizes, and disabled treatment.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
              </div>
            </WorkspaceSectionCard>

            <WorkspaceSectionCard>
              <h3 className="font-semibold text-foreground">Button and toggle groups</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Selected states stay local to the audit page.
              </p>
              <ToggleGroup
                type="single"
                className="mt-4"
                value={selectedButtonGroup}
                onValueChange={(value) => value && setSelectedButtonGroup(value)}
              >
                <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
                <ToggleGroupItem value="list">List</ToggleGroupItem>
                <ToggleGroupItem value="board">Board</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup
                type="single"
                value={selectedToggle}
                onValueChange={(value) => value && setSelectedToggle(value)}
                variant="outline"
                className="mt-4 justify-start"
              >
                <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
                <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
                <ToggleGroupItem value="spacious">Spacious</ToggleGroupItem>
              </ToggleGroup>
            </WorkspaceSectionCard>

            <WorkspaceSectionCard>
              <h3 className="font-semibold text-foreground">Toggle group</h3>
              <ToggleGroup
                type="single"
                value={selectedTab}
                onValueChange={(value) => value && setSelectedTab(value)}
                className="mt-3"
                variant="outline"
              >
                <ToggleGroupItem value="overview">Overview</ToggleGroupItem>
                <ToggleGroupItem value="activity">Activity</ToggleGroupItem>
                <ToggleGroupItem value="settings">Settings</ToggleGroupItem>
              </ToggleGroup>
            </WorkspaceSectionCard>

            <WorkspaceSectionCard>
              <h3 className="font-semibold text-foreground">Keyboard hints</h3>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Kbd>Esc</Kbd>
                <Shortcut keys={['cmd', 'p']} />
                <Shortcut keys={['option', 'tab']} />
              </div>
            </WorkspaceSectionCard>
          </div>
        </SpecimenSection>
      ) : null}

      {isVisible(activeCategory, 'forms') ? (
        <SpecimenSection id="forms" eyebrow="Input primitives" heading="Forms and date selection">
          <div className="grid gap-4 xl:grid-cols-2">
            <WorkspaceSectionCard>
              <div className="grid gap-4">
                <Field
                  label="Input"
                  htmlFor="design-audit-input"
                  description="Standard text input treatment."
                >
                  <Input id="design-audit-input" defaultValue="A design-system value" />
                </Field>
                <Field label="Selection popover" htmlFor="design-audit-select">
                  <SelectionPopover
                    selectionMode="single"
                    value={selectedWorkspace}
                    options={[
                      { value: 'workspace', label: 'Workspace' },
                      { value: 'project', label: 'Project' },
                      { value: 'note', label: 'Notebook' }
                    ]}
                    onValueChange={setSelectedWorkspace}
                    label="Workspace"
                    searchPlaceholder="Search workspaces"
                    triggerProps={{
                      id: 'design-audit-select',
                      'aria-label': 'Workspace'
                    }}
                  />
                </Field>
                <Field label="Textarea" htmlFor="design-audit-textarea">
                  <Textarea
                    id="design-audit-textarea"
                    defaultValue="A reusable multiline field specimen."
                  />
                </Field>
              </div>
            </WorkspaceSectionCard>

            <WorkspaceSectionCard>
              <div className="grid gap-5">
                <Field
                  label="Selection popover"
                  htmlFor="design-audit-status"
                  description="Searchable single-selection control with keyboard focus."
                >
                  <SelectionPopover
                    selectionMode="single"
                    value={selectedAuditStatus}
                    options={[
                      { value: 'review', label: 'Review' },
                      { value: 'ready', label: 'Ready' },
                      { value: 'archived', label: 'Archived' }
                    ]}
                    onValueChange={setSelectedAuditStatus}
                    label="Status"
                    searchPlaceholder="Search statuses"
                    triggerProps={{
                      id: 'design-audit-status',
                      'aria-label': 'Status'
                    }}
                  />
                </Field>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Switch</p>
                    <p className="text-xs text-muted-foreground">
                      Enabled and disabled state reference
                    </p>
                  </div>
                  <Switch
                    checked={switchEnabled}
                    onCheckedChange={setSwitchEnabled}
                    aria-label="Design audit switch"
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Calendar</p>
                  <div className="max-w-sm rounded-lg border border-border p-3">
                    <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />
                  </div>
                </div>
              </div>
            </WorkspaceSectionCard>
          </div>
        </SpecimenSection>
      ) : null}

      {isVisible(activeCategory, 'display') ? (
        <SpecimenSection
          id="display"
          eyebrow="Information primitives"
          heading="Display and navigation"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <WorkspaceSectionCard>
              <h3 className="font-semibold text-foreground">Badges</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="pill">Pill</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
              <h3 className="mt-6 font-semibold text-foreground">Status chips</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Semantic values use a colored icon and normal foreground text. Chips are transparent
                by default, with an opt-in pill surface for grouped controls.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusChip item={getTaskStatusChipItem('in-progress')} />
                <StatusChip item={getTaskPriorityChipItem('high')} />
                <StatusChip item={getCalendarTaskTypeChipItem('meeting')} />
                <StatusChip item={getTaskStatusChipItem('completed')} surface="pill" />
              </div>
              <Card className="mt-5 border-border bg-card">
                <CardHeader>
                  <CardTitle>Card hierarchy</CardTitle>
                  <CardDescription>
                    Title, description, and content use the shared card primitive.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Reusable content surface
                </CardContent>
              </Card>
            </WorkspaceSectionCard>

            <WorkspaceSectionCard>
              <h3 className="font-semibold text-foreground">Table and breadcrumb</h3>
              <Breadcrumb className="mt-4">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Workspace</BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Design Audit</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Primitive</TableHead>
                      <TableHead>Purpose</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Badge</TableCell>
                      <TableCell>Compact status</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Card</TableCell>
                      <TableCell>Content grouping</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </WorkspaceSectionCard>
          </div>
        </SpecimenSection>
      ) : null}

      {isVisible(activeCategory, 'overlays') ? (
        <SpecimenSection id="overlays" eyebrow="Layered primitives" heading="Menus and overlays">
          <WorkspaceSectionCard data-testid="design-audit-component:overlays">
            <p className="text-sm text-muted-foreground">
              Open these local specimens to review layering, surfaces, and focus treatments.
            </p>
            <TooltipProvider>
              <div className="mt-4 flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Open dialog</Button>
                  </DialogTrigger>
                  <DialogContent
                    className="max-w-lg"
                    data-testid="design-audit-dialog"
                    showCloseButton={false}
                  >
                    <DialogShell>
                      <DialogHeader>
                        <DialogTitle>Dialog specimen</DialogTitle>
                      </DialogHeader>
                      <DialogBody>
                        <DialogDescription>
                          Shared modal surface and focus behavior.
                        </DialogDescription>
                      </DialogBody>
                      <DialogShellFooter
                        closeAction={<DialogCloseAction label="Close dialog specimen" />}
                      >
                        <DialogClose asChild>
                          <DialogActionButton
                            icon={<Check />}
                            tone="primary"
                            title="Done"
                            aria-label="Done"
                          />
                        </DialogClose>
                      </DialogShellFooter>
                    </DialogShell>
                  </DialogContent>
                </Dialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">Open alert</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <DialogShell>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm specimen</AlertDialogTitle>
                      </AlertDialogHeader>
                      <DialogBody>
                        <AlertDialogDescription>
                          This action only demonstrates the alert dialog treatment.
                        </AlertDialogDescription>
                      </DialogBody>
                      <DialogShellFooter
                        closeAction={<AlertDialogCloseAction label="Close alert specimen" />}
                      >
                        <AlertDialogAction>Confirm</AlertDialogAction>
                      </DialogShellFooter>
                    </DialogShell>
                  </AlertDialogContent>
                </AlertDialog>
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button variant="outline">Open drawer</Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Drawer specimen</DrawerTitle>
                      <DrawerDescription>Shared side-panel primitive.</DrawerDescription>
                    </DrawerHeader>
                    <DrawerFooter>
                      <DrawerClose asChild>
                        <Button variant="outline">Close</Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">Open menu</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem>Archive</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">Open popover</Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <p className="text-sm text-foreground">Popover content specimen</p>
                  </PopoverContent>
                </Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">Hover tooltip</Button>
                  </TooltipTrigger>
                  <TooltipContent>Tooltip specimen</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </WorkspaceSectionCard>
        </SpecimenSection>
      ) : null}

      {activeCategory === 'all' ? (
        <SpecimenSection id="inventory" eyebrow="Source map" heading="Primitive inventory">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {COMPONENT_INVENTORY.map(([group, ...components]) => (
              <WorkspaceSectionCard key={group} className="p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Layers3 size={16} aria-hidden="true" />
                  <h3 className="font-semibold">{group}</h3>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {components.map((component) => (
                    <Badge key={component} variant="outline">
                      {component}
                    </Badge>
                  ))}
                </div>
              </WorkspaceSectionCard>
            ))}
          </div>
          <WorkspaceSectionCard className="mt-4 flex items-center gap-3 p-4">
            <PanelsTopLeft className="text-primary" size={20} aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              <Sparkles className="mr-1 inline" size={14} aria-hidden="true" />
              Feature-specific screens are intentionally excluded; this catalog is the shared
              baseline they should compose.
            </p>
          </WorkspaceSectionCard>
        </SpecimenSection>
      ) : null}
    </WorkspacePage>
  )
}
