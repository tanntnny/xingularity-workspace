interface RefreshWaiter<T> {
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

/**
 * Runs at most one refresh at a time and only applies the newest snapshot.
 * This prevents an older filesystem read from replacing a newer rename or move.
 */
export function createLatestRefreshCoordinator<T>(
  load: () => Promise<T>,
  apply: (value: T) => void
): () => Promise<T> {
  let requestedGeneration = 0
  let appliedGeneration = 0
  let running: Promise<void> | null = null
  const waiters: Array<RefreshWaiter<T> & { generation: number }> = []

  const settleAppliedWaiters = (value: T): void => {
    const settled = waiters.filter((waiter) => waiter.generation <= appliedGeneration)
    for (const waiter of settled) {
      waiter.resolve(value)
    }

    if (settled.length > 0) {
      const settledSet = new Set(settled)
      for (let index = waiters.length - 1; index >= 0; index -= 1) {
        if (settledSet.has(waiters[index])) {
          waiters.splice(index, 1)
        }
      }
    }
  }

  const rejectWaiters = (error: unknown): void => {
    for (const waiter of waiters.splice(0)) {
      waiter.reject(error)
    }
  }

  const run = async (): Promise<void> => {
    try {
      while (appliedGeneration < requestedGeneration) {
        const targetGeneration = requestedGeneration
        const value = await load()

        if (targetGeneration !== requestedGeneration) {
          continue
        }

        apply(value)
        appliedGeneration = targetGeneration
        settleAppliedWaiters(value)
      }
    } catch (error) {
      // A failed read must not leave existing callers pending forever. A later
      // request can retry from a clean generation.
      appliedGeneration = requestedGeneration
      rejectWaiters(error)
    } finally {
      running = null
      if (appliedGeneration < requestedGeneration) {
        running = run()
      }
    }
  }

  return (): Promise<T> => {
    const generation = ++requestedGeneration
    const promise = new Promise<T>((resolve, reject) => {
      waiters.push({ generation, resolve, reject })
    })

    if (!running) {
      running = run()
    }

    return promise
  }
}
