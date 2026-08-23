import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectVaultDiagnostics, scanVaultFiles } from '../src/main/vaultDiagnostics'

const tempRoots: string[] = []

describe('vault diagnostics and portable scan', () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
    )
  })

  it('keeps credentials and rebuildable indexes out of portable files', async () => {
    const root = await makeVault()
    await fs.mkdir(path.join(root, 'notebooks'), { recursive: true })
    await fs.mkdir(path.join(root, 'attachments'), { recursive: true })
    await fs.writeFile(path.join(root, 'notebooks', 'welcome.md'), '# Welcome', 'utf-8')
    await fs.writeFile(path.join(root, 'attachments', 'image.bin'), Buffer.from([1, 2, 3]))
    await fs.writeFile(path.join(root, 'credentials.json'), '{"token":"do-not-export"}', 'utf-8')
    await fs.writeFile(path.join(root, 'index.sqlite'), 'index', 'utf-8')
    await fs.writeFile(path.join(root, 'filemap.json'), '{}', 'utf-8')

    const files = await scanVaultFiles(root)

    expect(files.map((file) => file.path)).toEqual([
      'attachments/image.bin',
      'notebooks/welcome.md'
    ])
  })

  it('reports malformed structured files, stale backups, legacy paths, and symlinks', async () => {
    const root = await makeVault()
    await fs.mkdir(path.join(root, 'notes'), { recursive: true })
    await fs.writeFile(path.join(root, 'notes', 'legacy.md'), 'legacy', 'utf-8')
    await fs.writeFile(path.join(root, 'broken.json'), '{', 'utf-8')
    await fs.writeFile(path.join(root, 'missing.md.bak'), 'old', 'utf-8')
    await fs.writeFile(path.join(root, 'index.sqlite'), 'index', 'utf-8')
    try {
      await fs.symlink(path.join(root, 'outside'), path.join(root, 'escape'))
    } catch {
      // Symlink creation can be disabled in a restricted test environment.
    }

    const report = await collectVaultDiagnostics(root)
    const issueCodes = report.issues.map((issue) => issue.code)

    expect(report.schemaVersion).toBe(1)
    expect(report.legacyPaths).toContain('notes')
    expect(report.orphanedPaths).toContain('missing.md.bak')
    expect(issueCodes).toContain('malformed-structured-file')
    expect(issueCodes).toContain('orphaned-backup')
    expect(issueCodes).toContain('legacy-layout')
    expect(issueCodes).toContain('rebuildable-index')
    if (await pathExists(path.join(root, 'escape'))) {
      expect(issueCodes).toContain('symlink-skipped')
    }
  })
})

async function makeVault(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-vault-diagnostics-'))
  tempRoots.push(root)
  return root
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.lstat(targetPath)
    return true
  } catch {
    return false
  }
}
