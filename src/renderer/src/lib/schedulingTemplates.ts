import type { SchedulePermission } from '../../../shared/scheduleTypes'

export type SchedulingTemplateKind = 'task' | 'note'

export type PythonTemplateInsertion = {
  code: string
  inserted: boolean
  requiresStarter: boolean
}

export const PYTHON_ACTION_MARKER = '    # XINGULARITY_ACTIONS'

export const PYTHON_STARTER_TEMPLATE = `import json
from datetime import date

today = date.today().isoformat()
actions = [
${PYTHON_ACTION_MARKER}
]
print(json.dumps({"actions": actions}))
`

export function getAutomationSource(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'scheduling-job'
}

function quotePythonString(value: string): string {
  return JSON.stringify(value)
}

function getActionSnippet(kind: SchedulingTemplateKind, source: string): string {
  if (kind === 'task') {
    return `    {
        "type": "task.create",
        "title": "New task",
        "date": today,
        "priority": "medium",
        "automationSource": ${quotePythonString(source)},
        "automationSourceKey": f"{today}:task"
    }`
  }

  return `    {
        "type": "note.create",
        "name": "Daily note",
        "body": "Write an automation note here.",
        "tags": ["automation"],
        "automationSource": ${quotePythonString(source)},
        "automationSourceKey": f"{today}:note"
    }`
}

export function createPythonTemplate(
  kind: SchedulingTemplateKind,
  source = 'scheduling-job'
): string {
  const snippet = getActionSnippet(kind, getAutomationSource(source))
  return PYTHON_STARTER_TEMPLATE.replace(
    PYTHON_ACTION_MARKER,
    `${snippet},\n${PYTHON_ACTION_MARKER}`
  )
}

export function insertPythonTemplate(
  code: string,
  kind: SchedulingTemplateKind,
  source = 'scheduling-job'
): PythonTemplateInsertion {
  const normalized = code.trim()
  if (!normalized) {
    return {
      code: createPythonTemplate(kind, source),
      inserted: true,
      requiresStarter: false
    }
  }

  if (!code.includes(PYTHON_ACTION_MARKER)) {
    return {
      code,
      inserted: false,
      requiresStarter: true
    }
  }

  const snippet = getActionSnippet(kind, getAutomationSource(source))
  return {
    code: code.replace(PYTHON_ACTION_MARKER, `${snippet},\n${PYTHON_ACTION_MARKER}`),
    inserted: true,
    requiresStarter: false
  }
}

export function getTemplatePermission(kind: SchedulingTemplateKind): SchedulePermission {
  return kind === 'task' ? 'createTasks' : 'createNotes'
}
