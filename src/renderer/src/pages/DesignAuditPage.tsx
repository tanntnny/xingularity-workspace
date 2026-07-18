import { type CSSProperties, ReactElement, useEffect, useMemo, useState } from 'react'
import { Check, Layers3, Palette, PanelsTopLeft, Sparkles } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
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
  ButtonGroup,
  ButtonGroupItem,
  Calendar,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
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
  Select,
  SelectionMenu,
  Shortcut,
  Switch,
  TabMenu,
  TabMenuItem,
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
      { name: '--bg', label: 'Background' },
      { name: '--panel', label: 'Panel' },
      { name: '--panel-2', label: 'Secondary panel' },
      { name: '--panel-3', label: 'Tertiary panel' },
      { name: '--text', label: 'Text' },
      { name: '--muted', label: 'Muted text' },
      { name: '--line', label: 'Border' },
      { name: '--line-strong', label: 'Strong border' }
    ]
  },
  {
    id: 'accent',
    label: 'Accent and feedback',
    tokens: [
      { name: '--accent', label: 'Accent' },
      { name: '--accent-soft', label: 'Accent soft' },
      { name: '--accent-line', label: 'Accent border' },
      { name: '--danger', label: 'Danger' },
      { name: '--ui-tone-info-bg', label: 'Info' },
      { name: '--ui-tone-success-bg', label: 'Success' },
      { name: '--ui-tone-warning-bg', label: 'Warning' },
      { name: '--ui-tone-danger-bg', label: 'Danger tone' }
    ]
  },
  {
    id: 'tags',
    label: 'Tag palette',
    tokens: [
      { name: '--tag-neutral-bg', label: 'Neutral' },
      { name: '--tag-0-bg', label: 'Tag 0' },
      { name: '--tag-1-bg', label: 'Tag 1' },
      { name: '--tag-2-bg', label: 'Tag 2' },
      { name: '--tag-3-bg', label: 'Tag 3' },
      { name: '--tag-4-bg', label: 'Tag 4' },
      { name: '--tag-5-bg', label: 'Tag 5' }
    ]
  }
]

