/* eslint-disable @typescript-eslint/no-require-imports */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { extractNoteTitleFromMarkdown } from '../shared/noteDocument'
import { splitNoteContent } from '../shared/noteContent'
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

// Electron's production main bundle loads these ESM packages through CommonJS require.
const { default: ReactMarkdown } = require('react-markdown') as typeof import('react-markdown')
const { default: remarkGfm } = require('remark-gfm') as typeof import('remark-gfm')

const FOLDER_PDF_STYLES = `
      .folder-pdf-document-title { margin: 0 0 8px; font-size: 28px; }
      .folder-pdf-note { break-inside: avoid; }
      .folder-pdf-note + .folder-pdf-note { break-before: page; page-break-before: always; }
      .folder-pdf-note-header { margin-bottom: 24px; border-bottom: 1px solid #000; }
      .folder-pdf-note-title { margin: 0; font-size: 22px; }
      .folder-pdf-note-path { margin: 6px 0 12px; color: #444 !important; font-size: 12px; }
      pre { overflow-wrap: anywhere; white-space: pre-wrap; }
      table { border-collapse: collapse; max-width: 100%; }
      th, td { border: 1px solid #000; padding: 6px; vertical-align: top; }
      blockquote { margin-left: 0; padding-left: 12px; border-left: 3px solid #000; }
`

export interface FolderPdfNote {
  relPath: string
  markdown: string
}

export async function buildNotePdfHtml(
  title: string,
  contentHtml: string,
  images: NotePdfExportImage[],
  vaultRoot: string,
  additionalStyles = ''
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
      ${additionalStyles}
    </style>
  </head>
  <body><article>${resolvedHtml}</article></body>
</html>`,
    warnings
  }
}

export async function buildFolderPdfHtml(
  folderName: string,
  notes: FolderPdfNote[],
  vaultRoot: string
): Promise<{ html: string; warnings: string[] }> {
  const images: NotePdfExportImage[] = []
  const sections = notes
    .map((note) => {
      const title = extractNoteTitleFromMarkdown(note.markdown, note.relPath)
      const body = splitNoteContent(note.markdown).body
      const contentHtml = renderFolderMarkdown(body, images)

      return `<section class="folder-pdf-note">
        <header class="folder-pdf-note-header">
          <h1 class="folder-pdf-note-title">${escapeHtml(title)}</h1>
          <p class="folder-pdf-note-path">${escapeHtml(note.relPath)}</p>
        </header>
        ${contentHtml}
      </section>`
    })
    .join('\n')

  return buildNotePdfHtml(
    folderName,
    `<header><h1 class="folder-pdf-document-title">${escapeHtml(folderName)}</h1></header>${sections}`,
    images,
    vaultRoot,
    FOLDER_PDF_STYLES
  )
}

function renderFolderMarkdown(markdown: string, images: NotePdfExportImage[]): string {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        urlTransform: transformFolderPdfUrl,
        components: {
          img: ({ alt, src }) => {
            if (!src) {
              return null
            }

            const id = `folder-image-${images.length + 1}`
            images.push({ id, src })
            return createElement('img', {
              alt: alt ?? '',
              src: `${NOTE_PDF_IMAGE_URI_PREFIX}${id}`,
              'data-export-image-id': id
            })
          }
        }
      },
      markdown
    )
  )
}

function transformFolderPdfUrl(url: string): string {
  return /^(https?:|data:image\/|vault-file:)/i.test(url) ? url : ''
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
