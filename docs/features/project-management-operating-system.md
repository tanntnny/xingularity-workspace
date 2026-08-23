# Project management operating system

Status: proposed

This document defines a project-management model for Xingularity that connects project context, commitments, decisions, and follow-through without turning the notebook into a duplicate task system.

Related foundations:

- [PROJ-001 — project planning depth](../more-feature-backlog/PROJ-001.md)
- [CAP-001 — actionable capture inbox](../more-feature-backlog/CAP-001.md)
- [KNOW-001 — typed knowledge graph relations](../more-feature-backlog/KNOW-001.md)
- [AI-001 — reviewable assistive suggestions](../more-feature-backlog/AI-001.md)

## Product decision

Projects should evolve from task lists into operating spaces for getting work done. The core loop is:

```text
Capture → Confirm → Commit → Execute → Review → Learn
```

The product should introduce these explicit surfaces:

- **Project Home** — the current operating picture and attention queue.
- **Work** — tasks, deliverables, milestones, and dependencies.
- **Pulse** — an automatically assembled timeline of meaningful project changes.
- **Meetings** — agendas, minutes, decisions, and extracted commitments.
- **Decisions** — the durable decision register.
- **Risks** — risks, issues, assumptions, and dependencies that need ownership.
- **Knowledge** — a smart project-linked view over canonical notes and documents.
- **My Commitments** — a cross-project view of the user’s own work.

“Feed” should become **Pulse** because it is a project-awareness surface, not a social stream. “Notebook” should remain a user-managed content space; a project should expose a **Project Knowledge** view over linked content rather than create a hidden project-owned folder.

## Why the current model is insufficient

The current product has strong foundations: project records, linked tasks, milestones, task dependencies, quick capture, independent notebooks, and typed knowledge-graph relations. However, the domains do not yet form one operating loop.

Without an explicit model, several failure modes appear:

- A feed becomes a noisy log of every edit instead of a useful project narrative.
- Meeting notes contain commitments that are not visible in Work or owned by anyone.
- A decision is buried in a note and later rediscovered as an argument.
- Notebook folders duplicate project information and become stale.
- Automatic extraction creates unreviewed tasks or decisions that users do not trust.
- Project health is reduced to task completion even when blockers, risks, or decisions are unresolved.

The fix is not more note templates. The fix is to make the underlying objects and ownership boundaries explicit.

## Canonical objects and source-of-truth rules

Each durable object answers one operational question:

- **Project:** What outcome are we pursuing, and who is accountable for it?
- **Milestone or deliverable:** What meaningful result must be produced, and by when?
- **Work item:** What action must someone take next?
- **Meeting:** What was discussed, and what follow-up was agreed?
- **Update:** What is the project status for a defined reporting period?
- **Decision:** What choice was made, why, by whom, and when should it be revisited?
- **Risk, issue, assumption, or dependency:** What could prevent delivery or requires intervention?
- **Knowledge artifact:** Where is the durable context, evidence, or reference material?
- **Pulse event:** What meaningful change occurred, and which canonical object changed?

Pulse events are projections of canonical objects. They are not a second editable copy of the underlying data. A user who wants to correct a meeting minute, task, or decision must edit the source object; Pulse then reflects the change.

## Project workspace information architecture

### Project Home

Project Home is a decision surface, not a document editor. It should show:

- Project outcome, scope, phase, lead, sponsor, and latest health assessment.
- The next milestone, its owner, forecast, and confidence.
- A **Needs attention** queue containing overdue work, blocked work, unowned commitments, pending decisions, stale risks, and missing updates.
- Current top risks and dependencies.
- The latest approved project update.
- Recent important Pulse items.

Health can be suggested from evidence such as overdue tasks, blocked dependencies, stale risks, and missed milestones, but the project lead must confirm the published health. The system should show the evidence behind a suggestion instead of silently changing the project status.

### Work

Work is the execution layer. Tasks and deliverables should be first-class records, not note checkboxes.

Every committed work item should have:

- One accountable owner.
- A status, priority, and target date or an explicit reason that it has no date.
- A related project and, where relevant, milestone or deliverable.
- A next action and dependencies.
- A source link to the meeting, update, decision, or note that created it.
- Completion evidence or a link to the resulting artifact.

