import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rendererStylesheet = readFileSync(
  new URL('../src/renderer/src/assets/main.css', import.meta.url),
  'utf8'
)

const workspaceTemplateStylesheet = readFileSync(
  new URL('../packages/workspace-template/styles/workspace.css', import.meta.url),
  'utf8'
)

describe('resize affordance styling', () => {
  it('fades the vertical resize rod at both ends', () => {
    for (const stylesheet of [rendererStylesheet, workspaceTemplateStylesheet]) {
      expect(stylesheet).toContain(
        'background: linear-gradient(\n      to bottom,\n      transparent 0%,\n      var(--resize-handle-center) 50%,\n      transparent 100%\n    );'
      )
    }
  })
})
