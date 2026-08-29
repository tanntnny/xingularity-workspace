# Centralize the workspace without absorbing every tool

Status: in-progress

Research snapshot: 2026-08-20

This document explores how Xingularity could become the place where work is
understood and coordinated across Google Workspace, Xingularity notes and
projects, and the macOS file system. It is a product and architecture proposal,
not a commitment to implement every integration described here.

## Implementation status

The first implementation slice now establishes the context layer without
changing source ownership:

* typed resource references, device-specific locators, relations, lifecycle
  states, and vault-scoped feature flags;

* migration of legacy `project.resources` values into typed references while
  preserving the original values for compatibility;

* selected local file/folder and URL resources with metadata, previews for
  explicitly enabled text files, open/reveal actions, refresh health, and
  recoverable missing links;

* source-preserving capture of paths and URLs, project context resource cards,
  resource-aware search results, and bounded agent context bundles;

* a read-only Google Drive adapter using PKCE, narrow `drive.file` scope,
  metadata listing, selected-file project linking, bounded Docs/Sheets text
  previews, and `changes.list` pagination; credentials are revocable from the
  workspace settings surface;

* previewed, authorized-root local writes with expected-hash checks and an
  audit log. External writes remain disabled by default.

Google write actions remain behind their feature boundary until the read-only
local and Drive workflows are validated in the product.

## Executive recommendation

Xingularity should become a **workspace control plane** rather than an
all-in-one replacement for Google Docs, Google Sheets, or Finder.

Centralize the things that are currently fragmented:

* capture and triage;

* identity and discovery of resources;

* relationships between projects, tasks, notes, decisions, and resources;

* cross-source search;

* project context and review surfaces;

* safe actions such as open, reveal, attach, summarize, and create a task;

* provenance, freshness, permission, and connection status.

Keep the things that are already good at their job in their source system:

* Google Docs remains the collaborative rich-text editor;

* Google Sheets remains the spreadsheet and calculation environment;

* Finder remains the authoritative local file system and file-management UI;

* Xingularity remains the canonical home for local Markdown notes and its own
  structured project/task records.

The product promise becomes:

> Start from the project or idea, find the relevant work wherever it lives,
> understand why it matters, and open or act on the source without rebuilding
> context.

This is a stronger and safer promise than “put every file into Xingularity.”
It also fits the product’s current local-first boundary: projects can expose a
smart view over related material without owning or duplicating the notebook
tree.

## What problem is worth solving?

The problem is not simply that there are too many applications. The deeper
problem is that the **context of a piece of work is distributed**:

* a project plan is in a Xingularity project;

* the meeting note is a Markdown note or Google Doc;

* the numbers are in a Google Sheet;

* the design, export, or source material is in a Finder folder;

* the follow-up is a Xingularity task;

* the decision is buried in a paragraph;

* the user later has to reconstruct the connection manually.

The information exists, but the relationship is lost. Users end up searching
the same topic in several applications, copying excerpts into a central note,
or maintaining parallel folder/database structures. That creates stale copies,
unclear ownership, and more maintenance work.

The valuable centralization target is therefore **context**, not bytes.

