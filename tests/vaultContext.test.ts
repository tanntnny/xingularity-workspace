import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildVaultContext,
  readVaultNote,
  readVaultManifestReport,
  searchVaultContext
} from '../src/main/vaultContext'
import { createVaultManifest, VAULT_MANIFEST_RELATIVE_PATH } from '../src/main/vaultManifest'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('vault context reader', () => {
  it('builds bounded context from canonical records without exposing private payloads', async () => {
    const root = await makeVault()
    await seedVault(root)
    await fs.writeFile(path.join(root, 'credentials.json'), '{"token":"private-token"}', 'utf8')
    await fs.writeFile(
      path.join(root, 'schedules', 'jobs.json'),
      JSON.stringify([
        {
          id: 'schedule-1',
          name: 'Daily sync',
          script: 'console.log("do not expose this")',
          runtime: 'node',
          trigger: { type: 'daily', time: '09:30', timezone: 'Asia/Bangkok' },
          enabled: true
        }
      ]),
      'utf8'
    )
    await fs.writeFile(
      path.join(root, 'agent', 'chats.json'),
      JSON.stringify([
        {
          id: 'chat-1',
          title: 'Private transcript',
          updatedAt: '2026-09-10T00:00:00.000Z',
          messages: [{ role: 'user', content: 'do not expose transcript body' }]
        }
      ]),
      'utf8'
    )
    await fs.writeFile(
      path.join(root, 'calendar', 'state.json'),
      JSON.stringify({
        kind: 'xingularity.calendar.state',
        version: 1,
        state: {
          schemaVersion: 1,
          events: [
            {
              id: 'event-1',
              title: 'Atlas design review',
              allDay: false,
              start: '2026-09-12T10:00:00.000Z',
              end: '2026-09-12T11:00:00.000Z',
              source: 'google',
              projectId: 'project-atlas',
              attendees: [{ email: 'private@example.com' }]
            }
          ],
          links: [],
          connections: [
            {
              id: 'connection-1',
              provider: 'google',
              accountLabel: 'Work calendar',
              email: 'private@example.com',
              status: 'connected',
              selectedCalendarIds: ['calendar-1'],
              syncCursor: 'private-cursor'
            }
          ],
          calendars: []
        }
      }),
      'utf8'
    )

    const context = await buildVaultContext(root, {
      maxChars: 1_000,
      limit: 5,
      includeDiagnostics: false
    })

    expect(context.schemaVersion).toBe(1)
    expect(context.vault.manifest).toMatchObject({
      valid: true,
      manifest: { vaultId: 'context-vault' }
    })
    expect(context.notes[0]).toMatchObject({
      path: 'notebooks/Atlas/brief.md',
      title: 'Atlas brief',
      tags: ['project', 'atlas']
    })
    expect(context.projects[0]).toMatchObject({
      id: 'project-atlas',
      name: 'Atlas',
      taskCount: 1,
      openTaskCount: 1
    })
    expect(context.tasks[0]).toMatchObject({ id: 'task-1', projectId: 'project-atlas' })
    expect(context.calendar.events[0]).toMatchObject({
      id: 'event-1',
      title: 'Atlas design review',
      projectId: 'project-atlas'
    })
    expect(context.calendar.connections[0]).toMatchObject({
      id: 'connection-1',
      status: 'connected'
    })
    expect(context.schedules[0]).not.toHaveProperty('script')
    expect(context.schedules[0]).toMatchObject({ trigger: 'daily · 09:30 · Asia/Bangkok' })
    expect(context.agent.sessions[0]).not.toHaveProperty('messages')
    expect(JSON.stringify(context)).not.toContain('private-token')
    expect(JSON.stringify(context)).not.toContain('private@example.com')
    expect(JSON.stringify(context)).not.toContain('private-cursor')
    expect(JSON.stringify(context)).not.toContain('do not expose this')
    expect(JSON.stringify(context)).not.toContain('do not expose transcript body')
    expect(context.budget.contentChars).toBeLessThanOrEqual(1_000)
    expect(context.budget.truncated).toBe(true)
  })

  it('supports project-scoped context and strips secrets from resource URLs', async () => {
    const root = await makeVault()
    await seedVault(root)
    await fs.writeFile(
      path.join(root, 'resources', 'resources.json'),
      JSON.stringify({
        version: 1,
        resources: [
          {
            id: 'resource-1',
            title: 'Atlas specification',
            provider: 'web',
            kind: 'url',
            canonicalUri: 'https://example.com/spec?access_token=secret#private',
            state: 'available',
            access: 'read-only',
            projectIds: ['project-atlas'],
            updatedAt: '2026-09-10T00:00:00.000Z'
          }
        ]
      }),
      'utf8'
    )

    const context = await buildVaultContext(root, {
      project: 'Atlas',
      maxChars: 4_000,
      includeDiagnostics: false
    })

    expect(context.projects).toHaveLength(1)
    expect(context.tasks).toHaveLength(1)
    expect(context.resources).toMatchObject([{ id: 'resource-1', uri: 'https://example.com/spec' }])
    expect(context.notes).toMatchObject([{ path: 'notebooks/Atlas/brief.md' }])
    expect(JSON.stringify(context)).not.toContain('access_token')
  })

  it('does not expose local file resource locators', async () => {
    const root = await makeVault()
    await seedVault(root)
    await fs.writeFile(
      path.join(root, 'resources', 'resources.json'),
      JSON.stringify({
        version: 1,
        resources: [
          {
            id: 'resource-local',
            title: 'Local research file',
            provider: 'filesystem',
            kind: 'file',
            canonicalUri: 'file:///Users/private/research.pdf?token=secret',
            state: 'available',
            access: 'read-only',
            updatedAt: '2026-09-10T00:00:00.000Z'
          }
        ]
      }),
      'utf8'
    )

    const context = await buildVaultContext(root, { includeDiagnostics: false })
    expect(context.resources).toMatchObject([{ id: 'resource-local', uri: '[local file]' }])
    expect(JSON.stringify(context)).not.toContain('/Users/private/research.pdf')
    expect(JSON.stringify(context)).not.toContain('token=secret')
  })

  it('reads only safe Markdown notes and rejects traversal or non-note paths', async () => {
    const root = await makeVault()
    await seedVault(root)

    const note = await readVaultNote(root, 'Atlas/brief.md', { maxChars: 10_000 })
    expect(note).toMatchObject({
      path: 'notebooks/Atlas/brief.md',
      title: 'Atlas brief',
      truncated: false
    })
    expect(note.content).toContain('Launch the first milestone')

    await expect(readVaultNote(root, '../credentials.json')).rejects.toThrow()
    await expect(readVaultNote(root, 'settings.json')).rejects.toThrow()
  })

  it('returns ranked safe search results across notes, projects, tasks, and resources', async () => {
    const root = await makeVault()
    await seedVault(root)
    await fs.writeFile(
      path.join(root, 'resources', 'resources.json'),
      JSON.stringify({
        version: 1,
        resources: [
          {
            id: 'resource-1',
            title: 'Atlas specification',
            provider: 'web',
            kind: 'url',
            canonicalUri: 'https://example.com/spec',
            state: 'available',
            access: 'read-only',
            updatedAt: '2026-09-10T00:00:00.000Z'
          }
        ]
      }),
      'utf8'
    )

    const results = await searchVaultContext(root, 'Atlas', { limit: 10 })
    expect(results.map((result) => result.kind)).toEqual(
      expect.arrayContaining(['note', 'project', 'task', 'resource'])
    )
    expect(results[0]?.title).toBe('Atlas')
  })

  it('keeps a useful note search result when the match is beyond the leading excerpt', async () => {
    const root = await makeVault()
    await seedVault(root)
    await fs.writeFile(
      path.join(root, 'notebooks', 'long.md'),
      `# Long note\n\n${'background '.repeat(2_000)}needle at the end\n`,
      'utf8'
    )

    const results = await searchVaultContext(root, 'needle', { limit: 10 })
    const result = results.find((candidate) => candidate.path === 'notebooks/long.md')
    expect(result).toMatchObject({ kind: 'note', matchFields: ['body'] })
    expect(result?.snippet).toContain('needle')
  })

  it('reports the stable manifest without creating missing metadata', async () => {
    const root = await makeVault()
    const missing = await readVaultManifestReport(root)
    expect(missing).toMatchObject({ present: false, valid: false })
    await expect(fs.lstat(path.join(root, '.xingularity'))).rejects.toMatchObject({
      code: 'ENOENT'
    })

    await fs.mkdir(path.join(root, '.xingularity'), { recursive: true })
    await fs.writeFile(
      path.join(root, VAULT_MANIFEST_RELATIVE_PATH),
      `${JSON.stringify(createVaultManifest({ vaultId: 'manifest-vault' }))}\n`,
      'utf8'
    )
    await expect(readVaultManifestReport(root)).resolves.toMatchObject({
      present: true,
      valid: true,
      manifest: { vaultId: 'manifest-vault' }
    })
  })
})