The existing task and milestone model can remain the foundation. The important change is that Work becomes the canonical place to manage commitment status, while notes provide context.

### Pulse

Pulse automatically collects meaningful events from confirmed workspace activity, including:

- Approved project updates.
- Published meeting minutes.
- Decisions proposed, decided, superseded, or revisited.
- Work created, completed, blocked, overdue, or reassigned.
- Milestone forecast or completion changes.
- Risks opened, mitigated, escalated, or closed.
- Important knowledge artifacts added or materially updated.

Pulse should not render every keystroke, metadata change, or autosave. It should group related changes and offer three useful views:

- **Needs attention:** unresolved changes requiring a person or decision.
- **Recent:** a chronological project narrative grouped by day or work episode.
- **Digest:** a concise daily or weekly summary of progress, changes, and asks.

Each Pulse card should show:

- What changed.
- Why it matters.
- The actor and timestamp.
- The canonical source.
- The accountable owner.
- A direct next action such as confirm, assign, open source, approve, or resolve.

Authored updates and meeting minutes may use a note-like reading layout. Raw activity should use compact event cards so users do not confuse an automatically generated event with an authoritative project record.

### Meetings

A meeting is a first-class project object with:

- Purpose, agenda, attendees, and related project context.
- Notes and decisions.
- Action items and owners.
- Open questions and parking-lot items.
- Follow-up date.

The post-meeting workflow is:

1. The meeting record remains a draft after capture.
2. The system proposes actions, decisions, risks, and links with source references.
3. The facilitator reviews, edits, assigns, and confirms the proposals.
4. Confirmed actions become Work items; confirmed choices become Decisions; confirmed threats become Risks.
5. Approved minutes appear in Pulse and Project Knowledge.

The facilitator owns the accuracy of the meeting record. The extracted task owner owns execution afterward. The decision owner owns the decision record afterward.

### Updates

An Update is a structured status artifact with a reporting period. It should capture:

- Overall health and the reason for it.
- Progress since the previous update.
- Planned work for the next period.
- Blockers, risks, and dependencies.
- Scope, schedule, or forecast changes.
- Decisions or support needed.

The system may draft an update from confirmed Pulse events, but the project lead owns and publishes it. The latest approved Update should power the Project Home summary; drafts should never be presented as current project truth.

### Decisions

Decisions deserve their own register because they explain why the project is moving in a particular direction.

A Decision should include:

- The question being decided.
- Options considered.
- The chosen outcome.
- Rationale and supporting evidence.
- Decision owner and approver.
- Date decided.
- Affected work, milestones, risks, and knowledge artifacts.
- Review date or condition that would trigger reconsideration.

Decision states should be explicit: `proposed`, `decided`, `superseded`, or `reopened`. A decision can be referenced from many notes and tasks, but it must have one canonical record.

### Risks and dependencies

The Risks surface should use a lightweight RAID model:

- **Risk:** a possible future threat.
- **Issue:** a problem already occurring.
- **Assumption:** a condition the plan relies on.
- **Dependency:** work or input controlled by another person, team, or project.

Every active item needs an owner, impact, response or mitigation, target date, and escalation state. Project Home should surface high-impact unresolved items; Pulse should record state changes rather than repeatedly restating the entire register.

### Knowledge

Project Knowledge is a smart collection, not a second storage hierarchy. Suggested views include:

- Brief and scope.
- Plans and requirements.
- Meeting records.
- Decisions.
- Research and references.
- Deliverables.
- Risks and constraints.

The notebook tree remains user-managed. A note keeps one canonical path and can be linked to one or more projects without being copied. Project reachability comes from typed relationships such as:

- `belongs_to_project`
- `references_project`
- `supports_decision`
- `created_from_meeting`
- `produces_deliverable`
- `blocked_by_risk`
- `supersedes_artifact`

Project Knowledge should expose backlinks, related work, related meetings, decisions, and source files. Folders can remain useful as user-created organization, but they should not be the product’s only way to discover project context.

## Ownership and accountability

