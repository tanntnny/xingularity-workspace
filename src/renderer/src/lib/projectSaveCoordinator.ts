import type { Project, UpdateProjectInput } from '../../../shared/types'

interface CreateProjectSaveCoordinatorOptions {
  updateProject: (request: UpdateProjectInput) => Promise<Project>
}

export interface ProjectSaveCoordinator {
  enqueue: (request: UpdateProjectInput) => Promise<Project>
}

/**
 * Serialize updates for the same project so renderer mutations cannot finish
 * out of order. Different projects can still save independently.
 */
export function createProjectSaveCoordinator(
  options: CreateProjectSaveCoordinatorOptions
): ProjectSaveCoordinator {
  const queues = new Map<string, Promise<Project>>()

  return {
    enqueue(request) {
      const previous = queues.get(request.projectId)
      const next = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() =>
        options.updateProject(request)
      )
      queues.set(request.projectId, next)

      const clearQueue = (): void => {
        if (queues.get(request.projectId) === next) {
          queues.delete(request.projectId)
        }
      }
      void next.then(clearQueue, clearQueue)

      return next
    }
  }
}