## The product model: three layers

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Source systems                                                       │
│ Google Docs/Sheets · Xingularity vault · local files/Finder · URLs   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ connectors, links, metadata, excerpts
┌───────────────────────────────▼──────────────────────────────────────┐
│ Xingularity context layer                                            │
│ Resource registry · typed relations · project views · provenance     │
│ freshness · permissions · local search index · capture inbox         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ actions and views
┌───────────────────────────────▼──────────────────────────────────────┐
│ Interaction layer                                                    │
│ Universal search · project cockpit · command palette · reviews       │
│ Open in source · Reveal in Finder · attach · import snapshot         │
└──────────────────────────────────────────────────────────────────────┘
```

The context layer should be useful even when a connector is offline. A resource
can remain attached to a project as a known, possibly stale reference while
the source is unavailable. It must not pretend that a stale reference is
current content.

## Research method and limitations

The research reviewed public discussions from r/Notion, r/ObsidianMD,
r/ProductivityApps, r/macapps, Hacker News, the Obsidian forum, DEVONthink’s
community forum, and Hookmark’s documentation/forum. It also checked the
current Google Drive/Docs/Sheets API and macOS file-access documentation to
separate user desire from integration reality.

This is qualitative directional research, not a representative survey. Reddit
and Hacker News discussions are self-selected, upvotes are time- and
community-dependent, and some “I built this” threads are product promotion.
The useful output is the repetition of the same problems across communities,
not a claim that every user wants the same product.

## What the community is saying

### 1. The strongest demand is one place to regain context

People repeatedly describe the pain as switching between notes, tasks, files,
calendar, and project tools, then having to reconstruct why something matters.
One recent productivity-app thread describes tasks separated from the meeting
note that created them; the proposed remedy was a durable link from the task
back to its exact source note. A separate Hacker News discussion describes
“search as a context switch” and argues that a unified app can still create
clutter unless it preserves context automatically.

Sources: [notes-to-task context thread](https://www.reddit.com/r/ProductivityApps/comments/1tz6xzm/i_built_a_workspace_because_i_kept_losing_the/),
[Hacker News context-switching discussion](https://news.ycombinator.com/item?id=44352214),
[Hacker News note-hoarding and action loop](https://news.ycombinator.com/item?id=46826277).

**Implication for Xingularity:** a task or project result should expose the
source note, document, sheet, or file that explains it. A search result should
lead to the relevant context, not just a title.

### 2. Hybrid workflows are normal and often deliberate

Users who say they want an all-in-one workspace still commonly keep Google
Docs for collaborative writing, Google Sheets for spreadsheets, a cloud drive
for shared/archive files, and a separate capture or reading tool. In one
Notion discussion, the user explicitly uses Notion for ideas and tasks while
keeping Google Docs as the word processor, Google Sheets as the spreadsheet,
and cloud storage for active or shared files.

Another discussion about Google Drive versus Notion recommends a hybrid model:
keep files in Drive, then link them to project-oriented records rather than
trying to mirror the entire folder structure.

Sources: [Notion mixed-tools workflow](https://www.reddit.com/r/Notion/comments/1o4pzxh/do_you_all_stick_to_notion_for_notes_or_mix_other/),
[Google Drive versus Notion](https://www.reddit.com/r/Notion/comments/1fv0b7o),
[Google Drive and Notion startup workflow](https://www.reddit.com/r/Notion/comments/1sxgf5u/startup_notion_and_google_drive/).

**Implication for Xingularity:** optimize the handoff between tools instead of
forcing migration. “Open in Google Docs” is a successful product outcome when
the user arrives at the correct document with the project context intact.

### 3. A global inbox is more useful than a perfect filing system

In an all-in-one productivity discussion, a user describes wanting one place
to drop arbitrary files, notes, URLs, reminders, and tasks. Their eventual
workflow was a project-oriented Google Chat inbox that they reviewed later,
rather than a complicated system that required perfect classification at
capture time.

The same pattern appears in note-taking communities: users want fast capture,
then a later review step to decide whether an item is a note, reference, task,
or project input.

Source: [all-in-one productivity and global inbox discussion](https://www.reddit.com/r/ProductivityApps/comments/1dj0ve4/all-in-one-productivity-apps-specially-free/).

**Implication for Xingularity:** “collect resources” should first mean “capture
without losing provenance.” Classification and linking can happen during
review. A capture should retain its originating URL, file path, Drive ID, or
source application.

### 4. External, no-copy references are attractive but not magically reliable

Obsidian users repeatedly ask how to link to files outside the vault without
duplicating them. The forum documents `file://` links to local files and
folders, while newer community plugins try to mount external folders inside a
vault so that search and navigation can span multiple roots.

The appeal is clear: users want one navigational surface while keeping files in
their real location. The warnings are equally important: paths can move,
cloud files can be online-only, sync tools can create duplicates, external
changes can be missed, and multi-device paths do not necessarily match.

