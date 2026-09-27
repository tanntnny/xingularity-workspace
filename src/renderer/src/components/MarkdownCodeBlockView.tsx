import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { getCodeHighlightRanges, type CodeHighlightRange } from '../lib/codeSyntaxHighlighting'
import type { MarkdownCodeBlock } from '../lib/noteMarkdownCodeBlock'
import { cn } from '../lib/utils'

export interface MarkdownCodeBlockViewProps {
  block: MarkdownCodeBlock
  onActivate: () => void
  onLayoutChange: () => void
}

function renderHighlightedCode(code: string, ranges: readonly CodeHighlightRange[]): ReactNode {
  if (ranges.length === 0) return code

  const children: ReactNode[] = []
  let cursor = 0

  ranges.forEach((range, index) => {
    const from = Math.max(cursor, Math.min(code.length, range.from))
    const to = Math.max(from, Math.min(code.length, range.to))

    if (from > cursor) children.push(code.slice(cursor, from))
    if (to > from) {
      children.push(
        <span key={`${range.from}-${range.to}-${index}`} className={range.className}>
          {code.slice(from, to)}
        </span>
      )
    }
    cursor = to
  })

  if (cursor < code.length) children.push(code.slice(cursor))
  return children
}

function renderHighlightedCodeLines(code: string, language: string): ReactNode {
  const lines = code.split('\n')
  const ranges = getCodeHighlightRanges(code, language)
  let lineFrom = 0

  return lines.map((line, index) => {
    const lineTo = lineFrom + line.length
    const lineRanges = ranges.flatMap((range) => {
      const from = Math.max(lineFrom, range.from)
      const to = Math.min(lineTo, range.to)
      if (from >= to) return []

      return [
        {
          from: from - lineFrom,
          to: to - lineFrom,
          className: range.className
        }
      ]
    })
    const renderedLine = renderHighlightedCode(line, lineRanges)
    lineFrom = lineTo + 1

    return (
      <span
        key={`line-${index}`}
        className="note-live-code-preview-line"
        data-empty={line.length === 0 ? 'true' : undefined}
        data-testid="note-live-code-line"
      >
        {renderedLine}
      </span>
    )
  })
}

export interface MarkdownCodeBlockCopyButtonProps {
  code: string
  className?: string
}

export function MarkdownCodeBlockCopyButton({
  code,
  className
}: MarkdownCodeBlockCopyButtonProps): ReactElement {
  const codeRef = useRef(code)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    codeRef.current = code
  }, [code])

  useEffect(() => {
    if (copyState === 'idle') return
    const timeout = window.setTimeout(() => setCopyState('idle'), 2000)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  const copyCode = (): void => {
    const writeText = navigator.clipboard?.writeText
    if (!writeText) {
      setCopyState('error')
      return
    }

    void writeText.call(navigator.clipboard, codeRef.current).then(
      () => setCopyState('copied'),
      () => setCopyState('error')
    )
  }

  const copyLabel =
    copyState === 'copied'
      ? 'Code block copied'
      : copyState === 'error'
        ? 'Copy code block failed'
        : 'Copy code block'

  return (
    <button
      type="button"
      className={cn('note-live-code-copy-button', className)}
      data-testid="note-live-code-copy-button"
      data-state={copyState}
      aria-label={copyLabel}
      title={copyLabel}
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        copyCode()
      }}
    >
      <svg
        className="note-live-code-copy-icon"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        data-icon={copyState === 'copied' ? 'check' : 'copy'}
      >
        {copyState === 'copied' ? (
          <path d="M20.707 6.293a1 1 0 0 1 0 1.414l-10 10a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414l4.293 4.293l9.293-9.293a1 1 0 0 1 1.414 1.414" />
        ) : (
          <>
            <path d="M20.926 7.074a3.67 3.67 0 0 1 1.074 2.593v8.666a3.667 3.667 0 0 1-3.667 3.667h-8.666A3.667 3.667 0 0 1 6 18.333V9.667A3.66 3.66 0 0 1 9.667 6h8.666a3.67 3.67 0 0 1 2.593 1.074" />
            <path d="M17.374 3.514a1 1 0 1 1-1.748.972c-.221-.398-.342-.486-.626-.486H5c-.548 0-1 .452-1 1v9.998c0 .36.194.692.507.87a1 1 0 1 1-.99 1.738A3 3 0 0 1 2 15V5c0-1.652 1.348-3 3-3h10c1.094 0 1.828.533 2.374 1.514" />
          </>
        )}
      </svg>
    </button>
  )
}

export function MarkdownCodeBlockView({
  block,
  onActivate,
  onLayoutChange
}: MarkdownCodeBlockViewProps): ReactElement {
  const onActivateRef = useRef(onActivate)
  const onLayoutChangeRef = useRef(onLayoutChange)

  useEffect(() => {
    onActivateRef.current = onActivate
    onLayoutChangeRef.current = onLayoutChange
  }, [onActivate, onLayoutChange])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => onLayoutChangeRef.current())
    return () => window.cancelAnimationFrame(frame)
  }, [block.body])

  return (
    <section
      className="note-live-code-block"
      data-testid="note-live-code-block"
      data-language={block.language || undefined}
      onPointerDown={(event) => {
        if (event.target instanceof Element && event.target.closest('button')) return
        event.preventDefault()
        event.stopPropagation()
        onActivateRef.current()
      }}
    >
      <div className="note-live-code-block-scroll">
        <pre
          className="note-live-code-block-preview"
          data-testid="note-live-code-preview"
          aria-label={block.language ? `${block.language} code block` : 'Code block'}
        >
          {renderHighlightedCodeLines(block.body, block.language)}
        </pre>
      </div>
      <MarkdownCodeBlockCopyButton code={block.body} />
    </section>
  )
}
