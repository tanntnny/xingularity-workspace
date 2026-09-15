import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runXWorkspace } from '../src/cli/xWorkspaceCli'
import { createVaultManifest, writeVaultManifest } from '../src/main/vaultManifest'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

async function makeVault(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-vault-'))
  roots.push(root)
  await fs.mkdir(path.join(root, 'notebooks'), { recursive: true })
  await fs.mkdir(path.join(root, 'projects'), { recursive: true })
  await fs.mkdir(path.join(root, 'tasks'), { recursive: true })
  await fs.mkdir(path.join(root, 'resources'), { recursive: true })
  await fs.mkdir(path.join(root, '.xingularity'), { recursive: true })
  await writeVaultManifest(root, createVaultManifest({ vaultId: `test-${path.basename(root)}` }))
  return root
}

function cliOptions(configDir: string): { configDir: string } {
  return { configDir }
}

describe('x-workspace CLI', () => {
  it('requires one explicit vault binding and rejects a second vault', async () => {
    const root = await makeVault()
    const secondRoot = await makeVault()
    const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-config-'))
    roots.push(configDir)

    const unbound = await runXWorkspace(['status'], cliOptions(configDir))
    expect(unbound).toMatchObject({
      ok: false,
      error: { code: 'vault-unbound' }
    })

    const bound = await runXWorkspace(['vault', 'set', root, '--confirm'], cliOptions(configDir))
    expect(bound).toMatchObject({
      ok: true,
      data: { bound: true, vaultId: `test-${path.basename(root).toLowerCase()}` }
    })

    const second = await runXWorkspace(
      ['vault', 'set', secondRoot, '--confirm'],
      cliOptions(configDir)
    )
    expect(second).toMatchObject({
      ok: false,
      error: { code: 'vault-already-bound' }
    })
  })

  it('does not accept a root override or infer a vault from the working directory', async () => {
    const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-config-'))
    roots.push(configDir)

    const response = await runXWorkspace(
      ['status', '--root', '/tmp/other-vault'],
      cliOptions(configDir)
    )

    expect(response).toMatchObject({
      ok: false,
      error: { code: 'invalid-command' }
    })
  })

  it('previews and applies a note mutation using a short-lived token', async () => {
    const root = await makeVault()
    const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-config-'))
    roots.push(configDir)
    const options = cliOptions(configDir)

    await runXWorkspace(['vault', 'set', root, '--confirm'], options)
    const preview = await runXWorkspace(
      [
        'note',
        'create',
        '--input',
        JSON.stringify({ path: 'plan.md', markdown: '# Plan\n', tags: ['agent'] })
      ],
      options
    )

    expect(preview).toMatchObject({
      ok: true,
      data: {
        kind: 'preview',
        operation: 'note.create'
      }
    })
    const token = (preview.data as { approvalToken: string }).approvalToken
    const applied = await runXWorkspace(['apply', token], options)
    expect(applied).toMatchObject({
      ok: true,
      data: {
        kind: 'commit',
        operation: 'note.create',
        transactionId: expect.any(String)
      }
    })

    const read = await runXWorkspace(['note', 'read', '--path', 'plan.md'], options)
    expect(read).toMatchObject({
      ok: true,
      data: { path: 'plan.md', content: expect.stringContaining('# Plan') }
    })
  })

  it('does not preview note creation over an existing non-file path', async () => {
    const root = await makeVault()
    const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-config-'))
    roots.push(configDir)
    const options = cliOptions(configDir)
    await runXWorkspace(['vault', 'set', root, '--confirm'], options)
    await fs.mkdir(path.join(root, 'notebooks', 'occupied.md'))

    const response = await runXWorkspace(
      [
        'note',
        'create',
        '--input',
        JSON.stringify({ path: 'occupied.md', markdown: 'do not replace' })
      ],
      options
    )

    expect(response).toMatchObject({ ok: false, error: { code: 'conflict' } })
  })

  it('rejects a preview when canonical vault content changes before apply', async () => {
    const root = await makeVault()
    const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-config-'))
    roots.push(configDir)
    const options = cliOptions(configDir)
    await runXWorkspace(['vault', 'set', root, '--confirm'], options)

    const preview = await runXWorkspace(
      ['note', 'create', '--input', JSON.stringify({ path: 'stale.md', markdown: 'planned' })],
      options
    )
    await fs.writeFile(path.join(root, 'notebooks', 'other.md'), 'external change\n', 'utf8')

    const applied = await runXWorkspace(
      ['apply', (preview.data as { approvalToken: string }).approvalToken],
      options
    )
    expect(applied).toMatchObject({
      ok: false,
      error: { code: 'plan-stale' }
    })
    const reapplied = await runXWorkspace(
      ['apply', (preview.data as { approvalToken: string }).approvalToken],
      options
    )
    expect(reapplied).toMatchObject({ ok: false, error: { code: 'plan-invalid' } })
  })

  it('initializes and binds a new vault, then requires confirmation to reset it', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-init-'))
    const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-config-'))
    roots.push(root, configDir)
    const options = cliOptions(configDir)

    const initialized = await runXWorkspace(['vault', 'init', root, '--confirm'], options)
    expect(initialized).toMatchObject({ ok: true, data: { bound: true } })
    await expect(fs.stat(path.join(root, '.xingularity', 'manifest.json'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(root, 'notebooks'))).resolves.toBeTruthy()

    const resetWithoutConfirmation = await runXWorkspace(['vault', 'reset'], options)
    expect(resetWithoutConfirmation).toMatchObject({
      ok: false,
      error: { code: 'invalid-input' }
    })
    const reset = await runXWorkspace(['vault', 'reset', '--confirm'], options)
    expect(reset).toMatchObject({ ok: true, data: { bound: false, reset: true } })
  })

  it('creates project, task, update, meeting, and resource records through the shared service', async () => {
    const root = await makeVault()
    const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-config-'))
    roots.push(configDir)
    const options = cliOptions(configDir)
    await runXWorkspace(['vault', 'set', root, '--confirm'], options)

    const projectPreview = await runXWorkspace(
      ['project', 'create', '--input', JSON.stringify({ name: 'CLI Project' })],
      options
    )
    const projectCommit = await runXWorkspace(
      ['apply', (projectPreview.data as { approvalToken: string }).approvalToken],
      options
    )
    const project = (projectCommit.data as { result: { id: string } }).result

    const taskPreview = await runXWorkspace(
      [
        'project',
        'task',
        'create',
        '--input',
        JSON.stringify({ projectId: project.id, title: 'CLI task' })
      ],
      options
    )
    await runXWorkspace(
      ['apply', (taskPreview.data as { approvalToken: string }).approvalToken],
      options
    )

    const updatePreview = await runXWorkspace(
      [
        'project',
        'update',
        'create',
        '--input',
        JSON.stringify({
          projectId: project.id,
          markdown: 'On track',
          status: 'on-track'
        })
      ],
      options
    )
    await runXWorkspace(
      ['apply', (updatePreview.data as { approvalToken: string }).approvalToken],
      options
    )

    const meetingPreview = await runXWorkspace(
      [
        'project',
        'meeting',
        'create',
        '--input',
        JSON.stringify({
          projectId: project.id,
          markdown: 'Decided to ship',
          type: 'planning',
          outcome: 'decisions-made'
        })
      ],
      options
    )
    await runXWorkspace(
      ['apply', (meetingPreview.data as { approvalToken: string }).approvalToken],
      options
    )

    const resourcePreview = await runXWorkspace(
      [
        'resource',
        'create',
        '--input',
        JSON.stringify({ canonicalUri: 'https://example.com/reference', title: 'Reference' })
      ],
      options
    )
    await runXWorkspace(
      ['apply', (resourcePreview.data as { approvalToken: string }).approvalToken],
      options
    )

    const context = await runXWorkspace(['context', '--max-chars', '12000'], options)
    expect(context).toMatchObject({
      ok: true,
      data: {
        projects: [
          {
            name: 'CLI Project',
            updates: [{ content: 'On track' }],
            meetings: [{ content: 'Decided to ship' }]
          }
        ],
        tasks: [{ title: 'CLI task' }],
        resources: [{ title: 'Reference' }]
      }
    })

    const resources = await runXWorkspace(['resource', 'list'], options)
    expect(resources).toMatchObject({ ok: true, data: { resources: [{ title: 'Reference' }] } })
    expect(resources.data).not.toHaveProperty('locators')
  })

  it('keeps a recovery snapshot when deleting a resource', async () => {
    const root = await makeVault()
    const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-config-'))
    roots.push(configDir)
    const options = cliOptions(configDir)
    await runXWorkspace(['vault', 'set', root, '--confirm'], options)

    const created = await runXWorkspace(
      [
        'resource',
        'create',
        '--input',
        JSON.stringify({ canonicalUri: 'https://example.com/reference', title: 'Reference' })
      ],
      options
    )
    const createdCommit = await runXWorkspace(
      ['apply', (created.data as { approvalToken: string }).approvalToken],
      options
    )
    const resourceId = (createdCommit.data as { result: { id: string } }).result.id

    const deletion = await runXWorkspace(
      ['resource', 'delete', '--input', JSON.stringify({ resourceId })],
      options
    )
    const deleted = await runXWorkspace(
      ['apply', (deletion.data as { approvalToken: string }).approvalToken],
      options
    )
    const result = deleted.data as { result: { operationId: string } }

    await expect(
      fs.stat(path.join(root, '.xingularity', 'trash', result.result.operationId, 'resources.json'))
    ).resolves.toBeTruthy()
  })
})
