import { Clock, Container, Ctx } from '@milkdown/ctx'
import { editorViewCtx } from '@milkdown/kit/core'
import { describe, expect, it } from 'vitest'
import {
  ensureEditorViewContext,
  hasReadyEditorView
} from '../src/renderer/src/lib/milkdownEditorViewContext'

function createCtx(): Ctx {
  return new Ctx(new Container(), new Clock())
}

describe('ensureEditorViewContext', () => {
  it('injects a placeholder editor view when Milkdown has not provided one yet', () => {
    const ctx = createCtx()

    expect(() => ctx.get(editorViewCtx)).toThrowError(/editorView/)

    ensureEditorViewContext(ctx)

    const view = ctx.get(editorViewCtx)
    expect(view).toEqual({})
    expect(hasReadyEditorView(view)).toBe(false)
  })

  it('does not replace a live editor view', () => {
    const ctx = createCtx()
    const liveView = {
      dispatch: () => 0,
      focus: () => 0,
      state: {}
    }

    ctx.inject(editorViewCtx, liveView as never)
    ensureEditorViewContext(ctx)

    expect(ctx.get(editorViewCtx)).toBe(liveView)
    expect(hasReadyEditorView(ctx.get(editorViewCtx))).toBe(true)
  })
})
