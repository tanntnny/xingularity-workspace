import { ReactElement, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { mentionsToMarkdownLinks, noteMentionPrefix } from '../../../shared/noteMentions'

interface PreviewProps {
  markdown: string
  onOpenMention?: (target: string) => void
}

export function Preview({ markdown, onOpenMention }: PreviewProps): ReactElement {
  const markdownWithMentionLinks = useMemo(() => mentionsToMarkdownLinks(markdown), [markdown])
  const mentionPrefix = noteMentionPrefix()

  return (
    <div className="min-h-[60vh] border border-[var(--line)] bg-[var(--panel)] p-4 [&_code]:rounded [&_code]:bg-[var(--panel-3)] [&_code]:px-1 [&_code]:py-0.5 [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--line-strong)] [&_td]:p-1.5 [&_th]:border [&_th]:border-[var(--line-strong)] [&_th]:p-1.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith(mentionPrefix)) {
              const rawTarget = href.slice(mentionPrefix.length)
              const target = decodeURIComponent(rawTarget)
              return (
                <button
                  type="button"
                  className="rounded px-1 text-[var(--accent)] underline underline-offset-2"
                  onClick={() => onOpenMention?.(target)}
                >
                  [[{target}]]
                </button>
              )
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                {children}
              </a>
            )
          }
        }}
      >
        {markdownWithMentionLinks}
      </ReactMarkdown>
    </div>
  )
}
