export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseIsoDate(iso: string): Date {
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date()
  }
  return parsed
}

export function shiftIsoMonthClamped(isoDate: string, offset: number): string {
  const current = parseIsoDate(isoDate)
  const year = current.getFullYear()
  const month = current.getMonth()
  const day = current.getDate()

  const targetMonth = month + offset
  const lastDayOfTargetMonth = new Date(year, targetMonth + 1, 0).getDate()
  const clampedDay = Math.min(day, lastDayOfTargetMonth)

  return toIsoDate(new Date(year, targetMonth, clampedDay))
}
