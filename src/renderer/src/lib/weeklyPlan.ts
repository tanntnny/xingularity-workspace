import type {
  WeeklyPlanPriority,
  WeeklyPlanReview,
  WeeklyPlanState,
  WeeklyPlanWeek
} from '../../../shared/types'

export function getSortedWeeks(state: WeeklyPlanState | null): WeeklyPlanWeek[] {
  if (!state) {
    return []
  }
  return [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export function getWeekPriorities(
  state: WeeklyPlanState | null,
  weekId: string | null
): WeeklyPlanPriority[] {
  if (!state || !weekId) {
    return []
  }
  return state.priorities
    .filter((priority) => priority.weekId === weekId)
    .sort((a, b) => a.order - b.order)
}

export function getWeekReview(
  state: WeeklyPlanState | null,
  weekId: string | null
): WeeklyPlanReview | null {
  if (!state || !weekId) {
    return null
  }
  return state.reviews.find((review) => review.weekId === weekId) ?? null
}

export function findWeekForDate(
  weeks: WeeklyPlanWeek[],
  isoDate: string
): WeeklyPlanWeek | undefined {
  return weeks.find((week) => week.startDate <= isoDate && week.endDate >= isoDate)
}

export function formatWeekRange(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  const sameMonth = startDate.getMonth() === endDate.getMonth()
  const sameYear = startDate.getFullYear() === endDate.getFullYear()

  const startLabel = startDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' })
  })
  const endLabel = endDate.toLocaleDateString(undefined, {
    month: sameMonth && sameYear ? undefined : 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric'
  })

  return `${startLabel} – ${endLabel}`
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
