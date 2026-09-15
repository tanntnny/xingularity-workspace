export type XWorkspaceErrorCode =
  | 'vault-unbound'
  | 'vault-already-bound'
  | 'vault-binding-invalid'
  | 'vault-not-found'
  | 'vault-manifest-invalid'
  | 'vault-exists'
  | 'vault-busy'
  | 'lock-not-stale'
  | 'invalid-command'
  | 'invalid-input'
  | 'not-found'
  | 'ambiguous'
  | 'plan-expired'
  | 'plan-stale'
  | 'plan-invalid'
  | 'conflict'
  | 'operational-error'

export class XWorkspaceError extends Error {
  constructor(
    readonly code: XWorkspaceErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'XWorkspaceError'
  }
}

export function isXWorkspaceError(error: unknown): error is XWorkspaceError {
  return error instanceof XWorkspaceError
}
