import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  parseVaultCliArgs,
  runVaultCli,
  serializeVaultCliResponse,
  VAULT_CLI_EXIT_CODES
} from '../src/cli/vaultCli'
import { createVaultManifest, VAULT_MANIFEST_RELATIVE_PATH } from '../src/main/vaultManifest'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('vault CLI', () => {
  it('parses the vault command, safe root defaults, and portable manifest mode', () => {
    expect(parseVaultCliArgs(['vault', 'manifest', '--portable'], { cwd: '/workspace' })).toEqual({
      command: 'manifest',
      rootPath: '/workspace',
      json: true,
      pretty: false,
      portable: true,
      preview: false
    })
    expect(
      parseVaultCliArgs(['vault', 'status', '--root', './vault', '--pretty'], {
        cwd: '/workspace'
      })
    ).toMatchObject({
      command: 'status',
      rootPath: '/workspace/vault',
      json: true,
      pretty: true,
      portable: false
    })
  })

  it('rejects unsupported command options with the stable usage code', () => {
    expect(() => parseVaultCliArgs(['vault', 'scan', '--portable'])).toThrow(
      'only supported by the manifest command'
    )
    expect(() => parseVaultCliArgs(['vault', 'status', '--unknown'])).toThrow('Unknown vault CLI')
  })

  it('serializes a stable JSON envelope without changing its schema when pretty printed', () => {
    const response = {
      ok: true,
      command: 'vault scan',
      exitCode: VAULT_CLI_EXIT_CODES.success,
      data: { fileCount: 1, files: [{ path: 'notebooks/readme.md', size: 4 }] }
    }

    const compact = serializeVaultCliResponse(response)
    const pretty = serializeVaultCliResponse(response, { pretty: true })

    expect(JSON.parse(compact)).toEqual(response)
    expect(JSON.parse(pretty)).toEqual(response)
    expect(compact).not.toContain('\n')
    expect(pretty).toContain('\n  "ok"')
  })

  it('runs read-only manifest, scan, validate, and status commands as JSON data', async () => {
    const root = await makeRoot()
    await fs.mkdir(path.join(root, 'notebooks'), { recursive: true })
    await fs.mkdir(path.join(root, '.xingularity'), { recursive: true })
    await fs.writeFile(path.join(root, 'notebooks', 'readme.md'), '# Read me\n', 'utf8')
    await fs.writeFile(
      path.join(root, VAULT_MANIFEST_RELATIVE_PATH),
      `${JSON.stringify(createVaultManifest({ vaultId: 'cli-test-vault' }))}\n`,
      'utf8'
    )

    const manifest = await runVaultCli(['vault', 'manifest', '--root', root])
    const portableManifest = await runVaultCli(['vault', 'manifest', '--portable', '--root', root])
    const scan = await runVaultCli(['vault', 'scan', '--root', root])
    const validate = await runVaultCli(['vault', 'validate', '--root', root])
    const status = await runVaultCli(['vault', 'status', '--root', root])

    expect(manifest).toMatchObject({
      ok: true,
      command: 'vault manifest',
      exitCode: 0,
      data: { kind: 'stable-vault', manifest: { valid: true } }
    })
    expect(portableManifest).toMatchObject({
      ok: true,
      command: 'vault manifest',
      exitCode: 0,
      data: {
        kind: 'portable-transfer',
        manifest: { files: [{ path: 'notebooks/readme.md' }] }
      }
    })
    expect(scan).toMatchObject({
      ok: true,
      command: 'vault scan',
      exitCode: 0,
      data: { portable: true, fileCount: 1, files: [{ path: 'notebooks/readme.md' }] }
    })
    expect(validate).toMatchObject({ ok: true, command: 'vault validate', exitCode: 0 })
    expect(status).toMatchObject({
      ok: true,
      command: 'vault status',
      exitCode: 0,
      data: {
        manifest: { manifest: { vaultId: 'cli-test-vault' } },
        reconciliation: { scannedFiles: 1, changeCount: 1 }
      }
    })
  })

  it('previews and creates a verified portable backup through the CLI', async () => {
    const root = await makeRoot()
    await fs.mkdir(path.join(root, 'notebooks'), { recursive: true })
    await fs.mkdir(path.join(root, '.xingularity'), { recursive: true })
    await fs.writeFile(path.join(root, 'notebooks', 'readme.md'), '# Read me\n', 'utf8')
    await fs.writeFile(
      path.join(root, VAULT_MANIFEST_RELATIVE_PATH),
      `${JSON.stringify(createVaultManifest({ vaultId: 'backup-cli-test' }))}\n`,
      'utf8'
    )

    const destination = path.join(root, 'portable-backup')
    const preview = await runVaultCli([
      'vault',
      'backup',
      '--preview',
      '--destination',
      destination,
      '--root',
      root
    ])
    expect(preview).toMatchObject({
      ok: true,
      command: 'vault backup',
      exitCode: 0,
      data: {
        kind: 'portable-backup',
        preview: true,
        destinationPath: destination,
        fileCount: 1
      }
    })
    await expect(fs.lstat(destination)).rejects.toMatchObject({ code: 'ENOENT' })

    const backup = await runVaultCli([
      'vault',
      'backup',
      '--destination',
      destination,
      '--root',
      root
    ])
    expect(backup).toMatchObject({
      ok: true,
      command: 'vault backup',
      exitCode: 0,
      data: { kind: 'portable-backup', preview: false, backup: { fileCount: 1 } }
    })
    await expect(
      fs.readFile(path.join(destination, 'notebooks', 'readme.md'), 'utf8')
    ).resolves.toBe('# Read me\n')
  })

  it('returns a machine-readable validation response when the stable manifest is absent', async () => {
    const root = await makeRoot()
    const response = await runVaultCli(['vault', 'manifest', '--root', root])

    expect(response).toMatchObject({
      ok: false,
      command: 'vault manifest',
      exitCode: VAULT_CLI_EXIT_CODES.validation,
      rootPath: root,
      error: {
        code: 'manifest-missing'
      },
      data: {
        manifest: {
          path: VAULT_MANIFEST_RELATIVE_PATH,
          present: false,
          valid: false
        }
      }
    })
  })

  it('returns usage JSON instead of throwing for an invalid command prefix', async () => {
    const response = await runVaultCli(['status'])

    expect(response).toMatchObject({
      ok: false,
      command: 'vault',
      exitCode: VAULT_CLI_EXIT_CODES.usage,
      error: { code: 'invalid-command' }
    })
  })
})

async function makeRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-vault-cli-'))
  roots.push(root)
  return root
}
