import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { HistoryService } from '../src/main/historyService'
import { WeeklyPlanService } from '../src/main/planning/weeklyPlanService'

const tempDirs: string[] = []

async function makeService(): Promise<{
  rootDir: string
  history: HistoryService
  service: WeeklyPlanService
}> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-weekly-plan-'))
  tempDirs.push(rootDir)
  const history = new HistoryService()
  const service = new WeeklyPlanService(history)
  service.handleVaultChange(rootDir)
  return { rootDir, history, service }
}

describe('WeeklyPlanService history', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('undoes and redoes a deleted week with its priorities', async () => {
    const { history, service } = await makeService()
    const withWeek = await service.createWeek({ startDate: '2026-04-19', focus: 'Ship' })
    const week = withWeek.weeks[0]!
    await service.addPriority({ weekId: week.id, title: 'Finish undo' })

    const afterDelete = await service.deleteWeek({ id: week.id })
    expect(afterDelete.weeks).toHaveLength(0)
    expect(afterDelete.priorities).toHaveLength(0)
    expect(history.status().canUndo).toBe(true)

    await history.undo()
    const restored = await service.getState()
    expect(restored.weeks).toHaveLength(1)
    expect(restored.priorities).toHaveLength(1)

    await history.redo()
    const deletedAgain = await service.getState()
    expect(deletedAgain.weeks).toHaveLength(0)
    expect(deletedAgain.priorities).toHaveLength(0)
  })
})
