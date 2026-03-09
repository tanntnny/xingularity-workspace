# Beacon Vault User Guide

Beacon Vault is a local-first desktop notes app. Your notes and attachments are stored directly in a folder you choose on your machine.

## What Beacon Vault Is

- Desktop app built with Electron (not a web app)
- Markdown-first note taking with rich editing
- Local storage only (no cloud sync in the current build)
- Fast full-text search (title, body, tags)

## Vault Setup

When you open a vault folder, Beacon ensures this structure exists:

```text
<your-vault>/
  notes/
  attachments/
  .appmeta/
    vault.json
    filemap.json
    index.sqlite
```

How to open a vault in the app:

1. Open **Settings** in the left navigation.
2. Click **Change Vault Location**.
3. Select your vault folder.

The app also tries to restore your last opened vault automatically on startup.

## Daily Workflow

1. Create a note using the `+` button in the Notes header.
2. Type content in the editor (auto-saves after a short delay).
3. Add tags from the note header.
4. Use search to find notes quickly.
5. Switch to preview mode when you want to read rendered Markdown.

## Implemented Features

### Notes

- Create, open, rename, and delete Markdown notes (`.md`)
- Auto-save while editing
- Note list with:
  - filter (`All`, `Tagged`, `Untagged`)
  - sort (`Name`, `Updated`)
- Keyboard delete shortcut in note list: `Cmd/Ctrl + Backspace` (or Delete key combo)

### Editor

- Rich text editor powered by BlockNote
- Markdown is stored in files under `notes/`
- Obsidian-style mentions: type `[[` while writing to open note autocomplete
- Mention links are clickable in preview and open referenced notes
- Click note title to rename
- Tag management in note header:
  - add tag
  - remove tag
  - click tag to search by that tag
- Edit/Preview toggle

### Attachments & Images

- Drag and drop a file into the editor to import into `attachments/`
- Paste an image from clipboard to save and embed it in the note
- Image links are stored as vault-relative Markdown paths

### Search

- Search box in Notes header
- Full-text search over note title, content, and tags
- Click result to open the note

### Command Palette

- Open with `Cmd/Ctrl + P`
- Quick actions:
  - New Note
  - Focus Search
  - Open a note by path

### Calendar

- Monthly calendar view
- Add tasks for a selected date
- Mark tasks complete/incomplete
- Delete tasks
- Task counts are shown on calendar days

### Settings

- Change app font family
- Reset font from header action
- View current vault location
- Change vault location

## Features In Implementation (Not Fully Available Yet)

The UI already exposes these areas, but they are currently placeholders or marked as coming soon:

- **Projects page** (`Projects` nav): placeholder workspace blocks (`Active Projects`, `Milestones`, `Backlog`)
- **Resources page** (`Resources` nav): placeholder blocks (`Reference Links`, `Attachments`, `Templates`)
- **Projects header actions**:
  - `New Project` -> shows "coming soon"
  - `Roadmap` -> shows "coming soon"
- **Resources header actions**:
  - `Add Link` -> shows "coming soon"
  - `Upload` -> shows "coming soon"
- **Note actions**:
  - `Share` -> shows "Share feature coming soon"
  - `Favorites` -> shows "Favorites feature coming soon"

## Current Limitations

- No cloud sync/account system in current build
- No collaboration/sharing yet (Share is in implementation)
- Notes are Markdown files only
- Favorites system is not implemented yet

## Keyboard & Interaction Cheatsheet

- `Cmd/Ctrl + P`: open command palette
- Click note title: rename note
- `Enter` while renaming/tagging: confirm
- `Esc` while renaming/tagging: cancel

## Where Data Lives

- Notes: `notes/**/*.md`
- Attachments: `attachments/*`
- Search index and metadata: `.appmeta/*`
- App UI settings (font, last vault, calendar tasks): stored in app user data (`settings.json`)
