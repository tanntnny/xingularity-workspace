# Xingularity App Feature Documentation

This document describes the current user-facing features and UI structure of the Xingularity desktop app.

## Product Overview

Xingularity is a local-first Electron application for Markdown notes, lightweight project tracking, and task planning.

- Notes and attachments are stored in a vault folder on the local machine.
- Search is full-text and local.
- Core navigation uses a left sidebar with a center workspace and a right utility panel.

## Primary Layout

The app uses a three-panel layout:

1. Left Sidebar (global navigation)
2. Center Workspace (active page content)
3. Right Panel (contextual tools/lists)

### Header Alignment Standard

All three top headers are visually aligned.

- Fixed height: `80px`
- Bottom border visible: `border-b`
- Shared panel style with app surface color and consistent spacing

This provides a continuous horizontal rhythm across sidebar, workspace, and right panel.

## Sidebar Structure

The sidebar is collapsible and follows this row order:

1. `Xingularity` text with collapse button in the same row
2. Subtext: `All-in-one Application` (lower emphasis)
3. Divider
4. Welcome text: `Welcome back, {profileName}`
5. Status text: `Status: Synced`
6. Divider
7. Remaining sidebar menu items

### Sidebar Behavior

- Collapse control is always available.
- In collapsed icon mode, non-essential text rows are hidden.
- Menu icons remain visible and navigable.
- Notes menu can show a count badge (capped display: `99+`).

## Navigation Pages

### Home Section

- Notes
- Projects
- Calendar

### Documents Section

- Data Library (Resources)

### Footer

- Settings

## Notes Features

- Create, open, rename, and delete notes
- Markdown editing with auto-save
- Preview mode toggle
- Export note action
- Tag add/remove and tag-based discovery
- Mention support (`[[note]]`) with link navigation
- Note count badge in sidebar

## Search and Command Features

- Note search from right panel header
- Project search from right panel header
- Command palette (`Cmd/Ctrl + P`) for quick actions

## Calendar Features

- Month-based planning view
- Unscheduled task list
- Add task from right panel header input
- Mark complete, rename, delete, reprioritize, and reschedule tasks

## Projects Features

- Project list and selection
- Project creation and deletion
- Milestones and subtasks management
- Status and progress derivation
- Project icon customization (shape/style/color)

## Settings Features

- Profile name update
- Font family selection and reset
- Vault location management

## Current UX Notes

- The sidebar brand area is the fixed-height header region.
- Welcome and status content intentionally stays below the header.
- Workspace and right panel headers share the same fixed-height + bottom-border treatment.
