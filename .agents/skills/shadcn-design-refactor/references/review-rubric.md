# Shadcn Refactor Review Rubric

Use this rubric before finalizing a substantial UI refactor.

Score each criterion:

- `0` — missing, incorrect, or regressed.
- `1` — partly addressed or inconsistent.
- `2` — complete and consistent for the changed scope.

Maximum score: 40. Target: at least 34, with no blocker failure.

## Blockers

The refactor does not pass if any applicable blocker remains:

- Primary user flow is broken.
- Typecheck or build fails because of the change.
- An interactive control is inaccessible by keyboard.
- A clickable non-semantic element replaces a native link/button without equivalent behavior.
- A dialog lacks an accessible name, traps users, or fails to return focus appropriately.
- Form controls lack labels or errors are not associated with controls.
- Destructive action became easier to trigger accidentally.
- Page has unintended horizontal overflow at common mobile widths.
- Text or controls become unreadable in a supported theme.
- The implementation mixes incompatible shadcn base APIs.

## Scored criteria

### Semantics and accessibility — 10 points

1. Landmarks, headings, lists, tables, and form structure express the actual content hierarchy.
2. Links, buttons, toggles, tabs, menus, and selects match their interaction semantics.
3. Labels, names, descriptions, and error relationships are complete.
4. Keyboard order, focus visibility, overlay focus behavior, and key interactions are correct.
5. Color, icons, hover, or position are not the sole means of communicating meaning.

### shadcn composition — 8 points

6. Hand-rolled interactive patterns were replaced with appropriate installed/documented shadcn components.
7. Component composition follows the current base-specific documentation.
8. Components were selected by intent rather than visual resemblance.
9. The UI avoids component abuse such as card soup, excessive dialogs, or tooltips containing essential content.

### Visual system — 8 points

10. Semantic theme tokens replace hardcoded recurring colors.
11. Spacing, radius, control sizing, typography, and icon treatment are consistent.
12. Hierarchy is clear through typography, spacing, surfaces, and action emphasis.
13. Light/dark and brand behavior remain coherent for the changed scope.

### State and responsive UX — 6 points

14. Applicable loading, pending, empty, no-results, error, disabled, success, and permission states are handled.
15. Layout remains stable and comprehensible while data changes.
16. Mobile, tablet, desktop, long-content, and overflow behavior are deliberate.

### Code architecture — 6 points

17. Generic primitives remain separate from domain components and business logic.
18. Reuse is meaningful; duplicate patterns are reduced without premature abstraction.
19. State is minimal, non-duplicated, and effects are limited to external synchronization.

### Verification and scope — 2 points

20. Relevant automated checks and browser scenarios were actually run and accurately reported; unrelated scope was not changed.

## Review output

Include the score as:

```text
Rubric: 36/40 — Pass
Blockers: none
Weakest areas: responsive long-label handling; one legacy hardcoded chart color retained
```

Do not inflate the score. A score is useful only when tied to observed evidence.