Sources: [Obsidian external file links](https://forum.obsidian.md/t/linking-to-external-files-folders/70121),
[Folder Bridge external-folder discussion](https://www.reddit.com/r/ObsidianMD/comments/1rboynw/i_built_folder_bridgean_obsidian_plugin_that_lets/),
[Obsidian and external Google Doc workflow](https://www.reddit.com/r/ObsidianMD/comments/1aekeha),
[Google Drive sync plugin discussion](https://www.reddit.com/r/ObsidianMD/comments/1dzbunx/obsidian_google_drive_sync_beta_a_free/).

**Implication for Xingularity:** link first, index second, copy only when the
user explicitly asks. Every external resource needs a visible state such as
`available`, `stale`, `moved`, `offline`, `permission denied`, or `unlinked`.

### 5. File relationships are a real gap in Finder-style organization

Mac users describe wanting all files, notes, reminders, and project material
with the same topic in one view, while still keeping their normal Finder
workflow. Another user describes documents as a dependency graph rather than a
folder tree and uses contextual links to connect files, notes, tasks, and web
pages.

DEVONthink discussions show the same design tension. Indexing external files
preserves the Finder copy but can break when paths change; importing files into
the database improves control but introduces duplication and export concerns.

Sources: [Finder and notes integration request](https://www.reddit.com/r/macapps/comments/1ium12m/integrating_finder_in_notes/),
[relational file management discussion](https://www.reddit.com/r/macapps/comments/1opxj05/relational_file_management/),
[DEVONthink external indexing discussion](https://discourse.devontechnologies.com/t/index-links-in-devonthink/7954),
[DEVONthink external file links discussion](https://discourse.devontechnologies.com/t/dt-does-external-file-links/81).

**Implication for Xingularity:** the project should be a relationship lens over
files, not a replacement file tree. “Reveal in Finder” and “Open in default
application” should be first-class actions.

### 6. All-in-one systems lose trust when they become a second job

The positive side of Notion-style systems is clear: one place, less switching,
linked databases, and flexible views. The recurring negative side is also
clear: large workspaces become slow, cluttered, over-designed, or difficult to
maintain. Recent Notion threads describe old pages, excessive databases, and
system maintenance becoming harder than the work itself. Other users say they
still like all-in-one systems but prioritize speed over elegance and are happy
to keep specialized tools when the unified workspace becomes heavy.

Obsidian users express a parallel concern about plugin sprawl: more plugins can
increase dependency, maintenance, startup time, and migration risk.

Sources: [Notion workspace maintenance](https://www.reddit.com/r/Notion/comments/1ufamxs/what_part_of_your_notion_setup_became_harder_to/),
[Notion all-in-one versus specialized tools](https://www.reddit.com/r/Notion/comments/1r42zvu/quick_question_do_you_guys_get_more_productive/),
[Notion complexity discussion](https://www.reddit.com/r/Notion/comments/1ug9tgm/is_notion_becoming_unnecessarily_complicated/),
[Obsidian plugin maintenance discussion](https://www.reddit.com/r/ObsidianMD/comments/1upqpbq/we_dont_need_20_halfmaintained_plugins_for_the/).

**Implication for Xingularity:** each central surface must earn its place by
reducing work. Avoid a giant “everything” dashboard. Default views should be
small, project-scoped, and actionable; advanced integrations should be
progressive and opt-in.

### 7. Portability and source ownership remain trust requirements

Hacker News discussions about Notion praise the flexibility and search but
raise recurring concerns about performance, export, data ownership, and vendor
lock-in. Obsidian users often value plain files and the ability to move or sync
them with other tools. Hookmark users value cross-application links, while some
community members worry about opaque proprietary link databases and recovery.

Sources: [Hacker News Notion discussion](https://news.ycombinator.com/item?id=18904648),
[Hacker News Notion tradeoffs](https://news.ycombinator.com/item?id=36846623),
[Hookmark feature and portability discussion](https://www.reddit.com/r/macapps/comments/1irmqos/is_hookmark_actually_needed/),
[Hookmark cross-application linking](https://hookproductivity.com/help/general/features/).

**Implication for Xingularity:** relationships and indexes should be rebuildable
or exportable. A user should be able to keep a Google Doc in Google, a file in
Finder, and a note in Markdown without Xingularity becoming the only place
where the work remains usable.

### Research synthesis

The repeated signal is not “replace every application.” It is:

1. Give me one capture and search surface.
2. Keep the connection between an action and the context that created it.
3. Let me keep using the source tool that is best for the artifact.
4. Do not silently duplicate, mutate, or index private content.
5. Make the system fast and low-maintenance enough that I keep using it.

That is the product boundary Xingularity should adopt.

## Source-of-truth rules

Every resource needs a canonical owner. A project can relate to a resource
without owning its content.

| Resource                           | Canonical source of truth   | Xingularity’s role                                                    | Default mutation                         |
| ---------------------------------- | --------------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| Xingularity note                   | Local Markdown vault        | Edit, link, index, relate                                             | Read/write in Xingularity                |
| Project, task, milestone, decision | Xingularity structured data | Model, display, relate, review                                        | Read/write in Xingularity                |
| Google Doc                         | Google Drive/Docs           | Discover, relate, preview excerpt, cite, open                         | Open source editor; no silent copy       |
| Google Sheet                       | Google Drive/Sheets         | Discover, relate, show metadata, optionally read selected ranges      | Open source editor; no silent conversion |
| Finder file                        | The local file system       | Index selected metadata, relate, preview supported types, open/reveal | Read-only by default                     |
| Finder folder                      | The local file system       | Represent as a project/resource scope and monitor selected changes    | No move/delete by default                |
| URL                                | The external site           | Save, annotate, relate, revisit, optionally snapshot                  | Open externally; snapshot explicitly     |
| Imported attachment                | Xingularity vault           | Own the copy and its lifecycle                                        | Read/write in Xingularity                |

This prevents the most dangerous ambiguity: two systems both appearing to be
the owner of the same document.

### The central rule

> Xingularity owns relationships and structured work. Source systems own
> source content unless the user explicitly imports or publishes a copy.

This rule should appear in the UI. A Google Doc card should say “Source: Google
Drive” and offer “Open in Google Docs.” A Finder item should say “Source: This
Mac” and offer “Reveal in Finder.” An imported copy should say “Imported copy;
source link available.”

## Proposed domain model

### Resource reference

The current project model has `resources?: string[]`. That is a useful wedge,
but a string cannot reliably distinguish a Google URL, a local path, a note ID,
or a resource that has moved. Evolve it toward typed references while keeping a
migration path for existing strings.

Illustrative shape:

```ts
type ResourceProvider = 'xingularity' | 'google-drive' | 'filesystem' | 'web'

type ResourceKind =
  | 'note'
  | 'project'
  | 'task'
  | 'local-file'
  | 'local-folder'
  | 'google-doc'
  | 'google-sheet'
  | 'google-slide'
  | 'drive-file'
  | 'url'

type ResourceAccess = 'read-only' | 'read-write' | 'unknown'
type ResourceState =
  | 'available'
  | 'stale'
  | 'moved'
  | 'offline'
  | 'permission-denied'
  | 'reauthorization-required'
  | 'missing'
  | 'conflict'
  | 'unindexed'

interface ResourceRef {
  id: string
  provider: ResourceProvider
  kind: ResourceKind
  title: string
  canonicalUri: string
  externalId?: string
  mimeType?: string
  sourceOfTruth: 'xingularity' | 'external'
  access: ResourceAccess
  state: ResourceState
  projectIds?: string[]
  createdAt?: string
  updatedAt?: string
  lastSeenAt?: string
  lastIndexedAt?: string
  sourceModifiedAt?: string
  freshness?: 'live' | 'periodic' | 'manual' | 'unknown'
  metadata?: Record<string, string | number | boolean | null>
}
```

The exact type can change. The important properties are:

* stable identity separate from display title;

* provider and kind visible to the search and UI layers;

* a source URI or source-specific ID;

* source-of-truth ownership;

* access and freshness state;

* timestamps that distinguish the source’s modification from Xingularity’s
  observation or index time.

Do not put OAuth tokens, refresh tokens, raw security-scoped bookmark data, or
other credentials in `ResourceRef` or in a synced vault file. Store those in
the existing device credential boundary and keep the resource record as an
opaque reference.

### Device-specific locators

Google Drive resources can use a stable Drive file ID. A local file needs more
care because an absolute path is device-specific and can change when a user
moves or renames a file.

Keep portable resource identity separate from a local locator:

```ts
interface ResourceLocator {
  resourceId: string
  deviceId: string
  provider: 'filesystem' | 'google-drive'
  path?: string
  bookmarkOrHandle?: string
  fileId?: string
  observedName?: string
  observedParent?: string
  updatedAt: string
}
```

The actual bookmark/handle representation is platform-specific and should not
be treated as portable content. If a local file cannot be resolved, the UI
should offer “Locate again” rather than silently creating a second resource.

### Typed relationships

Relationships are the reason to centralize. They should be first-class and
auditable instead of being inferred only from folder names or repeated tags.

Useful initial relation types:

* `project_contains_resource`

* `task_derived_from_resource`

* `note_references_resource`

* `decision_supported_by_resource`

* `milestone_delivered_by_resource`

* `resource_related_to_resource`

* `resource_snapshot_of_external`

* `resource_supersedes_resource`

* `capture_came_from_resource`

Each relation should retain its creator, creation time, optional source
location, and whether it was manually confirmed or suggested by automation.

### Resource lifecycle

Use an explicit lifecycle instead of treating every link as equally trustworthy:

```text
Discovered → Linked → Indexed → Confirmed → Reviewed
                  ↘ stale / moved / offline / denied / missing
```

* **Discovered:** found by a connector or selected by the user.

* **Linked:** attached to a project, note, task, or capture.

* **Indexed:** enough metadata or content is available for search.

* **Confirmed:** a person accepted a suggested relation or classification.

* **Reviewed:** the user has recently verified that the link remains useful.

* **Stale/moved/offline/denied/missing:** a recoverable state that needs an
  honest explanation and an appropriate next action.

## Product surfaces

### 1. Workspace Home: “What needs my attention?”

The home surface should not be a dump of every source. It should show:

* active projects and their next commitments;

* recent captures awaiting triage;

* resources that changed or became unavailable;

* decisions or tasks linked to newly updated resources;

* recently opened contexts;

* a compact universal search entry point.

The default home view should be small and useful without setup. Users can add
project views later, but should not have to build a database before the product
becomes useful.

### 2. Universal search

Search should combine Xingularity’s current typed search contract with connector
results. Search results should make the source obvious:

```text
Project Atlas — Xingularity project
Q3 pricing assumptions — Google Sheet · updated 14 minutes ago
Research brief — Finder · ~/Documents/Atlas/Research/brief.pdf
Decision log — Xingularity note · linked from Project Atlas
```

Every result needs:

* source badge and source account/device;

* freshness and last-observed time;

* access state;

* why it matched;

* an action appropriate to the source: open, reveal, attach, import, or
  reauthorize.

Search should support filters for provider, kind, project, state, date, and
whether a result is canonical or an imported snapshot.

Search is not the same as AI retrieval. A result can be discoverable by title
and metadata even when its content is not indexed. The UI must not imply that
Xingularity can answer questions about content it has not been allowed to read.

### 3. Capture Inbox

Capture should accept:

* text and quick notes;

* URLs;

* dragged local files and folders;

* Google Drive links or selected Drive results;

* screenshots and supported attachments;

* a selected project or “unassigned” state.

Each capture preserves provenance. The user can later:

* keep it as a note;

* attach it to a project;

* create a task with a backlink;

* create a resource reference;

* import a copy into the vault;

* dismiss or archive it.

Automatic classification should be proposed, not silently applied. The current
capture trust boundary from `project-management-operating-system.md` is a good
fit:

```text
Captured → Proposed → Confirmed → Published → Resolved or Archived
```

### 4. Project Context view

Every project should have a contextual view with sections such as:

* outcome and current status;

* Work: tasks, milestones, and dependencies;

* Notes: linked Xingularity notes;

* Documents: Google Docs, Sheets, Slides, and external files;

* Decisions and risks;

* Recent changes and resource health;

* Open questions and captures.

This is a projection over related objects, not a hidden project folder. The
notebook tree remains user-managed, and external files remain where they are.

The project page should answer:

1. What is this project trying to achieve?
2. What must happen next?
3. What source material explains the work?
4. What changed since I last looked?
5. Which resources or permissions need attention?

### 5. Resource detail and actions

A resource detail view should be deliberately modest. It can show title,
source, project relations, metadata, excerpt or preview where permitted, and
history of observations. The primary action is to reach the source.

Useful actions:

* Open in Google Docs/Sheets or the system default application;

* Reveal in Finder;

* Copy source link;

* Attach to project or note;

* Create task from resource;

* Add a note or decision about the resource;

* Index or refresh;

* Import a snapshot;

* Locate moved file;

* Reauthorize connector;

* Unlink from the current context.

“Move,” “rename,” “trash,” “share,” and “change permissions” should not appear
as default resource actions. They are high-impact source mutations and should
be a later, explicit capability with confirmation and undo/recovery semantics.

## Integration boundaries

### Google Workspace

#### Start read-only and selected

The first Google integration should cover Google Drive discovery, with Docs and
Sheets represented as typed resources. It should not begin by trying to clone
all of a user’s Drive into the local vault.

Good first capabilities:

* connect a Google account through PKCE;

* select a Drive, folder, or individual files to make available;

* retrieve file ID, name, MIME type, URL, parent, modified time, and permission
  hints;

* list and search authorized files;

* refresh incrementally;

* attach a Drive item to a project, note, task, or capture;

* open it in its native Google Workspace surface;

* optionally retrieve a bounded excerpt for an explicitly enabled resource.

The Drive API supports filtered file search through `files.list`, including
name, MIME type, modified time, and full-text query terms. It also exposes
`changes.list` with page tokens for incremental synchronization. That is enough
to build a resource index without mirroring the full content store.

Sources: [Drive file search](https://developers.google.com/workspace/drive/api/guides/search-files),
[Drive incremental changes](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list).

#### Do not flatten Docs and Sheets into Markdown

Google Docs and Sheets have different semantics from Markdown notes:

* Docs have collaborative revisions, comments, tables, suggestions, and rich
  formatting;

* Sheets have formulas, ranges, charts, formatting, protected areas, and
  multiple sheets;

* their source permissions and collaboration state live in Google Workspace.

The Docs API provides structured reads and atomic `documents.batchUpdate`
operations. The Sheets API provides range/value operations and spreadsheet
batch updates. Those APIs can support deliberate actions later, but they are
not evidence that Xingularity should become the primary editor.

Sources: [Google Docs API document model](https://developers.google.com/workspace/docs/api/concepts/document),
[Google Sheets read/write values](https://developers.google.com/workspace/sheets/api/guides/values),
[Google Sheets batch updates](https://developers.google.com/workspace/sheets/api/guides/batchupdate).

#### Least privilege is a product feature

Google’s documentation distinguishes narrow per-file access such as
`drive.file` from broad read or read/write Drive scopes. Broad access can
trigger sensitive/restricted-scope verification, and storing restricted data on
servers can add security-assessment requirements.

The connector should therefore make scope visible and progressive:

1. per-file or user-selected access where possible;
2. metadata-only mode;
3. explicit content-read mode for selected resources;
4. explicit write actions only after the read-only flow is trustworthy.

The user should see which account, Drive/folder scope, and actions are enabled.
Disconnecting must remove the connector’s local credentials and mark affected
resources as disconnected without deleting Xingularity’s relationships.

Sources: [Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth),
[Google OAuth scope policy](https://developers.google.com/identity/protocols/oauth2/policies),
[restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

#### Use Notion as a useful warning, not a template to copy blindly

Notion’s current Google Drive connector demonstrates that cross-source search
is valuable but operationally expensive. Its documentation says the connector
requires a paid Google Workspace plan, a Google Drive admin, and a Notion
Business or Enterprise workspace. Initial connection can take up to roughly
36 hours, new content can appear on an hourly cadence, and spreadsheet analysis
is limited.

That is a useful warning for Xingularity: advertise freshness and scope rather
than implying live, complete access. A local-first desktop app can be more
responsive for selected local files, but it still has to explain cloud
permissions, indexing delay, and unavailable content.

Source: [Notion’s Google Drive AI connector documentation](https://www.notion.com/help/notion-ai-connectors-for-google-drive).

### macOS Finder and the local file system

#### Treat Finder as a source, not as a folder tree to reproduce

The Finder integration should begin with user-selected files and folders:

* the user selects a folder to add as a resource scope;

* Xingularity records a device-specific locator;

* the app indexes only allowed metadata and configured file types;

* the user can open a file or reveal it in Finder;

* changes are observed and shown as resource health, not silently moved.

Apple’s App Sandbox model is built around user-selected files/folders and
security-scoped bookmarks for persistent access. Apple’s `NSWorkspace` APIs
also support opening URLs and activating Finder with selected files. The
Electron implementation can use the main process and a small platform bridge,
but it should preserve the same user-consent model.

Sources: [Apple file access in the macOS App Sandbox](https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox),
[Apple NSOpenPanel](https://developer.apple.com/documentation/appkit/nsopenpanel),
[Apple NSWorkspace](https://developer.apple.com/documentation/appkit/nsworkspace),
[Finder reveal API](https://developer.apple.com/documentation/appkit/nsworkspace/activatefileviewerselecting%28_%3A%29).

#### Scope local indexing

Never default to scanning the entire home directory. Let users choose:

* selected folder roots;

* read-only or read/write intent;

* file extensions or MIME families;

* maximum file size;

* whether content indexing is enabled;

* whether hidden/system folders are excluded.

Default to metadata and supported text/PDF extraction. Make OCR, binary
inspection, and broad content indexing explicit because they affect privacy,
performance, disk usage, and AI exposure.

#### Make movement and deletion recoverable

Finder is allowed to change outside Xingularity. A file may be renamed, moved,
deleted, placed online-only, or become inaccessible. The app should:

* detect that the old locator no longer resolves;

* attempt a safe identity match using file identity and observed metadata;

* ask the user to locate again when confidence is low;

* preserve the resource ID and relations;

* never silently substitute a different file with a similar name.

### Xingularity notes and structured work

Xingularity should remain the canonical source for:

* Markdown notes;

* projects and their structured metadata;

* tasks, milestones, dependencies, decisions, and project pulse;

* captures and reviews;

* relationship records.

External resources should be able to appear in the same search and graph, but
they should retain their provider identity. This extends the existing typed
search and knowledge-graph work without turning the vault into a dumping ground.

## Search and indexing architecture

### One contract, multiple indexes

Use one normalized search result contract with provider-aware documents:

* local note index: full text and note metadata;

* structured index: projects, tasks, calendar events, captures, decisions;

* filesystem index: selected roots and supported metadata/content;

* Drive index: authorized metadata and selected excerpts;

* web/resource index: titles, URLs, annotations, and optional snapshots.

Each index reports its freshness and failure state. The query layer can merge
results, but it must not hide a connector error behind a successful local
search.

The current `SearchDocument` already has `source`, `target`, `metadata`, and
typed entity concepts. Extend that contract with provider/resource fields
rather than creating a second search system.

### Search modes

Offer three understandable modes:

1. **Everything I can access:** merged local, structured, Drive, and selected
   file-system results.
2. **This project:** results constrained to the current project’s relations.
3. **Source-specific:** only Xingularity, Google Drive, Finder, or web.

For AI-assisted retrieval, return citations to resource IDs and source URLs,
display the observed timestamp, and indicate when the answer used a stale
excerpt. AI should never claim that a resource was searched if its connector
was offline or its content was not indexed.

### Incremental refresh

The refresh model should be different by provider:

* Xingularity vault: local watcher and existing index updates;

* local files: selected-root watcher plus periodic reconciliation;

* Google Drive: initial `files.list`, then `changes.list` cursor;

* web URLs: manual refresh or explicit scheduled fetch;

* imported snapshots: stable until the user creates a new snapshot.

Every resource should expose “last observed” and “source modified” separately.
That distinction makes cloud lag and local indexing delay visible.

## Collection and automation

### Resource collection is not automatic ownership

An automation can observe and propose:

* “This file looks related to Project Atlas”;

* “This Google Doc mentions a possible task”;

* “This Finder folder changed significantly”;

* “This capture may be a decision or reference.”

It must not silently:

* create authoritative tasks from unreviewed text;

* move files or rename folders;

* upload local files to Google Drive;

* change Google permissions;

* copy an entire Drive folder into the vault;

* send private content to an AI provider without an explicit policy.

The proposal should show source, evidence, confidence, target mutation, and
accept/edit/reject controls before committing.

### Context assembly for agents

An agent should receive a **context bundle**, not unrestricted access:

```text
Project Atlas
├── confirmed project and task records
├── selected notes
├── selected Google resources with permission-safe excerpts
├── selected Finder resources with local access
├── source links and freshness timestamps
└── explicit allowed actions
```

This lets the user ask “prepare the project update” while retaining control of
which external resources are included. The agent can draft, cite, and propose;
the project lead or resource owner confirms publication or mutation.

## Recommended delivery sequence

### Phase 0 — define the contract before connecting providers

Deliver:

* `ResourceRef`, `ResourceLocator`, and relation contracts;

* resource states, source-of-truth labels, and freshness semantics;

* a migration from existing `project.resources` strings;

* provider-neutral search targets;

* connector and credential boundaries;

* resource actions and confirmation rules.

Exit condition: a project can link an internal note, a URL, an existing
attachment, and a placeholder external resource without any provider-specific
UI leaking into the domain model.

### Phase 1 — link-first local resource hub

Deliver:

* add a selected Finder folder or file;

* show metadata and supported previews;

* open in the default application;

* reveal in Finder;

* attach to a project/note/task;

* show moved, missing, offline, and permission states;

* index selected text/PDF content behind an explicit setting.

Do not implement file move, delete, or broad home-directory scanning in this
phase.

Why first: it provides the centralization value with the smallest external
authorization surface and builds the identity, locator, stale-link, and search
foundations needed for Google Drive.

### Phase 2 — Google Drive read-only connector

Deliver:

* OAuth/PKCE connection and credential revocation;

* user-selected Drive/folder/file scope;

* Drive metadata search;

* incremental change refresh;

* project/resource picker;

* open in Docs, Sheets, Slides, or Drive;

* selected-resource content extraction with freshness and permission display.

Do not promise complete, real-time indexing of all of Drive. Support personal
accounts and organization accounts only where the chosen scopes and Google
verification path allow it; document unsupported account/setup cases clearly.

### Phase 3 — unified search and project context

Deliver:

* merged search across local, structured, Finder, and Drive resources;

* project-scoped search;

* resource health and refresh controls;

* project Context view;

* source backlinks from tasks, decisions, and notes;

* recent-context and “needs attention” views.

Success condition: a user can begin from a task or project and reach the source
material in one or two intentional actions without copying content manually.

### Phase 4 — capture and review loop

Deliver:

* global capture for files, URLs, text, and Drive links;

* source-preserving inbox;

* proposals for project linking and task/decision extraction;

* review, accept, edit, reject, archive flows;

* source links on every confirmed task and decision.

This is where “collect resources” becomes a daily habit rather than a one-time
integration setup.

### Phase 5 — explicit writes and deeper automation

Consider only after read-only flows are reliable:

* create a Google Doc from a Xingularity note;

* append an approved status block to a selected Google Doc;

* write selected values to a user-approved Google Sheet range;

* create or update local files in an explicitly authorized root;

* scheduled refresh and resource health reports;

* agent-generated drafts with citations and approval.

Every write needs a preview, target/source label, permission check, revision or
ETag handling where available, and an undo or recovery story. Rich two-way
sync between Markdown, Docs, and Sheets should remain a separate decision; it
is substantially riskier than linking and explicit publishing.

## How this fits the existing Xingularity foundation

The proposal extends current directions instead of replacing them:

* `SEARCH-001` already defines a typed search contract, filters, ranking, and
  sensitive-text redaction. Add provider-aware external resources to that
  contract.

* `KNOW-001` already expands the graph beyond note mentions. Add resource
  nodes and typed edges with provenance.

* `PROJ-001` already treats projects as planning spaces rather than folders.
  Project Context becomes a projection over related resources.

* `CAP-001` already points toward an actionable capture inbox. Resource capture
  should preserve source context before classification.

* `SYNC-001` and `CORE-001` already recognize checksums, change detection, and
  conflicts. External connectors need the same explicit states without
  enabling destructive sync by default.

* `SEC-002` already moves credentials toward device credential storage. Drive
  tokens and file-access handles must follow that boundary.

* `VAULT-001` already emphasizes export, diagnostics, backup, and recovery.
  Resource relations and connector state should be included in portable
  manifests without exporting secrets.

* The existing provider-neutral Google Calendar adapter is a useful pattern:
  explicit scopes, PKCE, refresh/revocation handling, normalized external IDs,
  and clear read-only access.

* The existing main/preload/renderer boundary remains important. File-system
  access, connector tokens, content fetching, and source mutations belong in
  the main process or a narrowly scoped bridge, not in renderer components.

The immediate model change is to replace a free-form resource string with a
typed reference and relation. The immediate product change is to make the
project’s resources useful, source-aware, and searchable.

## Risks and mitigations

| Risk                                  | Why it matters                                                  | Mitigation                                                                                             |
| ------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Two sources appear authoritative      | Users edit the wrong copy or lose changes                       | Label the canonical owner on every resource; link by default; make imports/publishes explicit          |
| Files move or disappear               | Local links become confusing and relations appear broken        | Preserve resource ID; show stale/missing state; offer locate-again; never silently substitute          |
| External permissions leak             | Search or AI could expose content the user cannot access        | Enforce source permissions at connector and query time; do not cache beyond policy; show account/scope |
| Full-disk indexing harms trust        | It can be slow, expensive, and unexpectedly private             | User-selected roots, read-only defaults, file-type/size limits, explicit content indexing              |
| Google OAuth becomes a launch blocker | Broad Drive access may require verification and security review | Start with narrow scopes and selected resources; design an account/setup fallback                      |
| Cloud freshness is misunderstood      | Users treat stale excerpts as current truth                     | Show last observed/source modified timestamps and connector health                                     |
| A unified UI becomes clutter          | The product turns into another maintenance project              | Keep defaults small; project-scope views; progressive disclosure; measure repeated use                 |
| File operations cause damage          | Rename, move, or delete can affect external workflows           | Read-only first; explicit permissions; preview, confirmation, undo/trash, and audit trail              |
| Connector ecosystem becomes a silo    | Relationships are lost if Xingularity disappears                | Export resource references and relations; keep source URLs/IDs human-readable where possible           |
| AI creates false commitments          | Users stop trusting capture and project status                  | Propose, cite, preview, confirm; never silently publish tasks or decisions                             |

## Success measures

Use measures that test whether centralization reduces reconstruction work rather
than whether users connect the most services.

* **Context recovery:** time from opening a task/project to opening the source
  material that explains it.

* **Capture continuity:** percentage of captures that retain a valid source
  link and reach a confirmed destination.

* **Search usefulness:** successful source opens after a cross-source query,
  separated by provider and freshness state.

* **Resource health:** percentage of linked external resources that are
  resolvable, with time-to-repair for moved or reauthorized items.

* **Duplicate avoidance:** number of imported copies created intentionally
  versus accidental duplicate content.

* **Trust safety:** count of unintended external writes, permission errors, and
  AI proposals rejected because provenance or freshness was unclear.

* **Maintenance burden:** how often users need to reorganize or repair the
  central system to keep it useful.

Qualitative usability checks should include:

1. Start a project with a Markdown note, a Google Doc, a Google Sheet, and a
   Finder folder; then find all four from the project.
2. Capture a local file and a Drive link without deciding their final location;
   triage both later while preserving provenance.
3. Rename or move a Finder file and verify that the resource becomes recoverable
   rather than silently pointing at the wrong file.
4. Revoke Google access and verify that relationships remain while content is
   correctly marked unavailable.
5. Work offline and verify that local context remains usable while cloud
   freshness is honestly displayed.

## Recommended product decision

Proceed with centralization, but define the feature as:

> **A project-and-context layer that connects the user’s real sources.**

The first valuable slice is:

1. typed resource references and relations;
2. a resource-aware project context view;
3. universal search over Xingularity plus selected local resources;
4. source-preserving capture;
5. read-only Google Drive discovery as the next connector.

Do not start with full Drive mirroring, two-way file sync, rich Google editor
reimplementation, or an “everything” dashboard. Those are expensive answers
to a weaker interpretation of the problem and would recreate the exact trust,
performance, and maintenance concerns the community repeatedly raises.

## Research sources

### Community discussions

* [r/Notion — Using OneDrive and Google Drive with Notion](https://www.reddit.com/r/Notion/comments/1rmtjdk/using_onedrive_and_google_drive_wnotion/)

* [r/Notion — Do you stick to Notion for notes, or mix other tools?](https://www.reddit.com/r/Notion/comments/1o4pzxh/do_you_all_stick_to_notion_for_notes_or_mix_other/)

* [r/Notion — Google Drive vs Notion](https://www.reddit.com/r/Notion/comments/1fv0b7o)

* [r/Notion — Startup Notion and Google Drive](https://www.reddit.com/r/Notion/comments/1sxgf5u/startup_notion_and_google_drive/)

* [r/Notion — What part of your setup became harder to maintain?](https://www.reddit.com/r/Notion/comments/1ufamxs/what_part_of_your_notion_setup_became_harder_to/)

* [r/Notion — All-in-one systems versus specific tools](https://www.reddit.com/r/Notion/comments/1r42zvu/quick_question_do_you_guys_get_more_productive/)

* [r/Notion — Is Notion becoming unnecessarily complicated?](https://www.reddit.com/r/Notion/comments/1ug9tgm/is_notion_becoming_unnecessarily_complicated/)

* [r/ObsidianMD — Linking external Google Doc notes](https://www.reddit.com/r/ObsidianMD/comments/1aekeha)

* [r/ObsidianMD — Folder Bridge external folders](https://www.reddit.com/r/ObsidianMD/comments/1rboynw/i_built_folder_bridgean_obsidian_plugin_that_lets/)

* [r/ObsidianMD — Google Drive sync plugin](https://www.reddit.com/r/ObsidianMD/comments/1dzbunx/obsidian_google_drive_sync_beta_a_free/)

* [Obsidian Forum — Linking to external files and folders](https://forum.obsidian.md/t/linking-to-external-files-folders/70121)

* [r/ProductivityApps — All-in-one productivity apps and global inbox](https://www.reddit.com/r/ProductivityApps/comments/1dj0ve4/all-in-one-productivity-apps-specially-free/)

* [r/ProductivityApps — Keeping notes and tasks connected](https://www.reddit.com/r/ProductivityApps/comments/1tz6xzm/i_built_a_workspace_because_i_kept_losing_the/)

* [r/macapps — Integrating Finder in notes](https://www.reddit.com/r/macapps/comments/1ium12m/integrating_finder_in_notes/)

* [r/macapps — Relational file management](https://www.reddit.com/r/macapps/comments/1opxj05/relational_file_management/)

* [r/macapps — Hookmark and cross-application links](https://www.reddit.com/r/macapps/comments/1irmqos/is_hookmark_actually_needed/)

* [Hacker News — Notion all-in-one workspace](https://news.ycombinator.com/item?id=18904648)

* [Hacker News — Do you like Notion?](https://news.ycombinator.com/item?id=36846623)

* [Hacker News — App switching and context](https://news.ycombinator.com/item?id=44352214)

* [Hacker News — Hoarding notes and turning them into actions](https://news.ycombinator.com/item?id=46826277)

* [DEVONthink community — Index links and external files](https://discourse.devontechnologies.com/t/index-links-in-devonthink/7954)

* [DEVONthink community — External file links](https://discourse.devontechnologies.com/t/dt-does-external-file-links/81)

### Product and platform documentation

* [Google Drive API — Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files)

* [Google Drive API —](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list) [`changes.list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list)

* [Google Drive API — Choose authorization scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)

* [Google OAuth — Policies](https://developers.google.com/identity/protocols/oauth2/policies)

* [Google Docs API — Document concepts](https://developers.google.com/workspace/docs/api/concepts/document)

* [Google Sheets API — Read and write cell values](https://developers.google.com/workspace/sheets/api/guides/values)

* [Notion — Google Drive AI Connector](https://www.notion.com/help/notion-ai-connectors-for-google-drive)

* [Apple — Accessing files from the macOS App Sandbox](https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox)

* [Apple —](https://developer.apple.com/documentation/appkit/nsopenpanel) [`NSOpenPanel`](https://developer.apple.com/documentation/appkit/nsopenpanel)

* [Apple —](https://developer.apple.com/documentation/appkit/nsworkspace) [`NSWorkspace`](https://developer.apple.com/documentation/appkit/nsworkspace)

* [Apple — Reveal files in Finder](https://developer.apple.com/documentation/appkit/nsworkspace/activatefileviewerselecting%28_%3A%29)

* [Hookmark — Cross-application linking features](https://hookproductivity.com/help/general/features/)