const COMPONENT_INVENTORY = [
  ['Actions', 'Button', 'ButtonGroup', 'Pressable', 'ToggleGroup', 'TabMenu'],
  ['Forms', 'Field', 'Input', 'Select', 'Textarea', 'Switch', 'SelectionMenu', 'Calendar'],
  ['Display', 'Badge', 'Card', 'Table', 'Kbd', 'Shortcut', 'Breadcrumb'],
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
      className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3"
      data-testid={`design-audit-token:${token.name.slice(2)}`}
    >
      <div
        className="h-10 rounded-md border border-black/10 shadow-sm"
        style={{ background: `var(${token.name})` } as CSSProperties}
        aria-label={`${token.label} swatch`}
      />
      <p className="mt-3 text-sm font-medium text-[var(--text)]">{token.label}</p>
      <p className="mt-1 break-all font-mono text-[11px] text-[var(--muted)]">{token.name}</p>
      <p className="mt-1 break-all font-mono text-[11px] text-[var(--muted)]">{value || '—'}</p>
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
        <p className="workspace-eyebrow">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--text)]">{heading}</h2>
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
    <WorkspacePage width="full" data-testid="design-audit-page">
      <WorkspacePageHeader
        eyebrow="Workspace design system"
        heading="Design Audit"
        icon={<Palette size={30} className="text-[var(--accent)]" aria-hidden="true" />}
        description="Review the live visual foundations and reusable primitives that define Xingularity. Specimens use the active theme and profile accent."
      />

      <TabMenu
        variant="inline-accent"
        value={activeCategory}
        onValueChange={(value) => setActiveCategory(value as AuditCategory)}
        aria-label="Design audit categories"
      >
        {AUDIT_CATEGORIES.map((category) => (
          <TabMenuItem key={category.value} variant="inline-accent" value={category.value}>
            {category.label}
          </TabMenuItem>
        ))}
      </TabMenu>

      {isVisible(activeCategory, 'foundations') ? (
        <SpecimenSection id="foundations" eyebrow="Live CSS variables" heading="Foundations">
          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <WorkspaceSectionCard>
              <div className="flex items-start gap-3">
                <div className="rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] p-2 text-[var(--accent)]">
                  <Palette size={18} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text)]">Theme snapshot</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Values are read from the active document styles rather than a duplicated
                    palette.
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--line)] p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Font
                  </dt>
                  <dd className="mt-1 break-words text-sm text-[var(--text)]">
                    {tokenValues['--app-font-family'] || 'Loading…'}
                  </dd>
                </div>
                <div className="rounded-lg border border-[var(--line)] p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Base radius
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--text)]">
                    {tokenValues['--radius'] || 'Loading…'}
                  </dd>
                </div>
              </dl>
            </WorkspaceSectionCard>
            <WorkspaceSectionCard className="flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-[var(--text)]">Audit intent</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Use this page to compare the actual shared primitives before introducing new
                  visual patterns.
                </p>
              </div>
              <div className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--accent)]">
                <Check size={16} aria-hidden="true" />
                Manual visual review
              </div>
            </WorkspaceSectionCard>
          </div>

          <div className="mt-4 space-y-4">
            {visibleTokenGroups.map((group) => (
              <WorkspaceSectionCard key={group.id}>
                <h3 className="text-base font-semibold text-[var(--text)]">{group.label}</h3>
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
              <h3 className="font-semibold text-[var(--text)]">Button</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
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
              <h3 className="font-semibold text-[var(--text)]">Button and toggle groups</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Selected states stay local to the audit page.
              </p>
              <ButtonGroup
                className="mt-4"
                value={selectedButtonGroup}
                onValueChange={setSelectedButtonGroup}
              >
                <ButtonGroupItem value="grid">Grid</ButtonGroupItem>
                <ButtonGroupItem value="list">List</ButtonGroupItem>
                <ButtonGroupItem value="board">Board</ButtonGroupItem>
              </ButtonGroup>
              <ToggleGroup
                type="single"
                value={selectedToggle}
                onValueChange={(value) => value && setSelectedToggle(value)}
                variant="pill"
                className="mt-4 justify-start"
              >
                <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
                <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
                <ToggleGroupItem value="spacious">Spacious</ToggleGroupItem>
              </ToggleGroup>
            </WorkspaceSectionCard>

            <WorkspaceSectionCard>
              <h3 className="font-semibold text-[var(--text)]">Tab menu</h3>
              <TabMenu
                value={selectedTab}
                onValueChange={setSelectedTab}
                className="mt-3"
                fullWidth={false}
              >
                <TabMenuItem value="overview">Overview</TabMenuItem>
                <TabMenuItem value="activity">Activity</TabMenuItem>
                <TabMenuItem value="settings">Settings</TabMenuItem>
              </TabMenu>
            </WorkspaceSectionCard>

            <WorkspaceSectionCard>
              <h3 className="font-semibold text-[var(--text)]">Keyboard hints</h3>
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
                <Field label="Input" description="Standard text input treatment.">
                  <Input defaultValue="A design-system value" aria-label="Design audit input" />
                </Field>
                <Field label="Select">
                  <Select aria-label="Design audit select" defaultValue="workspace">
                    <option value="workspace">Workspace</option>
                    <option value="project">Project</option>
                    <option value="note">Notebook</option>
                  </Select>
                </Field>
                <Field label="Textarea">
                  <Textarea
                    aria-label="Design audit textarea"
                    defaultValue="A reusable multiline field specimen."
                  />
                </Field>
              </div>
            </WorkspaceSectionCard>

            <WorkspaceSectionCard>
              <div className="grid gap-5">
                <Field label="Selection menu" description="Custom menu-style selection control.">
                  <SelectionMenu
                    value="review"
                    onValueChange={() => undefined}
                    options={[
                      { value: 'review', label: 'Review' },
                      { value: 'ready', label: 'Ready' },
                      { value: 'archived', label: 'Archived' }
                    ]}
                    aria-label="Design audit selection menu"
                  />
                </Field>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] p-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">Switch</p>
                    <p className="text-xs text-[var(--muted)]">
                      Enabled and disabled state reference
                    </p>
                  </div>
                  <Switch
                    checked={switchEnabled}
                    onChange={(_, checked) => setSwitchEnabled(checked)}
                    inputProps={{ 'aria-label': 'Design audit switch' }}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--text)]">Calendar</p>
                  <div className="max-w-sm rounded-lg border border-[var(--line)] p-3">
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
              <h3 className="font-semibold text-[var(--text)]">Badges</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="tag0">Tag 0</Badge>
                <Badge variant="tag1">Tag 1</Badge>
                <Badge variant="tag2">Tag 2</Badge>
                <Badge tone="success">Success</Badge>
                <Badge tone="warning">Warning</Badge>
                <Badge tone="danger">Danger</Badge>
              </div>
              <Card className="mt-5 border-[var(--line)] bg-[var(--panel)]">
                <CardHeader>
                  <CardTitle>Card hierarchy</CardTitle>
                  <CardDescription>
                    Title, description, and content use the shared card primitive.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-[var(--muted)]">
                  Reusable content surface
                </CardContent>
              </Card>
            </WorkspaceSectionCard>

            <WorkspaceSectionCard>
              <h3 className="font-semibold text-[var(--text)]">Table and breadcrumb</h3>
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
            <p className="text-sm text-[var(--muted)]">
              Open these local specimens to review layering, surfaces, and focus treatments.
            </p>
            <TooltipProvider>
              <div className="mt-4 flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Open dialog</Button>
                  </DialogTrigger>
                  <DialogContent data-testid="design-audit-dialog">
                    <DialogHeader>
                      <DialogTitle>Dialog specimen</DialogTitle>
                      <DialogDescription>
                        Shared modal surface and focus behavior.
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">Open alert</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm specimen</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action only demonstrates the alert dialog treatment.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
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
                    <p className="text-sm text-[var(--text)]">Popover content specimen</p>
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
                <div className="flex items-center gap-2 text-[var(--accent)]">
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
            <PanelsTopLeft className="text-[var(--accent)]" size={20} aria-hidden="true" />
            <p className="text-sm text-[var(--muted)]">
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
