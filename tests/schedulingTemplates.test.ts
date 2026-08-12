import { describe, expect, it } from 'vitest'
import {
  createPythonTemplate,
  getAutomationSource,
  getTemplatePermission,
  insertPythonTemplate,
  PYTHON_ACTION_MARKER
} from '../src/renderer/src/lib/schedulingTemplates'

describe('scheduling Python templates', () => {
  it('creates task and note snippets using the stdout action protocol', () => {
    const taskTemplate = createPythonTemplate('task', 'Morning Planning')
    const noteTemplate = createPythonTemplate('note', 'Morning Planning')

    expect(taskTemplate).toContain('"type": "task.create"')
    expect(taskTemplate).toContain('"automationSource": "morning-planning"')
    expect(taskTemplate).toContain(PYTHON_ACTION_MARKER)
    expect(noteTemplate).toContain('"type": "note.create"')
    expect(noteTemplate).toContain('"name": "Daily note"')
    expect(getTemplatePermission('task')).toBe('createTasks')
    expect(getTemplatePermission('note')).toBe('createNotes')
  })

  it('inserts an action into an existing starter and reports when code needs a starter', () => {
    const starter = createPythonTemplate('task')
    const insertion = insertPythonTemplate(starter, 'note', 'Daily Notes')
    const custom = insertPythonTemplate('print("hello")', 'task')

    expect(insertion.inserted).toBe(true)
    expect(insertion.requiresStarter).toBe(false)
    expect(insertion.code).toContain('"type": "note.create"')
    expect(custom.inserted).toBe(false)
    expect(custom.requiresStarter).toBe(true)
    expect(getAutomationSource('  -- Daily / Notes -- ')).toBe('daily-notes')
  })
})
