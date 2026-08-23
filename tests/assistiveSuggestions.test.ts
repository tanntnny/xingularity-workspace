import { describe, expect, it } from 'vitest'
import {
  buildCaptureSuggestion,
  buildSubscriptionReviewSuggestion,
  setSuggestionStatus
} from '../src/shared/assistiveSuggestions'

describe('assistive suggestions', () => {
  it('marks explicit action captures as task suggestions without changing data', () => {
    const suggestion = buildCaptureSuggestion({ id: 'capture-1', content: 'Buy milk' })
    expect(suggestion.kind).toBe('capture-task')
    expect(suggestion.status).toBe('pending')
  })

  it('suggests review for stale flagged subscriptions', () => {
    const suggestion = buildSubscriptionReviewSuggestion(
      {
        id: 'subscription-1',
        name: 'Example',
        reviewFlag: 'unused',
        lastUsedAt: '2025-01-01T00:00:00.000Z'
      },
      new Date('2025-05-01T00:00:00.000Z')
    )
    expect(suggestion?.kind).toBe('duplicate-subscription')
  })

  it('requires an explicit accept or reject status transition', () => {
    const suggestion = buildCaptureSuggestion({ id: 'capture-2', content: 'Idea' })
    expect(setSuggestionStatus(suggestion, 'accepted').status).toBe('accepted')
  })
})
