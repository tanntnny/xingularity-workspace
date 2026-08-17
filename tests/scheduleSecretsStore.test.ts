import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let storeRoot = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => storeRoot
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^encrypted:/, '')
  }
}))

import { ScheduleSecretsStore } from '../src/main/scheduleSecretsStore'

describe('ScheduleSecretsStore', () => {
  beforeEach(async () => {
    storeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-secret-test-'))
  })

  afterEach(async () => {
    await fs.rm(storeRoot, { recursive: true, force: true })
  })

  it('persists encrypted values and resolves only configured names', async () => {
    const store = new ScheduleSecretsStore()

    await store.save('MCV_USERNAME', 'student@example.com')
    await store.save('MCV_PASSWORD', 'password-value')

    expect(await store.listNames()).toEqual(['MCV_PASSWORD', 'MCV_USERNAME'])
    expect(await store.resolve(['MCV_USERNAME', 'MCV_PASSWORD'])).toEqual({
      MCV_USERNAME: 'student@example.com',
      MCV_PASSWORD: 'password-value'
    })

    const raw = await fs.readFile(path.join(storeRoot, 'schedule-secrets.json'), 'utf8')
    expect(raw).not.toContain('password-value')
    expect(raw).not.toContain('student@example.com')
  })

  it('rejects unsafe secret names', async () => {
    const store = new ScheduleSecretsStore()

    await expect(store.save('MCV PASSWORD', 'value')).rejects.toThrow('Secret names must start')
  })
})
