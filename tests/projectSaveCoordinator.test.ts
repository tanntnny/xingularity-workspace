import { describe, expect, it, vi } from 'vitest'
import type { Project, UpdateProjectInput } from '../src/shared/types'
import { createProjectSaveCoordinator } from '../src/renderer/src/lib/projectSaveCoordinator'

function makeProject(description: string): Project {
  return {
    id: 'project-1',
    name: 'Alpha Project',
    description,
    summary: description,
    state: 'active',
    updatedAt: '2026-08-20T00:00:00.000Z',
    icon: { variant: 'filled', color: '#2563eb' },
    milestones: []
  }
}

function request(description: string): UpdateProjectInput {
  return {
    projectId: 'project-1',
    description
  }
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

describe('project save coordinator', () => {
  it('serializes updates for the same project', async () => {
    let releaseFirst!: (project: Project) => void
    let releaseSecond!: (project: Project) => void
    const firstWrite = new Promise<Project>((resolve) => {
      releaseFirst = resolve
    })
    const secondWrite = new Promise<Project>((resolve) => {
      releaseSecond = resolve
    })
    const updateProject = vi.fn((input: UpdateProjectInput) =>
      input.description === 'first' ? firstWrite : secondWrite
    )
    const coordinator = createProjectSaveCoordinator({ updateProject })

    const firstSave = coordinator.enqueue(request('first'))
    const secondSave = coordinator.enqueue(request('second'))

    await nextTick()
    expect(updateProject).toHaveBeenCalledTimes(1)
    expect(updateProject).toHaveBeenLastCalledWith(request('first'))

    releaseFirst(makeProject('first'))
    await firstSave
    await nextTick()
    expect(updateProject).toHaveBeenCalledTimes(2)
    expect(updateProject).toHaveBeenLastCalledWith(request('second'))

    releaseSecond(makeProject('second'))
    await secondSave
  })

  it('continues processing queued updates after a failed write', async () => {
    let rejectFirst!: (error: Error) => void
    let releaseSecond!: (project: Project) => void
    const firstWrite = new Promise<Project>((_resolve, reject) => {
      rejectFirst = reject
    })
    const secondWrite = new Promise<Project>((resolve) => {
      releaseSecond = resolve
    })
    const updateProject = vi.fn((input: UpdateProjectInput) =>
      input.description === 'first' ? firstWrite : secondWrite
    )
    const coordinator = createProjectSaveCoordinator({ updateProject })

    const firstSave = coordinator.enqueue(request('first'))
    const secondSave = coordinator.enqueue(request('second'))
    rejectFirst(new Error('first write failed'))

    await expect(firstSave).rejects.toThrow('first write failed')
    await nextTick()
    expect(updateProject).toHaveBeenCalledTimes(2)

    releaseSecond(makeProject('second'))
    await expect(secondSave).resolves.toMatchObject({ description: 'second' })
  })
})
