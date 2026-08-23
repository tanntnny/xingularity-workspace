import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import {
  bracketMatching,
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
import { useEffect, useRef, type ReactElement } from 'react'
import type { RuntimeType } from '../../../../shared/scheduleTypes'
import { githubCopilotHighlightStyle } from '../../lib/codeSyntaxHighlighting'
import { getScheduleCodeLanguage } from '../../lib/schedulingCodeEditor'

export interface ScheduleCodeEditorProps {
  code: string
  runtime: RuntimeType
  onChange: (code: string) => void
}

const externalCodeChange = Annotation.define<boolean>()

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
