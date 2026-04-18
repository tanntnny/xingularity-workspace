# Subscriptions Page — UX/UI + Implementation Plan

## Goal

Design and implement the **Subscriptions** page as the first page inside the new Finance section.

This page should:
- fit naturally inside the existing Xingularity app shell
- respect the persistent **left global sidebar**
- prioritize a **treemap** as the main visual for recurring spend
- support fast review, renewal awareness, and cancellation decisions
- follow the current local-first Electron + React architecture

---

## 1) Context and constraints from the current app

The current app already has:
- a persistent set of top-level pages in the main navigation
- renderer-side page routing
- a preload bridge (`window.vaultApi`) that proxies to validated IPC handlers
- local JSON-backed app-managed state in `.xingularity/`
- a local-first, single-user workspace model

The new page should therefore behave like a **native app page**, not like an embedded finance dashboard from another product.

### Important design consequence

Do **not** build the page as:
- a full-bleed standalone dashboard
- a right-sidebar-heavy analytics screen
- a page that assumes no surrounding navigation chrome

Instead, build it for a layout where:
- the **left global sidebar is always present**
- the content area must remain readable even with reduced width
- the main information hierarchy is visible without needing multiple side panels

---

## 2) Product role of this page

This page is not just a list of subscriptions.

It should answer these questions quickly:

1. **How much recurring money am I spending?**
2. **What categories dominate the spend?**
3. **What renews soon?**
4. **Which subscriptions are likely wasteful or duplicated?**
5. **What should I cancel, downgrade, or review?**

That means the page needs both:
- **analysis**
- **actionability**

---

## 3) Page information architecture

## Primary layout zones

### A. Header row
Contains:
- page title: `Subscriptions`
- optional breadcrumb or Finance section label
- search input
- filter button
- add subscription button
- import button (later phase)

### B. KPI summary row
4 compact cards:
- **Monthly recurring**
- **Yearly recurring**
- **Renewing in 30 days**
- **Needs review**

These cards should stay small and dense. They are support context, not the hero.

### C. Main analytics area
Two-column layout:

- **Main column (dominant width):** Treemap
- **Secondary column:** Renewal / Review panel

This gives the page a clear focal point and avoids crowding the treemap.

### D. Supporting list area
Below analytics:
- subscriptions table/list
- sortable and filterable
- serves as precise operational view after the treemap gives context

---

## 4) Recommended desktop layout

Because the left global sidebar already consumes horizontal space, use a **content-maximizing center layout**.

### Width strategy
- global sidebar remains fixed on the far left
- page content uses the rest of the viewport
- keep page content padded, but not over-padded
- avoid giant margins; the page must work on laptop widths

### Suggested page shell
- outer content padding: `px-5` to `px-6`
- vertical spacing: moderate, not airy
- content max width: optional, but do **not** clamp too narrowly
- prioritize usable chart width

---

## 5) UX behavior principles

## Principle 1: Treemap first, but not treemap only
The treemap is the primary visual because it answers:
- where recurring spend is concentrated
- category-to-service relationships
- relative weight quickly

But the user must also have:
- a precise list/table
- a renewal timeline or queue
- clear row-level actions

## Principle 2: Category → service hierarchy
Treemap should reflect hierarchy:
- level 1: category
- level 2: service/provider

Example:
- AI Tools
  - ChatGPT
  - Claude
  - Perplexity
- Streaming
  - Netflix
  - Spotify
- Developer Tools
  - Vercel
  - GitHub
  - Raycast

This makes the chart far more useful than a flat “all subscriptions” view.

## Principle 3: Use color for status, not decoration
Treemap colors should carry meaning:
- normal / active
- renewing soon
- flagged for review
- unused / low-value
- cancelled / paused (if shown)

Avoid overusing many unrelated category colors if they make status harder to perceive.

## Principle 4: Actionable right rail, not a generic details panel
The secondary panel should focus on:
- upcoming renewals
- suspected waste
- duplicate tools
- high-cost annual renewals
- selected item details when user clicks a treemap node or row

This panel should feel operational.

## Principle 5: Table is where real work happens
Treemap shows patterns.
Table is where the user edits, sorts, filters, and makes decisions.

---

## 6) Core page sections

## 6.1 Header

### Left side
- `Subscriptions` title
- optional muted sublabel: `Recurring services and renewals`

### Right side actions
- search field
- category/status filters
- `Add subscription`
- overflow menu for future actions:
  - import CSV
  - normalize yearly to monthly
  - export
  - show archived

### Why this matters
Header actions should be enough to manage the whole page without introducing a second top toolbar.

---

## 6.2 KPI cards

Use 4 horizontally aligned cards.

