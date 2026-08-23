import { app, safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from '../shared/hash'
import type { CredentialStatus } from '../shared/types'

interface StoredCredential {
  encryptedValue: string
  updatedAt: string
}

type StoredCredentials = Record<string, StoredCredential>

export function credentialKey(provider: string, vaultRoot: string): string {
  return `${provider.trim().toLowerCase()}:${sha256(path.resolve(vaultRoot))}`
}

export class CredentialStore {
  private get filePath(): string {
    return path.join(app.getPath('userData'), 'credentials.json')
  }

  async get(provider: string, vaultRoot: string): Promise<string | null> {
    const record = (await this.read())[credentialKey(provider, vaultRoot)]
    if (!record) {
      return null
    }
    this.assertEncryptionAvailable()
    return safeStorage.decryptString(Buffer.from(record.encryptedValue, 'base64'))
  }

  async status(provider: string, vaultRoot: string): Promise<CredentialStatus> {
    const record = (await this.read())[credentialKey(provider, vaultRoot)]
    return {
      provider,
      configured: Boolean(record),
      scope: 'vault',
      updatedAt: record?.updatedAt
    }
  }

  async set(provider: string, vaultRoot: string, value: string): Promise<CredentialStatus> {
    const normalizedProvider = normalizeProvider(provider)
    const normalizedValue = value.trim()
    if (!normalizedValue) {
      await this.delete(normalizedProvider, vaultRoot)
      return this.status(normalizedProvider, vaultRoot)
    }

    this.assertEncryptionAvailable()
    const stored = await this.read()
    stored[credentialKey(normalizedProvider, vaultRoot)] = {
      encryptedValue: safeStorage.encryptString(normalizedValue).toString('base64'),
      updatedAt: new Date().toISOString()
    }
    await this.write(stored)
    return this.status(normalizedProvider, vaultRoot)
  }

  async delete(provider: string, vaultRoot: string): Promise<void> {
    const stored = await this.read()
    delete stored[credentialKey(provider, vaultRoot)]
    await this.write(stored)
  }

  private async read(): Promise<StoredCredentials> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {}
      }
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([key, value]) =>
            key.length <= 200 &&
            value !== null &&
            typeof value === 'object' &&
            typeof (value as StoredCredential).encryptedValue === 'string' &&
            typeof (value as StoredCredential).updatedAt === 'string'
        )
      ) as StoredCredentials
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {}
      }
      throw error
    }
  }

  private async write(stored: StoredCredentials): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp-${process.pid}`
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(temporaryPath, JSON.stringify(stored, null, 2), 'utf-8')
    await fs.rename(temporaryPath, this.filePath)
  }

  private assertEncryptionAvailable(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is not available on this device')
    }
  }
}

function normalizeProvider(provider: string): string {
  const normalized = provider.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(normalized)) {
    throw new Error('Credential provider has an invalid name')
  }
  return normalized
}
