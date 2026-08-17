import { describe, expect, it } from 'vitest'
import { buildPythonSpawnCommand, runScript } from '../src/main/scheduleRunner'
import type { ScheduleJob } from '../src/shared/scheduleTypes'

function createJob(code: string, permissions: ScheduleJob['permissions'] = []): ScheduleJob {
  return {
    id: 'job-test-runner',
    name: 'Test runner job',
    enabled: true,
    trigger: { type: 'manual' },
    runtime: 'javascript',
    code,
    permissions,
    outputMode: 'auto_apply',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('schedule runner', () => {
  it('uses system Python by default', () => {
    expect(buildPythonSpawnCommand(null)).toEqual({
      command: process.platform === 'win32' ? 'python' : 'python3',
      args: ['-c']
    })
  })

  it('runs Python through the selected Conda environment', () => {
    expect(buildPythonSpawnCommand('/opt/conda/envs/automation')).toEqual({
      command: process.platform === 'win32' ? 'conda.exe' : 'conda',
      args: ['run', '--no-capture-output', '--prefix', '/opt/conda/envs/automation', 'python', '-c']
    })
  })

  it('uses a resolved Conda executable when one is available', () => {
    expect(
      buildPythonSpawnCommand('/opt/conda/envs/automation', '/opt/homebrew/bin/conda')
    ).toEqual({
      command: '/opt/homebrew/bin/conda',
      args: ['run', '--no-capture-output', '--prefix', '/opt/conda/envs/automation', 'python', '-c']
    })
  })

  it('awaits asynchronous JavaScript before collecting actions', async () => {
    const result = await runScript(
      createJob(`
        await new Promise((resolve) => setTimeout(resolve, 5))
        beacon.emit({
          type: 'task.create',
          title: 'Async task',
          automationSource: 'test',
          automationSourceKey: 'async-task'
        })
      `)
    )

    expect(result.error).toBeUndefined()
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0]).toMatchObject({
      type: 'task.create',
      title: 'Async task'
    })
  })

  it('validates emitted actions before returning them', async () => {
    const result = await runScript(
      createJob(`
        beacon.emit({
          type: 'task.create',
          title: '',
          automationSource: 'test',
          automationSourceKey: 'invalid-task'
        })
      `)
    )

    expect(result.actions).toEqual([])
    expect(result.error).toContain('Invalid schedule actions')
  })

  it('redacts secret values from JavaScript output', async () => {
    const result = await runScript(
      createJob(
        `
          console.log(secrets.get('MCV_PASSWORD'))
          beacon.emit({
            type: 'task.create',
            title: 'Secret-safe task',
            automationSource: 'test',
            automationSourceKey: 'secret-safe-task'
          })
        `,
        ['useSecrets']
      ),
      { MCV_PASSWORD: 'do-not-print-this' }
    )

    expect(result.error).toBeUndefined()
    expect(result.stdout).toContain('[REDACTED]')
    expect(result.stdout).not.toContain('do-not-print-this')
  })
})
