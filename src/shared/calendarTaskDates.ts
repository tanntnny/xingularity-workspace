export function normalizeCalendarEndDate(
  date: string | undefined,
  endDate: string | undefined
): string | undefined {
  if (!endDate) {
    return undefined
  }

  return !date || endDate >= date ? endDate : date
}
