import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Input } from '../src/renderer/src/components/ui/input'
import { Textarea } from '../src/renderer/src/components/ui/textarea'

describe('shared text controls', () => {
  it('uses the shared input border, focus ring, and invalid-state tokens', () => {
    const markup = renderToStaticMarkup(createElement(Input, { 'aria-label': 'Name' }))

    expect(markup).toContain('border border-input')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('focus-visible:border-ring')
    expect(markup).toContain('focus-visible:ring-[3px]')
    expect(markup).toContain('focus-visible:ring-ring/50')
    expect(markup).toContain('aria-invalid:border-destructive')
    expect(markup).toContain('aria-invalid:ring-destructive/20')
    expect(markup).not.toContain('focus-visible:border-foreground')
    expect(markup).not.toContain('focus-visible:ring-border')
    expect(markup).not.toContain('focus-visible:ring-offset-2')
  })

  it('uses the same border and focus ring treatment for textareas', () => {
    const markup = renderToStaticMarkup(createElement(Textarea, { 'aria-label': 'Description' }))

    expect(markup).toContain('border border-input')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('focus-visible:border-ring')
    expect(markup).toContain('focus-visible:ring-[3px]')
    expect(markup).toContain('focus-visible:ring-ring/50')
    expect(markup).toContain('aria-invalid:border-destructive')
    expect(markup).toContain('aria-invalid:ring-destructive/20')
    expect(markup).not.toContain('focus-visible:border-foreground')
    expect(markup).not.toContain('focus-visible:ring-border')
    expect(markup).not.toContain('focus-visible:ring-offset-2')
  })
})
