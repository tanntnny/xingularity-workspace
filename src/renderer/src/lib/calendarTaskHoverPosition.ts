export function getCalendarTaskHoverPosition(
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const tooltipWidth = 288
  const tooltipHeight = 168
  const margin = 16
  const cursorOffset = 18

  const x = Math.max(
    margin,
    Math.min(clientX + cursorOffset, window.innerWidth - tooltipWidth - margin)
  )
  const y = Math.max(
    margin,
    Math.min(clientY + cursorOffset, window.innerHeight - tooltipHeight - margin)
  )

  return { x, y }
}
