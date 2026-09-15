import {
  getWorkspaceOpenOptions,
  isMiddleWorkspaceOpen,
  isModifiedWorkspaceOpen,
  type WorkspaceOpenOptions
} from './workspaceOpen'

export type NotebookOpenOptions = WorkspaceOpenOptions

export const isModifiedNotebookOpen = isModifiedWorkspaceOpen
export const isMiddleMouseButton = isMiddleWorkspaceOpen
export { getWorkspaceOpenOptions }
