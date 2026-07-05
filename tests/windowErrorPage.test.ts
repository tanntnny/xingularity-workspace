import { describe, expect, it } from 'vitest'
import { createWindowErrorPageHtml } from '../src/main/windowErrorPage'

describe('window error page', () => {
  it('renders fallback markup with reload wiring and escaped content', () => {
    const html = createWindowErrorPageHtml({
      source: 'main',
      channel: 'files:read-note',
      message: 'Danger </script><img src=x onerror=alert(1)>',
      stack: 'line 1\nline 2 & details'
    })

    expect(html).toContain('Reload app')
    expect(html).toContain('window.vaultApi?.ui?.reloadApp?.()')
    expect(html).toContain('files:read-note')
    expect(html).toContain('Danger &lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('line 2 &amp; details')
    expect(html).not.toContain('Danger </script><img src=x onerror=alert(1)>')
    expect(html).toContain('\\u003c/script\\u003e')
  })
})
