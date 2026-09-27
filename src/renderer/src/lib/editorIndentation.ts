import { indentUnit } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

export const EDITOR_INDENT_UNIT = '\t'
export const EDITOR_TAB_SIZE = 4

export const sharedEditorIndentation: Extension = [
  indentUnit.of(EDITOR_INDENT_UNIT),
  EditorState.tabSize.of(EDITOR_TAB_SIZE)
]

class NoteEditorTabWidthMeasurement {
  private readonly meter: HTMLSpanElement
  private readonly observer: ResizeObserver | null
  private measureScheduled = false

  constructor(private readonly view: EditorView) {
    this.meter = document.createElement('span')
    this.meter.setAttribute('aria-hidden', 'true')
    this.meter.contentEditable = 'false'
    this.meter.textContent = '\t'
    this.meter.style.position = 'absolute'
    this.meter.style.display = 'inline-block'
    this.meter.style.visibility = 'hidden'
    this.meter.style.pointerEvents = 'none'
    this.meter.style.userSelect = 'none'
    this.meter.style.whiteSpace = 'pre'
    this.meter.style.font = 'inherit'
    this.meter.style.lineHeight = 'inherit'
    this.meter.className = 'note-editor-tab-width-meter'
    this.view.dom.appendChild(this.meter)

    this.observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.requestMeasure())
    this.observer?.observe(this.meter)
    this.observer?.observe(this.view.dom)

    this.syncTabSize()
    this.requestMeasure()
  }

  update(update: ViewUpdate): void {
    if (update.state.tabSize !== update.startState.tabSize) {
      this.syncTabSize()
      this.requestMeasure()
    }
  }

  destroy(): void {
    this.observer?.disconnect()
    this.meter.remove()
    this.view.dom.style.removeProperty('--note-editor-tab-width')
  }

  private syncTabSize(): void {
    this.meter.style.setProperty('tab-size', String(this.view.state.tabSize))
  }

  private requestMeasure(): void {
    if (this.measureScheduled) return
    this.measureScheduled = true
    this.view.requestMeasure({
      key: this,
      read: () => this.meter.getBoundingClientRect().width,
      write: (width) => {
        this.measureScheduled = false
        if (width <= 0) return
        this.view.dom.style.setProperty('--note-editor-tab-width', `${width}px`)
      }
    })
  }
}

export const noteEditorTabWidth: Extension = ViewPlugin.fromClass(NoteEditorTabWidthMeasurement)
