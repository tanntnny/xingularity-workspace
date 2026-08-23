import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const palleteSource = readFileSync(
  new URL('../src/renderer/src/components/ui/pallete.tsx', import.meta.url),
  'utf8'
)

describe('dialog overlay styling', () => {
  it('uses the shared dark backdrop for palette-based dialogs', () => {
    expect(palleteSource).toContain(
      '<DialogPrimitive.Overlay className="motion-overlay fixed inset-0 z-50 bg-overlay" />'
    )
    expect(palleteSource).not.toContain('fixed inset-0 z-50 bg-transparent')
  })
})