async function makeVault(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-vault-context-'))
  roots.push(root)
  return root
}

async function seedVault(root: string): Promise<void> {
  await Promise.all(
    [
      '.xingularity',
      'notebooks/Atlas',
      'projects',
      'tasks',
      'weekly-plan',
      'calendar',
      'resources',
      'schedules',
      'agent'
    ].map((directory) => fs.mkdir(path.join(root, directory), { recursive: true }))
  )
  await fs.writeFile(
    path.join(root, VAULT_MANIFEST_RELATIVE_PATH),
    `${JSON.stringify(createVaultManifest({ vaultId: 'context-vault' }))}\n`,
    'utf8'
  )
  await fs.writeFile(
    path.join(root, 'notebooks', 'Atlas', 'brief.md'),
    `---\ntags: [project, atlas]\n---\n# Atlas brief\n\nLaunch the first milestone with the design review.\n${'context '.repeat(500)}`,
    'utf8'
  )
  await fs.writeFile(
    path.join(root, 'projects', 'project-atlas.json'),
    JSON.stringify({
      id: 'project-atlas',
      name: 'Atlas',
      description: 'Ship the Atlas workspace',
      state: 'active',
      updatedAt: '2026-09-10T00:00:00.000Z',
      milestones: [{ id: 'milestone-1', title: 'First milestone' }]
    }),
    'utf8'
  )
  await fs.writeFile(
    path.join(root, 'tasks', 'task-1.json'),
    JSON.stringify({
      id: 'task-1',
      title: 'Review Atlas launch',
      description: 'Prepare the design review',
      projectId: 'project-atlas',
      status: 'pending',
      completed: false,
      priority: 'high',
      tags: ['atlas'],
      date: '2026-09-12',
      createdAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z'
    }),
    'utf8'
  )
  await fs.writeFile(
    path.join(root, 'weekly-plan', 'state.json'),
    JSON.stringify({ weeks: [], priorities: [], reviews: [] }),
    'utf8'
  )
}
