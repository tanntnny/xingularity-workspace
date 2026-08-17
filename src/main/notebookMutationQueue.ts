export class NotebookMutationQueue {
  private queue: Promise<void> = Promise.resolve()

  async drain(): Promise<void> {
    await this.queue
  }

  enqueue<T>(action: () => Promise<T>): Promise<T> {
    const run = this.queue.then(action, action)
    this.queue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}
