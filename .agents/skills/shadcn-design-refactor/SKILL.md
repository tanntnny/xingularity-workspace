---
name: shadcn-design-refactor
description: Audit and refactor existing React, Next.js, Vite, or Electron-renderer interfaces into coherent, accessible, maintainable shadcn/ui-first product UIs. Use for frontend cleanup, UI redesign, design-system migration, component standardization, semantic HTML/accessibility fixes, dashboard/settings/form/table/navigation refactors, or requests to use shadcn/ui aggressively. Do not use for backend-only work, a tiny isolated CSS correction, or greenfield implementation unless the user explicitly asks for a refactor or design-system pass.
---

# Shadcn Design Refactor

Refactor an existing interface into a polished, coherent product UI using shadcn/ui aggressively while preserving behavior and respecting the repository's architecture.

“Aggressive shadcn usage” means:

- Replace hand-rolled interactive controls and repeated UI patterns with appropriate shadcn/ui components.
- Follow documented shadcn composition structures instead of approximating them.
- Build product-specific components by composing primitives.
- Keep native semantic HTML for document structure and simple layout.
- Do not wrap every block in `Card`, replace every `div`, or force a component where plain HTML is more correct.

## Core contract

1. Preserve routes, data contracts, business rules, permissions, and user-visible behavior unless the user explicitly requests a behavior change.
2. Improve semantics, accessibility, visual hierarchy, interaction consistency, responsiveness, and code maintainability together; do not treat the task as cosmetic CSS cleanup.
3. Work from the installed project configuration and current component documentation, not remembered APIs.
4. Implement the refactor unless the user requests an audit only.
5. Keep the change set scoped to the requested interface. Do not opportunistically redesign unrelated routes.

## Use the official shadcn context

When available, use the official `shadcn/ui` skill alongside this skill.

At the beginning of each task:

1. Read repository instructions such as `AGENTS.md` and relevant nested instruction files.
2. Inspect `package.json`, `components.json`, global CSS, route/layout files, and the local `components/ui` directory.
3. Detect the package manager from lockfiles and use it consistently.
4. Run the equivalent of:

   ```bash
   pnpm dlx shadcn@latest info --json
   ```

5. Record the framework, Tailwind version, shadcn style, base library (`base`, `radix`, or `aria`), aliases, icon library, RSC setting, RTL setting, installed components, and resolved paths.
6. Before adding or materially composing a component, use current project-aware documentation:

   ```bash
   pnpm dlx shadcn@latest docs <component>
   pnpm dlx shadcn@latest search @shadcn -q "<query>"
   pnpm dlx shadcn@latest view <item>
   ```

Adapt commands to the repository package manager. Never mix APIs from Base UI, Radix UI, and React Aria variants.

If `components.json` is absent, determine whether shadcn is already present before initializing it. Do not silently reinitialize or overwrite an existing design system.

## Refactoring workflow

### 1. Establish the baseline

Inspect the rendered interface when browser tooling is available. Test at representative mobile, tablet, and desktop widths.

Inventory:

- Page purpose and primary user task.
- Information hierarchy and navigation model.
- Existing reusable primitives and domain components.
- Repeated visual patterns.
- Hand-rolled controls, overlays, menus, forms, tables, and status states.
- Hardcoded colors, arbitrary spacing, inconsistent radii, duplicate class strings, and one-off variants.
- Missing loading, empty, error, success, disabled, pending, and permission states.
- Keyboard, focus, labeling, heading, landmark, and responsive defects.
- Existing behavior that must not regress.

Do not start with arbitrary restyling. Identify the interaction model and semantic structure first.

### 2. Create a compact refactor map

Before editing, state or internally track:

- Target files and interface scope.
- Existing pattern → intended shadcn/native replacement.
- Components to add.
- Components to compose at the domain level.
- Tokens or variants to normalize.
- Behavior and data flow that must remain unchanged.
- Verification commands and browser scenarios.

Prioritize in this order:

1. Broken semantics or behavior.
2. Accessibility and interaction correctness.
3. Component composition and architecture.
4. Responsive structure and state coverage.
5. Visual consistency and polish.

### 3. Refactor in coherent passes

#### Pass A — Semantic structure

- Use one meaningful `<main>` per page shell.
- Use `<header>`, `<nav>`, `<aside>`, `<section>`, `<article>`, `<footer>`, lists, tables, and forms according to purpose.
- Use headings to express hierarchy; do not choose heading levels for font size.
- Use links for navigation and buttons for actions.
- Use native elements before adding ARIA. Add ARIA only when native semantics are insufficient.
- Give every form control an accessible label.
- Use `fieldset`/`legend` or shadcn `FieldSet`/`FieldLegend` for related controls.
- Preserve logical DOM and tab order. Do not use CSS ordering to create a misleading focus sequence.
- Icon-only controls require an accessible name and usually a tooltip.
- Decorative icons must not be announced.
- Dialogs require a meaningful title; include a description when it clarifies the task.

#### Pass B — Primitive replacement

Replace custom interactive UI with the closest documented shadcn composition. Read `references/component-selection.md` when selecting components or reviewing ambiguous UI semantics.

Strong defaults:

