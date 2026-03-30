import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertSafeRelativePath, ensureWithinBase, joinSafe } from '../src/shared/pathSafety'

describe('path safety', () => {
  it('accepts note document path in vault', () => {
    expect(assertSafeRelativePath('folder/my-note.xnote')).toBe('folder/my-note.xnote')
  })

  it('rejects traversal paths', () => {
    expect(() => assertSafeRelativePath('../secret.txt')).toThrowError()
    expect(() => assertSafeRelativePath('/etc/passwd')).toThrowError()
  })

  it('joins safe path inside base', () => {
    const base = path.resolve('/tmp/vault/notes')
    const target = joinSafe(base, 'hello.xnote')
    expect(target.startsWith(base)).toBe(true)
  })

  it('denies absolute target outside base', () => {
    const base = path.resolve('/tmp/vault/notes')
    expect(() => ensureWithinBase(base, '/tmp/other/place.xnote')).toThrowError()
  })
})
