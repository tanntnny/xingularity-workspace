import { describe, expect, it, vi } from 'vitest'
import { createNoteSaveCoordinator } from '../src/renderer/src/lib/noteSaveCoordinator'

describe('createNoteSaveCoordinator', () => {
  it('runs saves in order and only refreshes the latest persisted state', async () => {
    const writes: string[] = []
    const persisted: string[] = []
    let releaseFirstWrite: (() => void) | undefined

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

    const firstSave = coordinator.enqueue({
      relPath: 'note.md',
      content: 'first',
      document: { version: 1, tags: [], markdown: 'first' }
    })
    const secondSave = coordinator.enqueue({
      relPath: 'note.md',
      content: 'second',
      document: { version: 1, tags: [], markdown: 'second' }
    })

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
      coordinator.enqueue({
        relPath: 'note.md',
        content: 'broken',
        document: { version: 1, tags: [], markdown: 'broken' }
      })
    ).rejects.toThrow('write failed')

    await coordinator.enqueue({
      relPath: 'note.md',
      content: 'recovered',
      document: { version: 1, tags: [], markdown: 'recovered' }
    })

    expect(onPersisted).toHaveBeenCalledTimes(1)
    expect(onPersisted).toHaveBeenCalledWith({
      relPath: 'note.md',
      content: 'recovered',
      document: { version: 1, tags: [], markdown: 'recovered' }
    })
  })

  it('keeps each workspace tab on its own compare-and-swap baseline', async () => {
    const bases: Array<{ content: string; baseHash: string | null; workspaceTabId?: string }> = []
    let revisionNumber = 0
    const coordinator = createNoteSaveCoordinator({
      writeNote: async ({ content, baseHash, workspaceTabId }) => {
        bases.push({ content, baseHash: baseHash ?? null, workspaceTabId })
        revisionNumber += 1
        return {
          ok: true,
          path: 'note.md',
          revision: {
            contentHash: `sha256:written-${revisionNumber}`,
            size: content.length,
            mtimeMs: revisionNumber
          },
          transactionId: `tx-${revisionNumber}`
        }
      }
    })

    coordinator.setBaseRevision('note.md', 'sha256:base', 'tab-two')

    await coordinator.enqueue({
      relPath: 'note.md',
      content: 'tab one draft',
      document: { version: 1, tags: [], markdown: 'tab one draft' },
      baseHash: 'sha256:base',
      workspaceTabId: 'tab-one'
    })
    await coordinator.enqueue({
      relPath: 'note.md',
      content: 'tab two draft',
      document: { version: 1, tags: [], markdown: 'tab two draft' },
      baseHash: 'sha256:base',
      workspaceTabId: 'tab-two'
    })

    expect(bases).toEqual([
      { content: 'tab one draft', baseHash: 'sha256:base', workspaceTabId: 'tab-one' },
      { content: 'tab two draft', baseHash: 'sha256:base', workspaceTabId: 'tab-two' }
    ])
  })
})