### Card 1 — Monthly recurring
Primary number:
- normalized monthly spend

Secondary text:
- `% change vs last month` (future)
- or `X active subscriptions`

### Card 2 — Yearly recurring
Primary number:
- estimated yearly recurring total

Secondary text:
- count of annual plans

### Card 3 — Renewing in 30 days
Primary number:
- count of subscriptions renewing soon

Secondary text:
- total amount at risk

### Card 4 — Needs review
Primary number:
- count flagged as review / unused / duplicated

Secondary text:
- potential monthly savings

### Card style
- compact
- low visual weight
- not overly decorative
- numbers large enough for quick scanning

---

## 6.3 Treemap area

This is the hero component.

### Chart behavior
Each rectangle represents a subscription.
Grouped within a category block.

### Size encoding
- rectangle size = monthly-equivalent spend

### Color encoding
Recommended:
- neutral/default for active
- warning for renew soon
- muted-danger for flagged waste
- subdued for paused/cancelled

Alternative:
- category hue + status border/accent

### Interactions
- hover → tooltip
- click → select service and populate right panel
- click category header/block → filter table to that category
- double click optional → isolate category

### Tooltip fields
- service name
- category
- billing cycle
- monthly-equivalent amount
- next renewal date
- status
- notes count if any

### Empty state
If there are no subscriptions:
- show an empty chart placeholder
- CTA to add first subscription
- optional sample diagram ghost layout

---

## 6.4 Right-side panel

This should not be a permanent generic inspector.
It should switch between focused modes.

### Default mode
Show 2 stacked blocks:
1. **Renewing soon**
2. **Review / savings opportunities**

### Selected-item mode
When a treemap item or table row is selected, show:
- service name
- category
- amount
- cycle
- next renewal
- payment source (optional)
- status
- tags
- notes
- actions:
  - edit
  - mark review
  - archive
  - cancel note
  - duplicate check

### Why this is good
The page stays useful even without a selection, but becomes inspectable when the user drills down.

---

## 6.5 Subscriptions table

Place below the chart area.

### Recommended columns
- Name
- Category
- Status
- Cost
- Billing cycle
- Monthly-equivalent
- Next renewal
- Last used
- Review flag
- Actions

### Behavior
- sortable by cost, next renewal, category, status
- searchable
- filterable
- row click selects item
- inline quick actions optional for later

### Default sort
- flagged items first
- then nearest renewal date
- then highest normalized monthly cost

That default makes the page operational immediately.

---

## 7) Suggested filters

Use lightweight filters above chart/table or in a filter popover.

### Core filters
- Active / Paused / Cancelled / Archived
- Renewing in 7 / 30 / 90 days
- Category
- Billing cycle: monthly / yearly
- Review status
- Shared / personal / work (later)
- High cost only

### Useful toggle
- `Normalize yearly to monthly`

This is important because the treemap becomes misleading if annual and monthly plans are shown without normalization.

---

## 8) Page states

## Empty state
Show:
- simple explanation
- add subscription CTA
- optional CSV import CTA
- maybe 2–3 example categories visually ghosted

## Populated default state
Show:
- KPI cards
- treemap
- right panel with renewals/review
- table

## Selected state
Show:
- selected treemap tile highlighted
- right panel with item details
- table filtered or highlighted

## Filtered state
Show:
- active filters as chips
- one-click clear all

## Narrow-width / compact state
If available width is reduced because of window size + sidebar:
- KPI cards wrap to 2x2
- treemap remains first
- right panel moves below treemap
- table stays full width below

Do not force a cramped 3-column layout.

---

## 9) Recommended visual hierarchy

Order of attention should be:

1. page title + add action
2. KPI cards
3. treemap
4. renewal/review rail
5. subscription table

This order keeps the page balanced:
- summary first
- pattern detection second
- action execution third

---

