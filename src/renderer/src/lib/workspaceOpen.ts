export interface WorkspaceOpenOptions {
  openInNewTab?: boolean
}

export interface ModifiedWorkspaceOpenEvent {
  metaKey: boolean
  ctrlKey: boolean
}

export interface MiddleWorkspaceOpenEvent {
  button: number
}

export function isModifiedWorkspaceOpen(event: ModifiedWorkspaceOpenEvent): boolean {
  return event.metaKey || event.ctrlKey
}

export function isMiddleWorkspaceOpen(event: MiddleWorkspaceOpenEvent): boolean {
  return event.button === 1
}

export function getWorkspaceOpenOptions(
  event: ModifiedWorkspaceOpenEvent | MiddleWorkspaceOpenEvent
): WorkspaceOpenOptions {
  return {
    openInNewTab:
      ('button' in event && isMiddleWorkspaceOpen(event)) ||
      ('metaKey' in event && isModifiedWorkspaceOpen(event))
  }
}