- Forms: `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldSet`, `FieldLegend` plus the appropriate control.
- Content rows: `Item`/`ItemGroup`, not repeated mini-cards.
- Related actions: `ButtonGroup`.
- Mutually exclusive display options: `ToggleGroup`, `RadioGroup`, or `Tabs` according to semantics.
- Data: `Table` for simple static tables; a composed `DataTable` for sorting, filtering, selection, pagination, or column state.
- Empty/loading: `Empty`, `Skeleton`, and `Spinner` according to duration and layout stability.
- Persistent feedback: inline `Alert`; transient completion feedback: `Sonner`/toast.
- Destructive confirmation: `AlertDialog`.
- Focused modal task: `Dialog`; mobile or edge-attached secondary panel: `Sheet` or the project’s documented drawer pattern.
- Navigation: `Sidebar`, `Breadcrumb`, `NavigationMenu`, `Pagination`, or ordinary links according to the information architecture.

Do not install or use a component merely because it exists. Every component must express a real interaction or content pattern.

#### Pass C — Visual system normalization

- Use semantic theme tokens such as `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, and `ring`.
- Prefer utilities such as `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, and `ring-ring` over hardcoded palette values.
- Add a product-specific semantic token only when the concept is stable and reused, such as `success`, `warning`, or `brand`; define light and dark values together.
- Preserve existing brand identity unless the user requests a new visual direction.
- Use the repository spacing scale. Remove unnecessary arbitrary pixel values.
- Use the configured radius token; do not invent unrelated radii per component.
- Prefer border, spacing, typography, and surface contrast for hierarchy. Use shadows sparingly.
- Avoid “card soup.” A `Card` should represent a meaningful independent surface, grouping, or summary—not every section.
- Keep one visually dominant primary action per region. Demote secondary actions with `secondary`, `outline`, `ghost`, or link treatment.
- Keep icon size, stroke family, button height, input height, and control density consistent with the installed shadcn style.
- Use the configured icon library. Do not mix icon families without a migration decision.
- Avoid decorative gradients, excessive pills, saturated background blocks, and animation that does not communicate state.
- For long rendered HTML or Markdown, consider the project-compatible shadcn typeset system; do not apply prose styling to application controls.
- Verify dark mode whenever the project supports it.

#### Pass D — Component and coding architecture

- Keep `components/ui` for shadcn primitives and low-level design-system extensions.
- Put composed business UI in feature or domain directories, for example `components/projects`, `features/billing`, or the repository’s established equivalent.
- Do not place API calls, domain orchestration, or page-specific business rules inside generic UI primitives.
- Compose primitives instead of creating large prop-driven “god components.”
- Prefer slots/subcomponents and `children` over boolean prop explosions.
- Use CVA or the repository’s variant utility for stable reusable visual variants.
- Use `cn()` for class merging and conditional classes; do not use it to hide an unstructured wall of unrelated styles.
- Extract repeated domain patterns when repetition is real. Do not create wrapper components that only rename a shadcn component without adding semantics, policy, or reusable behavior.
- Follow repository export and naming conventions. Use intent-revealing names such as `ProjectStatusBadge`, not `BlueBadge`.
- Keep TypeScript types explicit at component boundaries. Avoid `any` and unsafe casts introduced for convenience.
- Keep client boundaries narrow in Next.js. Do not add `"use client"` to a large server-renderable subtree merely because one child is interactive.
- Preserve the existing form, validation, data-fetching, and table stack unless migration is part of the request.
- Avoid redundant or contradictory state. Derive values during render when possible.
- Use effects only to synchronize with external systems, not to mirror props or calculate render data.
- Lift shared state to the closest common owner; do not duplicate selection, open, filter, or pending state across components.
- Use stable keys from data, not array indexes when identity matters.

#### Pass E — Complete the interaction states

For each affected surface, explicitly account for applicable states:

- Initial loading.
- Background refresh or pending mutation.
- Empty data.
- No search results.
- Validation error.
- Request or system error with recovery action.
- Disabled and read-only.
- Success or completion.
- Destructive confirmation.
- Missing permission or unavailable action.
- Long labels, large values, and overflow.

Keep layout stable during loading. Skeletons should approximate the final structure rather than show arbitrary gray rectangles.

#### Pass F — Responsive behavior

- Use mobile-first layout decisions.
- Let hierarchy determine stacking and collapse behavior; do not merely shrink the desktop UI.
- Keep touch targets practical and controls reachable.
- Move secondary desktop panels into an appropriate `Sheet`/drawer pattern on small screens when needed.
- Preserve tables as real tables. Use deliberate horizontal scrolling, column prioritization, or an alternative mobile representation only when semantics remain clear.
- Avoid accidental page-level horizontal overflow.
- Check narrow widths, zoomed text, long content, and empty states.

## Verification requirements

Run the repository’s relevant checks:

- Formatting.
- Linting.
- Type checking.
- Unit/component tests.
- Build.

When browser tooling is available, verify:

- No console or hydration errors.
- Primary user flow still works.
- Keyboard-only navigation.
- Visible focus states.
- Correct Enter, Space, Escape, arrow-key, and tab behavior for affected controls.
- Dialog focus entry, containment, close behavior, and focus return.
- Mobile, tablet, and desktop layouts.
- Light and dark themes when supported.
- Loading, empty, error, and destructive paths.

Use an automated accessibility check when the repository already supports one, but do not treat it as a replacement for keyboard and semantic inspection.

Read `references/review-rubric.md` before finalizing a substantial refactor. Resolve all blocker failures and target the passing score.

## Final report

Provide a compact implementation report containing:

1. Scope completed.
2. Key semantic and design decisions.
3. shadcn components added or replaced.
4. Component architecture changes.
5. Behavior intentionally preserved.
6. Checks and browser scenarios actually run, with results.
7. Remaining limitations or follow-up items.

Never claim a test, build, browser check, or accessibility check was completed unless it was actually run.
