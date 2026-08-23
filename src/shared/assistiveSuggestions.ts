import type { AssistiveSuggestion, FleetingNote, SubscriptionRecord } from './types'

export function buildCaptureSuggestion(
  note: Pick<FleetingNote, 'id' | 'content'>,
  now = new Date()
): AssistiveSuggestion {
  const content = note.content.trim()
  const looksActionable = /^(todo|task|action|remember|buy|call|email|follow up)\b/i.test(content)
  return {
    id: `suggestion:capture:${note.id}`,
    kind: looksActionable ? 'capture-task' : 'capture-note',
    title: looksActionable ? 'Convert this capture into a task?' : 'Keep this capture as a note?',
    explanation: looksActionable
      ? 'The opening phrase looks like an actionable request. Review it before converting.'
      : 'This capture does not look like an explicit task. Review before filing it as a note.',
    sourceIds: [note.id],
    confidence: looksActionable ? 0.82 : 0.68,
    status: 'pending',
    createdAt: now.toISOString()
  }
}

export function buildSubscriptionReviewSuggestion(
  record: Pick<SubscriptionRecord, 'id' | 'name' | 'lastUsedAt' | 'reviewFlag'>,
  now = new Date()
): AssistiveSuggestion | null {
  if (record.reviewFlag === 'none' || !record.reviewFlag) {
    return null
  }
  const lastUsed = record.lastUsedAt ? new Date(record.lastUsedAt).getTime() : Number.NaN
  const stale = Number.isNaN(lastUsed) || now.getTime() - lastUsed > 90 * 86_400_000
  if (!stale) return null
  return {
    id: `suggestion:subscription:${record.id}`,
    kind: 'duplicate-subscription',
    title: `Review ${record.name}`,
    explanation:
      'This subscription is flagged and has not been used recently. Decide whether to keep, snooze, or cancel it.',
    sourceIds: [record.id],
    confidence: 0.76,
    status: 'pending',
    createdAt: now.toISOString()
  }
}

export function setSuggestionStatus(
  suggestion: AssistiveSuggestion,
  status: AssistiveSuggestion['status']
): AssistiveSuggestion {
  return { ...suggestion, status }
}
