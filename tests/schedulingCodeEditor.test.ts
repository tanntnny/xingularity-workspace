import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScheduleCodeEditor } from '../src/renderer/src/components/scheduling/ScheduleCodeEditor'
import { getScheduleCodeLanguage } from '../src/renderer/src/lib/schedulingCodeEditor'

describe('scheduling code editor', () => {
  it('maps Python and legacy JavaScript runtimes to their syntax languages', () => {
    expect(getScheduleCodeLanguage('python')).toBe('python')
    expect(getScheduleCodeLanguage('javascript')).toBe('javascript')
  })

  it('renders the focused code surface without a save action', () => {
    const markup = renderToStaticMarkup(
      createElement(ScheduleCodeEditor, {
        code: 'print("hello")',
        runtime: 'python',
        onChange: () => undefined
      })
    )

    expect(markup).not.toContain('data-testid="scheduling-save-changes"')
    expect(markup).toContain('aria-label="Automation code"')
    expect(markup).not.toContain('Python code')
    expect(markup).not.toContain('JavaScript code')
  })
})
