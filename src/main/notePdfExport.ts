import fs from 'node:fs/promises'
import path from 'node:path'
import { NOTE_PDF_IMAGE_URI_PREFIX, NotePdfExportImage } from '../shared/types'

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp'
}

export async function buildNotePdfHtml(
  title: string,
  contentHtml: string,
  images: NotePdfExportImage[],
  vaultRoot: string
): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = []
  let resolvedHtml = contentHtml

  for (const image of images) {
    const placeholder = `${NOTE_PDF_IMAGE_URI_PREFIX}${image.id}`
    const source = image.src.trim()

    if (source.startsWith('vault-file://')) {
      try {
        resolvedHtml = resolvedHtml.replaceAll(
          placeholder,
          await readVaultImageAsDataUrl(source, vaultRoot)
        )
      } catch (error) {
        resolvedHtml = resolvedHtml.replaceAll(placeholder, '')
        warnings.push(`Could not embed image ${image.id}: ${String(error)}`)
      }
      continue
    }

    if (/^(https?:|data:image\/)/i.test(source)) {
      resolvedHtml = resolvedHtml.replaceAll(placeholder, source)
      continue
    }

    resolvedHtml = resolvedHtml.replaceAll(placeholder, '')
    warnings.push(`Skipped unsupported image source for ${image.id}`)
  }

  return {
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        background: #fff !important;
        color: #000 !important;
      }
      article, article * {
        color: #000 !important;
        -webkit-text-fill-color: #000 !important;
        border-color: #000 !important;
        background: transparent !important;
        box-shadow: none !important;
      }
      article a {
        text-decoration-color: #000 !important;
      }
      article hr {
        border: 0;
        border-top: 1px solid #000 !important;
      }
      article { max-width: 100%; }
      img { max-width: 100%; page-break-inside: avoid; }
    </style>
  </head>
  <body><article>${resolvedHtml}</article></body>
</html>`,
    warnings
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }
    return entities[character] ?? character
  })
}

async function readVaultImageAsDataUrl(source: string, vaultRoot: string): Promise<string> {
  const sourceUrl = new URL(source)
  const rawPath = sourceUrl.host ? `/${sourceUrl.host}${sourceUrl.pathname}` : sourceUrl.pathname
  const absolutePath = path.resolve(decodeURIComponent(rawPath))
  const normalizedVaultRoot = path.resolve(vaultRoot)
  const relativePath = path.relative(normalizedVaultRoot, absolutePath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Image path is outside the current vault')
  }

  const mimeType = IMAGE_MIME_TYPES[path.extname(absolutePath).toLowerCase()]
  if (!mimeType) {
    throw new Error('Image type is not supported')
  }

  const contents = await fs.readFile(absolutePath)
  return `data:${mimeType};base64,${contents.toString('base64')}`
}