## 10) ASCII UI sketch

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Global Sidebar │  Subscriptions                                              [Search____]  │
│                │  Recurring services and renewals                    [Filter] [Add] [⋯]    │
│ Notes          ├──────────────────────────────────────────────────────────────────────────────┤
│ Projects       │  [Monthly Recurring] [Yearly Recurring] [Renew in 30d] [Needs Review]     │
│ Calendar       ├──────────────────────────────────────────────────────────────────────────────┤
│ Weekly Plan    │                                                                              │
│ Finance        │  ┌───────────────────────────────────────────────┐  ┌────────────────────┐  │
│  - Overview    │  │                                               │  │ Renewing soon       │  │
│  - Portfolio   │  │                 TREEMAP                       │  │ • Netflix - Apr 12  │  │
│  - Subscriptions│ │         Category → Service spend map          │  │ • ChatGPT - Apr 18  │  │
│  - Cashflow    │  │                                               │  │ • Vercel - Apr 20   │  │
│ Schedules      │  │                                               │  ├────────────────────┤  │
│ Agent Chat     │  │                                               │  │ Needs review        │  │
│ Settings       │  └───────────────────────────────────────────────┘  │ • Perplexity        │  │
│                │                                                     │ • Duplicate AI tool │  │
│                ├─────────────────────────────────────────────────────┴────────────────────┤  │
│                │ [Filter chips: Active] [AI Tools] [Renew <30d] [Clear all]               │  │
│                ├───────────────────────────────────────────────────────────────────────────┤  │
│                │ Name       Category      Status    Cost   Cycle   Monthly Eq  Renewal  ⋯ │  │
│                │ ChatGPT    AI Tools      Active    20     Month   20          Apr 18   ⋯ │  │
│                │ Netflix    Streaming     Active    15     Month   15          Apr 12   ⋯ │  │
│                │ Vercel     Dev Tools     Active    240    Year    20          Apr 20   ⋯ │  │
│                │ ...                                                                       │  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 11) Interaction logic

## Primary flows

### Flow A — Review recurring spend
1. User opens page
2. Scans KPI cards
3. Reads treemap concentration
4. Notices dominant category or oversized tile
5. Clicks tile
6. Sees details in right panel and matching row in table

### Flow B — Review upcoming renewals
1. User looks at right panel
2. Sees upcoming renewals
3. Clicks one item
4. Table highlights the row
5. User edits plan, flags review, or archives/cancels later

### Flow C — Find waste
1. User applies filter `Needs review`
2. Treemap and table both update
3. Right panel shows potential savings
4. User marks some entries as keep/cancel/archive

### Flow D — Add a subscription
1. Click `Add subscription`
2. Modal or side sheet opens
3. User enters details
4. Save
5. KPI cards, treemap, table, and renewal panel update immediately

---

## 12) Add / edit form design

Use a **modal** first, not a dedicated full page.

### Fields
- Name
- Category
- Provider
- Amount
- Currency
- Billing cycle
- Monthly-equivalent (derived, read-only)
- Next renewal date
- Status
- Last used date (optional)
- Tags
- Notes
- Shared / work / personal (later)
- Review flag

### Form behavior
- validate required fields
- derive normalized monthly cost automatically
- if yearly selected, show small helper text:
  - `Shown as X/month in analytics`
- warn if same provider + same category may be duplicate

---

## 13) Data model proposal

Store finance subscriptions as app-managed local state, similar to other structured entities.

## Entity: `SubscriptionRecord`

