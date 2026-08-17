import { describe, expect, it } from 'vitest'
import { NotebookMutationQueue } from '../src/main/notebookMutationQueue'

describe('NotebookMutationQueue', () => {
  it('runs mutations serially', async () => {
    const queue = new NotebookMutationQueue()
    const events: string[] = []
    let releaseFirst!: () => void
    const firstReady = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = queue.enqueue(async () => {
      events.push('first:start')
      await firstReady
      events.push('first:end')
    })
    const second = queue.enqueue(async () => {
      events.push('second:start')
    })

    await Promise.resolve()
    expect(events).toEqual(['first:start'])

    releaseFirst()
    await Promise.all([first, second])
    expect(events).toEqual(['first:start', 'first:end', 'second:start'])
  })

  it('continues processing after a rejected mutation', async () => {
    const queue = new NotebookMutationQueue()

    await expect(
      queue.enqueue(async () => {
        throw new Error('first failed')
      })
    ).rejects.toThrow('first failed')

    await expect(
      queue.enqueue(async () => {
        return 'second completed'
      })
    ).resolves.toBe('second completed')
  })
})
