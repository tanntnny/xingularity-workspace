import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const selectSource = readFileSync(
  new URL('../src/renderer/src/components/ui/select.tsx', import.meta.url),
  'utf8'
)

describe('Select', () => {
  it('uses a visible hover surface for every option', () => {
    expect(selectSource).toContain('hover:!bg-surface-subtle-hover')
    expect(selectSource).toContain('data-[highlighted]:!bg-surface-subtle-hover')
  })

  it('uses rectangular option corners instead of the pill control radius', () => {
    expect(selectSource).toContain('overflow-hidden rounded-sm pl-1.5 pr-7')
    expect(selectSource).not.toContain(
      'overflow-hidden rounded-[var(--radius-control)] pl-1.5 pr-7'
    )
  })
})
