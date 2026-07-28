---
name: xingularity-renderer-ui
description: Build, revise, or review Xingularity’s React renderer UI, including pages, workspace panels, navigation, forms, lists, dialogs, and interaction polish. Use when work touches src/renderer/src, Tailwind classes, shared UI primitives, accessibility, responsive layout, or renderer-focused tests.
---

# Xingularity Renderer UI

Keep UI changes native to Xingularity’s existing React, Radix, Tailwind, and workspace component system. Prefer a coherent nearby pattern over a new one-off primitive.

## Workflow

1. Inspect the target page plus adjacent components and the relevant primitive in `src/renderer/src/components/ui/` before changing layout or controls.
2. Reuse existing primitives and shared workspace components. Add a primitive only when no existing one owns the interaction.
3. Keep app-wide UI in Inter; reserve monospace for code and terminal content.
4. Use `p-2` only for the page’s main content container. Do not use it as incidental spacing in nested panels or controls.
5. Use `WorkspaceIconButton` for every top-bar action so top-bar controls retain a consistent shape, label treatment, and icon size.
6. Preserve keyboard access, visible focus, semantic labels, and dialog/menu behavior supplied by the existing Radix primitives.
7. Normalize nearby color, borders, rounding, and spacing to match the surrounding feature. Avoid standalone visual styles.
8. Update the closest unit test for pure UI logic or the narrowest relevant Playwright spec only when the workflow requires browser-level coverage.

## Layout and State Checks

- Keep page-specific state in the existing renderer state/hook boundary; call privileged work through `window.vaultApi` only.
- Test empty, loading, error, and populated states whenever the component owns them.
- Preserve resize behavior in the three-column workspace shell and avoid hard-coding widths that obstruct narrower windows.
- Use stable labels, roles, or test IDs consistent with nearby e2e conventions; do not add brittle structural selectors.

## Completion Standard

Confirm the change uses existing primitives where appropriate, satisfies the project UI rules, maintains keyboard accessibility, and has proportionate targeted verification.
