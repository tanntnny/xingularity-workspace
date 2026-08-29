const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

export interface ProjectUpdatedDateLabel {
  label: string
  exactLabel: string
}

export function formatProjectDate(value: string): string {
  const date = parseProjectDate(value)
  if (!date) return 'Unknown'

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatProjectUpdatedDate(
  value: string,
  now: Date = new Date()
): ProjectUpdatedDateLabel {
  const date = parseProjectDate(value)
  if (!date) {
    return { label: 'Unknown', exactLabel: 'Unknown' }
  }

  const exactLabel = date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
  const dayDifference = getLocalCalendarDay(now) - getLocalCalendarDay(date)

  let label = formatProjectDate(value)
  if (dayDifference === 0) {
    label = 'Today'
  } else if (dayDifference === 1) {
    label = 'Yesterday'
  } else if (dayDifference >= 2 && dayDifference <= 7) {
    label = `${dayDifference} days ago`
  }

  return { label, exactLabel }
}

function parseProjectDate(value: string): Date | null {
  const date = DATE_ONLY_PATTERN.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getLocalCalendarDay(date: Date): number {
  if (Number.isNaN(date.getTime())) return Number.NaN

  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MILLISECONDS_PER_DAY
}