The system must separate accountability from participation. Every durable operational record has one accountable owner and may have many contributors or watchers.

- **Project lead:** owns the project outcome, scope, health, update cadence, and escalation.
- **Sponsor:** owns strategic priority, funding, and major scope decisions.
- **Milestone or deliverable owner:** owns the delivery forecast and resulting artifact.
- **Task assignee:** owns the next action and execution status.
- **Meeting facilitator:** owns agenda quality and confirmation of minutes.
- **Decision owner:** owns closure, rationale, approval routing, and revisit conditions.
- **Risk owner:** owns mitigation and escalation.
- **Knowledge steward:** owns canonical organization and review hygiene; they do not own the content of every document.
- **Members:** can capture context, comment, propose changes, and accept assigned work.
- **System or AI:** may capture, classify, summarize, suggest, and link; it never owns a commitment, publishes an authoritative record, or silently reassigns work.

Ownership should be visible on every card and detail page. Unowned commitments should be treated as unresolved items and surfaced in Needs attention. The project lead can reassign or escalate, but should not become the default owner of every task.

## Capture, confirmation, and automation rules

Automatic collection needs a trust boundary:

```text
Captured → Proposed → Confirmed → Published → Resolved or Archived
```

- **Captured:** the system observed a source event or a user created raw context.
- **Proposed:** the system suggests a structured task, decision, risk, relation, or summary.
- **Confirmed:** a responsible person accepted or edited the proposal.
- **Published:** the record is allowed to appear as authoritative project information.
- **Resolved or archived:** the active follow-up is complete or no longer relevant.

Every assistive suggestion must include its source, rationale, confidence, and an explicit accept, edit, or reject action. Applying a suggestion should show the resulting mutation before it is committed.

This keeps automatic collection valuable without allowing unreviewed extraction to create false commitments or project history.

## Storage and relationship boundary

The proposal should preserve the current local-first boundaries:

- Project and task records remain structured workspace data.
- Notebook files remain user-managed Markdown content under the notebook tree.
- Links and relations add reachability without moving or duplicating note content.
- Pulse is a derived view over source records and should be rebuildable.
- History and audit data should record who confirmed, changed, reassigned, or published an item.

At implementation time, relations should be represented as stable IDs and typed edges rather than inferred solely from folder names or free-form tags. Existing `projectId` task relationships and knowledge-graph foundations can be extended without making projects silently own notebook folders.

## Delivery sequence

### Phase 1 — trustworthy project cockpit

- Define canonical IDs, source links, ownership, status, and timestamps.
- Add Project Home, Work, Pulse, and Project Knowledge navigation.
- Build the Needs attention queue from existing task, milestone, and dependency data.
- Keep Pulse read-only with links to source records.

### Phase 2 — structured coordination

- Add Meeting and Update records.
- Add Capture Inbox review for proposed tasks, decisions, risks, and relations.
- Publish only confirmed minutes and updates to Pulse.
- Add source and provenance details to every extracted item.

### Phase 3 — project control

- Add the Decision register and RAID surfaces.
- Add health evidence and milestone forecast changes.
- Add My Commitments and cross-project dependency views.
- Add weekly digest and project-review workflows.

### Later — external collection

Calendar, chat, documents, repositories, and provider integrations can contribute source events after the internal model is trustworthy. External sources should enter the same review and provenance pipeline rather than bypass it.

## Non-goals

- A social activity wall with likes, reactions, or unbounded posting.
- A hidden project-specific copy of the notebook tree.
- Silent AI-created tasks, decisions, or status changes.
- Treating a note checkbox as a substitute for an owned Work item.
- Replacing every specialized project-management tool on the first release.

## Success criteria

The feature is helping project management when:

- Every committed action has an owner, a source, and a visible next step.
- Meeting follow-up is confirmed quickly and does not remain trapped in minutes.
- A user can find the canonical decision and its rationale without searching multiple notes.
- Project Home surfaces unresolved work, risks, and decisions before historical activity.
- A project lead can publish an accurate status update from confirmed evidence.
- Users can reach project context from either the project or the note without duplicate content.
- Pulse reduces coordination cost instead of adding another inbox to maintain.
