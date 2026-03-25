import { describe, expect, it, vi } from 'vitest'
import { createNoteSaveCoordinator } from '../src/renderer/src/lib/noteSaveCoordinator'

describe('createNoteSaveCoordinator', () => {
  it('runs saves in order and only refreshes the latest persisted state', async () => {
    const writes: string[] = []
    const persisted: string[] = []
    let releaseFirstWrite: (() => void) | null = null

    const coordinator = createNoteSaveCoordinator({
      writeNote: async ({ content }) => {
        writes.push(content)
        if (content === 'first') {
          await new Promise<void>((resolve) => {
            releaseFirstWrite = resolve
          })
        }
      },
      onPersisted: async ({ content }) => {
        persisted.push(content)
      }
    })

    const firstSave = coordinator.enqueue({ relPath: 'note.md', content: 'first' })
    const secondSave = coordinator.enqueue({ relPath: 'note.md', content: 'second' })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(writes).toEqual(['first'])

    releaseFirstWrite?.()
    await firstSave
    await secondSave

    expect(writes).toEqual(['first', 'second'])
    expect(persisted).toEqual(['second'])
  })

  it('continues processing later saves after a failed write', async () => {
    const onPersisted = vi.fn()
    const coordinator = createNoteSaveCoordinator({
      writeNote: async ({ content }) => {
        if (content === 'broken') {
          throw new Error('write failed')
        }
      },
      onPersisted
    })

    await expect(
      coordinator.enqueue({ relPath: 'note.md', content: 'broken' })
    ).rejects.toThrow('write failed')

    await coordinator.enqueue({ relPath: 'note.md', content: 'recovered' })

    expect(onPersisted).toHaveBeenCalledTimes(1)
    expect(onPersisted).toHaveBeenCalledWith({ relPath: 'note.md', content: 'recovered' })
  })
})
