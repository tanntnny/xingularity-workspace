import {
  javascriptLanguage,
  jsxLanguage,
  tsxLanguage,
  typescriptLanguage
} from '@codemirror/lang-javascript'
import { pythonLanguage } from '@codemirror/lang-python'
import { HighlightStyle, type LRLanguage } from '@codemirror/language'
import { highlightTree, tags } from '@lezer/highlight'

export interface CodeHighlightRange {
  from: number
  to: number
  className: string
}

export const githubCopilotHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, class: 'code-token-comment' },
  {
    tag: [tags.string, tags.docString, tags.character, tags.attributeValue, tags.regexp],
    class: 'code-token-string'
  },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], class: 'code-token-number' },
  {
    tag: [
      tags.keyword,
      tags.operatorKeyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword
    ],
    class: 'code-token-keyword'
  },
  {
    tag: [
      tags.operator,
      tags.arithmeticOperator,
      tags.logicOperator,
      tags.bitwiseOperator,
      tags.compareOperator,
      tags.updateOperator,
      tags.definitionOperator,
      tags.typeOperator,
      tags.controlOperator
    ],
    class: 'code-token-operator'
  },
  { tag: tags.function(tags.variableName), class: 'code-token-function' },
  { tag: tags.function(tags.propertyName), class: 'code-token-function' },
  { tag: [tags.typeName, tags.className], class: 'code-token-type' },
  { tag: [tags.propertyName, tags.attributeName], class: 'code-token-property' },
  { tag: tags.definition(tags.variableName), class: 'code-token-definition' },
  { tag: [tags.variableName, tags.name], class: 'code-token-variable' },
  { tag: tags.punctuation, class: 'code-token-punctuation' },
  { tag: tags.meta, class: 'code-token-meta' },
  { tag: tags.escape, class: 'code-token-escape' },
  { tag: tags.invalid, class: 'code-token-invalid' },
  { tag: tags.link, class: 'code-token-link' }
])

const languageParsers: Record<string, LRLanguage> = {
  py: pythonLanguage,
  python: pythonLanguage,
  js: javascriptLanguage,
  javascript: javascriptLanguage,
  ts: typescriptLanguage,
  typescript: typescriptLanguage,
  jsx: jsxLanguage,
  tsx: tsxLanguage
}

function normalizeLanguage(language: unknown): string {
  return typeof language === 'string'
    ? language
        .trim()
        .toLowerCase()
        .replace(/^language-/, '')
    : ''
}

export function resolveCodeLanguage(language: unknown): LRLanguage | null {
  return languageParsers[normalizeLanguage(language)] ?? null
}

export function getCodeHighlightRanges(
  code: string,
  language: unknown
): readonly CodeHighlightRange[] {
  const parser = resolveCodeLanguage(language)
  if (!parser || code.length === 0) {
    return []
  }

  try {
    const ranges: CodeHighlightRange[] = []
    const tree = parser.parser.parse(code)

    highlightTree(tree, githubCopilotHighlightStyle, (from, to, className) => {
      if (from < to && className) {
        ranges.push({ from, to, className })
      }
    })

    return ranges
  } catch {
    return []
  }
}
