import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ExcalidrawFileIcon } from '../src/renderer/src/components/ui/icons'

describe('ExcalidrawFileIcon', () => {
  it('renders the supplied artwork with the note-style grey palette', () => {
    const markup = renderToStaticMarkup(createElement(ExcalidrawFileIcon, { size: 36 }))

    expect(markup).toContain('class="tabler-icon icon-tabler-excalidraw-file"')
    expect(markup).toContain('viewBox="0 0 36 36"')
    expect(markup).toContain('stop-color="#f8f8f8"')
    expect(markup).toContain('stop-color="#ababab"')
    expect(markup).toContain('stop-color="#eeeeee"')
    expect(markup).toContain('stop-color="#999999"')
    expect(markup).toContain('fill="#292929"')
    expect(markup).not.toContain('#D99E82')
    expect(markup).not.toContain('#EA596E')
    expect(markup).not.toContain('#FFCC4D')
  })

  it('uses unique gradient ids for multiple instances', () => {
    const markup = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(ExcalidrawFileIcon),
        createElement(ExcalidrawFileIcon)
      )
    )

    const ids = [...markup.matchAll(/id="([^"]+)"/g)].map((match) => match[1])
    expect(ids).toHaveLength(6)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
