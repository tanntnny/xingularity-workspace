import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentToolsService } from '../src/main/agentToolsService'
import type { VaultRuntime } from '../src/main/runtime'
import type { WeeklyPlanService } from '../src/main/planning/weeklyPlanService'
import { createVaultManifest, VAULT_MANIFEST_RELATIVE_PATH } from '../src/main/vaultManifest'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('AgentToolsService workspace context tool', () => {
  it('reads the active vault through the bounded context reader without exposing private records', async () => {
    const root = await makeVault()
    await fs.mkdir(path.join(root, '.xingularity'), { recursive: true })
    await fs.mkdir(path.join(root, 'notebooks'), { recursive: true })
    await fs.writeFile(
      path.join(root, VAULT_MANIFEST_RELATIVE_PATH),
      `${JSON.stringify(createVaultManifest({ vaultId: 'agent-context-vault' }))}\n`,
      'utf8'
    )
    await fs.writeFile(
      path.join(root, 'notebooks', 'launch.md'),
      '# Launch plan\n\nPrepare the launch review.\n',
      'utf8'
    )
    await fs.writeFile(
      path.join(root, 'credentials.json'),
      JSON.stringify({ apiKey: 'private-agent-token' }),
      'utf8'
    )

    const runtime = {
      getCurrentVaultRoot: () => root
    } as unknown as VaultRuntime
    const service = new AgentToolsService(runtime, {} as WeeklyPlanService)

    const context = await service.invoke('workspace.context', {
      query: 'launch',
      maxChars: 1_000,
      limit: 5
    })

    expect(context).toMatchObject({
      rootPath: '[active vault]',
      scope: { query: 'launch', maxChars: 1_000, limit: 5 },
      notes: [{ path: 'notebooks/launch.md', title: 'Launch plan' }]
    })
    expect(JSON.stringify(context)).not.toContain(root)
    expect(JSON.stringify(context)).not.toContain('private-agent-token')
  })

  it('rejects unbounded or malformed tool input before reading the vault', async () => {
    const root = await makeVault()
    const runtime = {
      getCurrentVaultRoot: () => root
    } as unknown as VaultRuntime
    const service = new AgentToolsService(runtime, {} as WeeklyPlanService)

    await expect(service.invoke('workspace.context', { maxChars: 999_999 })).rejects.toThrow()
  })
})

async function makeVault(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-agent-context-'))
  roots.push(root)
  return root
}
