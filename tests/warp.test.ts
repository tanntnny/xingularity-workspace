import { describe, expect, it } from 'vitest'
import { createWarpNewTabUri } from '../src/main/warp'

describe('createWarpNewTabUri', () => {
  it('creates a new-tab URI for the supplied folder path', () => {
    const folderPath = '/Users/example/Notes/Project One/สวัสดี'
    const uri = new URL(createWarpNewTabUri(folderPath))

    expect(uri.protocol).toBe('warp:')
    expect(uri.hostname).toBe('action')
    expect(uri.pathname).toBe('/new_tab')
    expect(uri.searchParams.get('path')).toBe(folderPath)
  })
})
