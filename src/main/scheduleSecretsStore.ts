import { app, safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

const SECRET_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/

export class ScheduleSecretsStore {
  private get filePath(): string {
    return path.join(app.getPath('userData'), 'schedule-secrets.json')
  }

  async listNames(): Promise<string[]> {
    const stored = await this.readStored()
    return Object.keys(stored).sort()
  }

  async save(name: string, value: string): Promise<void> {
    this.assertName(name)
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure secret storage is not available on this device')
    }

    const stored = await this.readStored()
    stored[name] = safeStorage.encryptString(value).toString('base64')
    await this.writeStored(stored)
  }

  async delete(name: string): Promise<void> {
    this.assertName(name)
    const stored = await this.readStored()
    if (!Object.hasOwn(stored, name)) {
      return
    }

    delete stored[name]
    await this.writeStored(stored)
  }

  async resolve(names: string[]): Promise<Record<string, string>> {
    if (names.length === 0) {
      return {}
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure secret storage is not available on this device')
    }

    const stored = await this.readStored()
    const resolved: Record<string, string> = {}
    for (const name of names) {
      this.assertName(name)
      const encoded = stored[name]
      if (!encoded) {
        throw new Error(`Configured schedule secret not found: ${name}`)
      }
      resolved[name] = safeStorage.decryptString(Buffer.from(encoded, 'base64'))
    }

    return resolved
  }

  private async readStored(): Promise<Record<string, string>> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Schedule secret store is invalid')
      }

      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([name, value]) => SECRET_NAME_PATTERN.test(name) && typeof value === 'string'
        )
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {}
      }
      throw error
    }
  }

  private async writeStored(stored: Record<string, string>): Promise<void> {
    const filePath = this.filePath
    const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(temporaryPath, JSON.stringify(stored, null, 2), 'utf-8')
    await fs.rename(temporaryPath, filePath)
  }

  private assertName(name: string): void {
    if (!SECRET_NAME_PATTERN.test(name)) {
      throw new Error(
        'Secret names must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens'
      )
    }
  }
}

