import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  type LanguageSupport,
  syntaxHighlighting
} from '@codemirror/language'
import { Annotation, Compartment, EditorState } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useRef, type ReactElement } from 'react'
import type { RuntimeType } from '../../../../shared/scheduleTypes'
import { getScheduleCodeLanguage } from '../../lib/schedulingCodeEditor'

export interface ScheduleCodeEditorProps {
  code: string
  runtime: RuntimeType
  onChange: (code: string) => void
}

const externalCodeChange = Annotation.define<boolean>()

const githubCopilotHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#8b949e', fontStyle: 'italic' },
  {
    tag: [tags.string, tags.docString, tags.character, tags.attributeValue, tags.regexp],
    color: '#a5d6ff'
  },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: '#79c0ff' },
  {
    tag: [
      tags.keyword,
      tags.operatorKeyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword
    ],
    color: '#ff7b72'
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
    color: '#ff7b72'
  },
  { tag: tags.function(tags.variableName), color: '#d2a8ff' },
  { tag: tags.function(tags.propertyName), color: '#d2a8ff' },
  { tag: [tags.typeName, tags.className], color: '#ffa657' },
  { tag: [tags.propertyName, tags.attributeName], color: '#79c0ff' },
  { tag: tags.definition(tags.variableName), color: '#ffa657' },
  { tag: [tags.variableName, tags.name], color: '#c9d1d9' },
  { tag: tags.punctuation, color: '#c9d1d9' },
  { tag: tags.meta, color: '#d2a8ff' },
  { tag: tags.escape, color: '#79c0ff' },
  { tag: tags.invalid, color: '#f85149', textDecoration: 'underline wavy' },
  { tag: tags.link, color: '#58a6ff', textDecoration: 'underline' }
])

function getLanguageExtension(runtime: RuntimeType): LanguageSupport {
  return getScheduleCodeLanguage(runtime) === 'javascript' ? javascript() : python()
}

export function ScheduleCodeEditor({
  code,
  runtime,
  onChange
}: ScheduleCodeEditorProps): ReactElement {
  const editorRootRef = useRef<HTMLDivElement | null>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const languageCompartmentRef = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const initialCodeRef = useRef(code)
  const initialRuntimeRef = useRef(runtime)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const editorRoot = editorRootRef.current
    if (!editorRoot) {
      return
    }

    const editorState = EditorState.create({
      doc: initialCodeRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        bracketMatching(),
        indentOnInput(),
        syntaxHighlighting(githubCopilotHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        languageCompartmentRef.current.of(getLanguageExtension(initialRuntimeRef.current)),
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            !update.transactions.some((transaction) => {
              return transaction.annotation(externalCodeChange) === true
            })
          ) {
            onChangeRef.current(update.state.doc.toString())
          }
        })
      ]
    })

    const editorView = new EditorView({ state: editorState, parent: editorRoot })
    editorViewRef.current = editorView

    return () => {
      editorView.destroy()
      editorViewRef.current = null
    }
  }, [])

  useEffect(() => {
    const editorView = editorViewRef.current
    if (!editorView || editorView.state.doc.toString() === code) {
      return
    }

    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: code
      },
      annotations: externalCodeChange.of(true)
    })
  }, [code])

  useEffect(() => {
    const editorView = editorViewRef.current
    if (!editorView) {
      return
    }

    editorView.dispatch({
      effects: languageCompartmentRef.current.reconfigure(getLanguageExtension(runtime))
    })
  }, [runtime])

  const languageName = getScheduleCodeLanguage(runtime) === 'javascript' ? 'JavaScript' : 'Python'

  return (
    <section
      className="scheduling-code-editor flex min-h-0 min-w-0 flex-1 flex-col gap-2"
      aria-label="Automation code"
      data-testid="scheduling-code-editor"
    >
      <div
        ref={editorRootRef}
        id="scheduling-code"
        className="scheduling-code-editor-surface min-h-0 min-w-0 flex-1"
        data-testid="scheduling-code-editor-surface"
        aria-describedby="scheduling-code-description"
      />
      <p id="scheduling-code-description" className="sr-only">
        Editable {languageName} automation source with syntax highlighting and line numbers.
      </p>
    </section>
  )
}