```ts
type SubscriptionStatus = "active" | "paused" | "cancelled" | "archived";
type BillingCycle = "monthly" | "yearly" | "quarterly" | "custom";

type SubscriptionRecord = {
  id: string;
  name: string;
  provider?: string;
  category: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  billingIntervalMonths: number; // derived or explicit for custom cycles
  normalizedMonthlyAmount: number;
  nextRenewalAt?: string; // ISO date
  status: SubscriptionStatus;
  reviewFlag?: "none" | "review" | "unused" | "duplicate" | "expensive";
  lastUsedAt?: string; // ISO date
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

### Storage suggestion
Use:
- `.xingularity/subscriptions.json`

This aligns with the current pattern of app-managed JSON state.

---

## 14) Derived analytics model

The renderer should consume precomputed or memoized derived values such as:

```ts
type SubscriptionAnalytics = {
  totalMonthlyRecurring: number;
  totalYearlyRecurring: number;
  renewingSoonCount: number;
  renewingSoonAmount: number;
  reviewCount: number;
  potentialSavingsMonthly: number;
  treemapNodes: Array<{
    id: string;
    name: string;
    value: number;
    category: string;
    status: string;
    renewalBucket?: "soon" | "later";
  }>;
};
```

### Recommendation
Keep raw CRUD separate from analytics derivation.
This makes UI logic cleaner and easier to test.

---

## 15) Suggested API boundary

The app currently uses preload domains and validated IPC boundaries.
For subscriptions, add a dedicated domain instead of overloading settings.

## New preload domain
`subscriptions`

### Proposed methods
- `list()`
- `get(id)`
- `create(input)`
- `update(id, patch)`
- `delete(id)`
- `archive(id)`
- `getAnalytics(filters?)`

### Why a dedicated domain is better
- clearer than stuffing finance records inside generic settings
- easier to evolve later into portfolio/cashflow domains
- matches the current app architecture style

---

## 16) Component architecture

## Page-level components
- `SubscriptionsPage`
- `SubscriptionsHeader`
- `SubscriptionsKpiRow`
- `SubscriptionsTreemapCard`
- `SubscriptionsRightPanel`
- `SubscriptionsTable`
- `SubscriptionFormModal`
- `SubscriptionFilterBar`

## Hooks / view model
- `useSubscriptionsPageState`
- `useSubscriptionFilters`
- `useSubscriptionAnalytics`
- `useSubscriptionSelection`

## Utility helpers
- `normalizeSubscriptionAmount`
- `getRenewalBucket`
- `buildTreemapNodes`
- `calculatePotentialSavings`

---

## 17) Treemap library guidance

Choose a React-friendly chart library that supports hierarchical rectangles and responsive layout.

### Good fit
- `@nivo/treemap`

Why:
- React-native API style
- good support for hierarchical data
- easy tooltip customization
- strong fit for dashboard-style charting

### Alternative
- `recharts` does not provide as strong a treemap experience for this use case
- custom D3 is possible but heavier than needed for v1

### Recommendation
Use `@nivo/treemap` for v1.

---

## 18) State management guidance

For first version:
- page-local state + React Query style fetch pattern if already used
- or simple custom hooks if the app uses direct preload calls without a data cache library

Keep it simple:
- fetch subscriptions
- derive analytics in memoized selectors
- keep filters/selection local to page state

Do **not** introduce heavy global state unless the rest of the app already relies on it.

---

## 19) UX details worth getting right

- clicking treemap category filters the list
- clicking treemap leaf selects the item
- search should match name, provider, category, tags
- renewal dates should show both relative and absolute forms
- yearly plans should always be normalized for analytics
- allow archived items to be hidden by default
- filter chips should be removable individually
- table rows should support keyboard navigation later

---

## 20) Responsive behavior

### Large desktop
- KPI row in 4 columns
- treemap and right rail side by side
- full table below

### Medium desktop / laptop
- KPI cards wrap if needed
- treemap remains above
- right rail narrows but stays usable
- table below full width

### Narrow width
- right rail collapses below treemap
- actions remain in header
- table becomes horizontally scrollable if necessary

Avoid:
- shrinking the treemap too much
- keeping a thin unusable right rail
- forcing too many columns in one row

---

## 21) Suggested implementation phases

## Phase 1 — Core page shell
- route and page registration
- static page layout
- header
- KPI cards with mock data
- treemap placeholder
- table placeholder
- right rail placeholder

## Phase 2 — Data layer
- add subscription data store
- preload + IPC methods
- CRUD operations
- JSON persistence

## Phase 3 — Working analytics UI
- derive KPI values
- render treemap
- render renewal list
- table sorting/filtering
- selection sync between chart/table/right panel

## Phase 4 — Add/edit workflows
- modal form
- validation
- create/update/delete/archive
- optimistic refresh

## Phase 5 — Polish
- empty states
- keyboard polish
- import/export
- smarter review heuristics
- animation and micro-interactions

---

## 22) Acceptance criteria

The page is complete enough for v1 when:

- user can open `Subscriptions` from the Finance section
- page works with the persistent left global sidebar
- KPI cards display correct aggregate values
- treemap renders grouped recurring spend by category/service
- right panel shows upcoming renewals and selected item details
- table supports sort, search, and filter
- user can add, edit, archive, and remove subscriptions
- yearly subscriptions are normalized for analytics
- page remains usable on laptop widths
- data persists locally through app reload

---

## 23) Recommended route + nav behavior

## Global sidebar
Add:
- `Finance`

## Finance local nav
Inside Finance section:
- Overview
- Portfolio
- **Subscriptions**
- Cashflow

If v1 only has one finance page, route directly to:
- `/finance/subscriptions`

Later, add Finance section tabs/subnav without redesigning the page.

---

## 24) Suggested engineering tasks for the AI agent

1. Create route/page scaffold for `SubscriptionsPage`
2. Add Finance nav item and local subnav support
3. Create mock page layout using app shell constraints
4. Build KPI cards and filter chips
5. Add Nivo treemap with static hierarchical demo data
6. Create right rail with renewing soon + review sections
7. Create subscriptions table
8. Define `SubscriptionRecord` types
9. Add preload/API domain for subscriptions
10. Add main-process service/store using `.xingularity/subscriptions.json`
11. Wire real data to page
12. Add create/edit modal
13. Add filtering, sorting, and selection state
14. Add empty states and archived toggle
15. Refine spacing for left-sidebar-aware layout

---

## 25) Final recommendation

For Xingularity, the strongest v1 is:

- **one clean subscription management page**
- **treemap as hero**
- **right rail for renewals and review**
- **table for exact operations**
- **local-first structured state**
- **no extra visual clutter**
- **designed around the existing global sidebar**

This will feel like a native extension of the current app rather than a separate finance product.
