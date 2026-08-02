# Component Selection Reference

Read this file when mapping an existing UI pattern to shadcn/native components or when the semantic choice is ambiguous.

## Selection principle

Choose by user intent and interaction contract, not visual resemblance.

Native semantic HTML is the first layer. shadcn/ui supplies accessible behavior, visual consistency, and composition for interactive or repeated product patterns.

## Action and navigation

| Intent | Preferred pattern | Avoid |
|---|---|---|
| Navigate to a route, file, section, or URL | Link / framework link, optionally rendered with a button visual variant | Button with `onClick` that performs navigation |
| Trigger an operation | `Button` | Clickable `div` or link without navigation |
| Choose one action from a compact set | `DropdownMenu` from a labeled button | Hidden actions with no discoverable trigger |
| Persistent application menu bar | `Menubar` | `Menubar` for ordinary website navigation |
| Right-click or object-specific context actions | `ContextMenu` only when a visible alternative exists | Context menu as the only way to access essential actions |
| Group adjacent related actions | `ButtonGroup` | Random negative margins or border hacks |
| Toggle one independent boolean state | `Switch`, `Checkbox`, or `Toggle` based on meaning | Tabs or radio buttons |
| Select exactly one option from a visible set | `RadioGroup` or single-select `ToggleGroup` | Several independent checkboxes |
| Select several options from a visible set | Checkboxes or multi-select `ToggleGroup` | Radio group |

## Navigation and view switching

| Intent | Preferred pattern | Notes |
|---|---|---|
| Primary application navigation | `Sidebar` or semantic `<nav>` links | Active state must reflect current route |
| Site-level navigation with expandable destinations | `NavigationMenu` | Use ordinary links for simple navigation |
| Current location hierarchy | `Breadcrumb` | Do not use as the only page title |
| Switch panels within the same context | `Tabs` | Tabs are not route navigation unless routing preserves tab semantics |
| Step through sequential workflow | Explicit stepper composed from semantic list/progress patterns | Do not fake with tabs when order is mandatory |
| Navigate paginated results | `Pagination` | Preserve URL/query state when appropriate |
| Search and execute commands | `Command`, often inside `Dialog` | Not a replacement for every select input |

## Overlays and disclosure

| Intent | Preferred pattern | Avoid |
|---|---|---|
| Focused modal task | `Dialog` | Modal for passive information that can remain inline |
| Confirm irreversible/destructive action | `AlertDialog` | Generic dialog with an easy-to-miss destructive button |
| Secondary edge-attached panel | `Sheet` | Sheet for a tiny tooltip-like explanation |
| Mobile bottom interaction surface | Project-compatible drawer pattern | Forcing desktop dialog dimensions onto mobile |
| Small contextual interactive surface | `Popover` | Essential content only available on hover |
| Supplemental preview on hover/focus | `HoverCard` | Critical controls or required instructions |
| Concise explanation for unfamiliar/icon-only control | `Tooltip` | Tooltip for information required to complete a task |
| Expand/collapse a section | `Collapsible` | Accordion when only one independent section exists |
| Related disclosure sections | `Accordion` | Accordion for unrelated page navigation |

## Content containers

| Intent | Preferred pattern | Avoid |
|---|---|---|
| Independent summary or grouped surface | `Card` | Wrapping every section in a card |
| Repeated title/description/media/action row | `Item` / `ItemGroup` | Dozens of visually heavy cards |
| Persistent status or warning | `Alert` | Toast for information users need to revisit |
| Temporary completion/error notification | Sonner/toast | Toast as the only validation error |
| No available content | `Empty` | Bare “No data” text without context or next action |
| In-progress placeholder preserving layout | `Skeleton` | Spinner replacing an entire structured page |
| Brief indeterminate action progress | `Spinner` in the action/control | Multiple unrelated spinners across the page |
| Status label | `Badge` with semantic variant | Color-only status with no text |
| Long-form rendered HTML/Markdown | Semantic `<article>` plus project-compatible typeset | Manually styling every generated element inline |

## Forms

Use this default composition:

```text
form
└── FieldGroup
    ├── Field / FieldSet
    │   ├── FieldLabel / FieldLegend
    │   ├── control
    │   ├── FieldDescription
    │   └── FieldError
    └── action area
```

Rules:

- Use `FieldSet` and `FieldLegend` for related radio, checkbox, or grouped controls.
- Use `InputGroup` when an input has a meaningful prefix, suffix, unit, icon, or inline action.
- Use native select for simple, performance-sensitive, or mobile-friendly selection when it meets requirements.
- Use `Select` for a styled single selection list.
- Use `Combobox` when users need filtering/searching or a large option set.
- Use `Checkbox` for independent selections, `RadioGroup` for one-of-many, and `Switch` for an immediately applied on/off setting.
- Errors belong next to the field and must be programmatically associated.
- Do not use placeholder text as the only label.
- Disable submission only when necessary; preserve a visible explanation for unavailable actions.

## Data display

| Requirement | Preferred pattern |
|---|---|
| Simple static tabular data | `Table` with caption/head/body and correct header scopes |
| Sorting, filtering, selection, pagination, visibility | Composed `DataTable`, commonly with TanStack Table |
| Key-value metadata | Semantic definition list or compact `Item` composition |
| Small comparison | Table if values are truly tabular; otherwise aligned semantic content |
| Time series or quantitative visualization | `Chart` with accessible labels, units, and textual context |

Do not turn a table into unrelated cards solely to make it “modern.” On mobile, first consider horizontal scrolling or column prioritization while preserving header relationships.

## High-risk semantic confusions

- Tabs vs links: tabs switch panels in one task context; links navigate.
- Toggle vs button: a toggle has a persistent pressed state; a button performs an action.
- Menu vs select: menus expose actions; selects choose a value.
- Tooltip vs popover: tooltip is concise supplemental text; popover supports richer interactive content.
- Dialog vs alert dialog: alert dialog interrupts for a consequential decision.
- Card vs item: card is a meaningful standalone surface; item is a row in a related collection.
- Badge vs button: badge communicates status; it is not an unlabeled action.
- Skeleton vs spinner: skeleton preserves expected layout; spinner indicates brief indeterminate work.
