import { describe, expect, it, vi } from 'vitest'
import { createLatestRefreshCoordinator } from '../src/renderer/src/lib/latestRefreshCoordinator'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('createLatestRefreshCoordinator', () => {
  it('discards an in-flight stale snapshot when a newer refresh is requested', async () => {
    const firstRead = deferred<string>()
    const secondRead = deferred<string>()
    const reads = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(firstRead.promise)
      .mockReturnValueOnce(secondRead.promise)
    const applied: string[] = []
    const refresh = createLatestRefreshCoordinator(reads, (value) => applied.push(value))

    const firstRequest = refresh()
    await Promise.resolve()
    const secondRequest = refresh()

    firstRead.resolve('stale')
    await Promise.resolve()
    expect(reads).toHaveBeenCalledTimes(2)

    secondRead.resolve('fresh')
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual(['fresh', 'fresh'])
    expect(applied).toEqual(['fresh'])
  })
})
