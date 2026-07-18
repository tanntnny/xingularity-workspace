import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { NOTE_PDF_IMAGE_URI_PREFIX } from '../src/shared/types'
import { buildNotePdfHtml } from '../src/main/notePdfExport'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true }))
  )
})

describe('buildNotePdfHtml', () => {
  it('uses black text and borders on a white printable page', async () => {
    const result = await buildNotePdfHtml(
      'Styled note',
      '<p style="color: #0ea5e9; border-bottom: 1px solid #0ea5e9; background: #e0f2fe">Styled text</p>',
      [],
      '/tmp/vault'
    )

    expect(result.html).toContain('background: #fff !important')
    expect(result.html).toContain('color: #000 !important')
    expect(result.html).toContain('border-color: #000 !important')
    expect(result.html).toContain('background: transparent !important')
  })

  it('embeds a vault image as a data URL in the printable document', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-note-pdf-vault-'))
    temporaryDirectories.push(vaultRoot)
    const imagePath = path.join(vaultRoot, 'attachments', 'example.png')
    await fs.mkdir(path.dirname(imagePath), { recursive: true })
    await fs.writeFile(imagePath, Buffer.from([137, 80, 78, 71]))

    const result = await buildNotePdfHtml(
      'Image note',
      `<img src="${NOTE_PDF_IMAGE_URI_PREFIX}image-1" data-export-image-id="image-1" />`,
      [{ id: 'image-1', src: `vault-file://${encodeURI(imagePath)}` }],
      vaultRoot
    )

    expect(result.warnings).toEqual([])
    expect(result.html).toContain('data:image/png;base64,iVBORw==')
    expect(result.html).not.toContain(NOTE_PDF_IMAGE_URI_PREFIX)
  })

  it('omits an out-of-vault image and reports a warning', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-note-pdf-vault-'))
    const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-note-pdf-outside-'))
    temporaryDirectories.push(vaultRoot, outsideRoot)
    const imagePath = path.join(outsideRoot, 'outside.png')
    await fs.writeFile(imagePath, Buffer.from([137, 80, 78, 71]))

    const result = await buildNotePdfHtml(
      'Unsafe image note',
      `<img src="${NOTE_PDF_IMAGE_URI_PREFIX}image-1" data-export-image-id="image-1" />`,
      [{ id: 'image-1', src: `vault-file://${encodeURI(imagePath)}` }],
      vaultRoot
    )

    expect(result.warnings).toHaveLength(1)
    expect(result.html).toContain('src="" data-export-image-id="image-1"')
  })
})
