import { DragEvent as ReactDragEvent } from 'react'

type DragPreviewEvent = ReactDragEvent<HTMLElement>

export function setCalendarTaskDragPreview(event: DragPreviewEvent): void {
  const dragPreview = event.currentTarget.cloneNode(true)
  if (!(dragPreview instanceof HTMLElement)) {
    return
  }

  const rect = event.currentTarget.getBoundingClientRect()
  dragPreview.style.position = 'fixed'
  dragPreview.style.top = '-9999px'
  dragPreview.style.left = '-9999px'
  dragPreview.style.width = `${rect.width}px`
  dragPreview.style.pointerEvents = 'none'
  dragPreview.style.transform = 'none'
  dragPreview.style.opacity = '1'
  dragPreview.classList.add('calendar-task-drag-preview')
  document.body.appendChild(dragPreview)

  event.dataTransfer.setDragImage(dragPreview, event.clientX - rect.left, event.clientY - rect.top)
  window.setTimeout(() => dragPreview.remove(), 0)
}
