import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement
} from 'react'
import type { NoteVimKeyMapping, NoteVimMappingAction } from '../../../shared/types'
import type { NoteVimMode } from '../lib/noteVimMode'
import {
  applyNoteRawEnter,
  clampNoteRawPosition,
  findNoteRawHeadingPositions,
  getNoteRawAdjacentLinePosition,
  getNoteRawFirstNonWhitespacePosition,
  getNoteRawLineBounds,
  getNoteRawLineEndPosition,
  getNoteRawLinewiseRange,
  getNoteRawLinewiseText,
  getNoteRawVisualLineRange,
  getNoteRawWordEndAfter,
  getNoteRawWordStartAfter,
  getNoteRawWordStartBefore
} from '../lib/noteRawVim'
import { getNoteRawHistoryEntryBytes, trimNoteRawHistory } from '../lib/noteRawHistory'
import { cn } from '../lib/utils'

type NoteRawPendingCommand =
  | { kind: 'prefix'; key: 'g' }
  | { kind: 'operator'; operator: 'd' | 'c' }
  | null

type NoteRawCommandMode = Exclude<NoteVimMode, 'insert'>

interface NoteRawCommandMappingState {
  mode: NoteRawCommandMode
  sequence: string
  timestamp: number
}

const NOTE_RAW_VIM_MAPPING_TIMEOUT_MS = 1000

export interface NoteRawEditorHandle {
  focus: () => void
  blur: () => void
  hasFocus: () => boolean
  insertText: (text: string) => void
  jumpToOutlineIndex: (index: number) => void
}

export interface NoteRawEditorProps {
  value: string
  active: boolean
  readOnly?: boolean
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onChange: (value: string) => void
  onVimModeChange?: (mode: NoteVimMode) => void
  onEditorElementChange?: (element: HTMLTextAreaElement | null) => void
  className?: string
}

function isPrintableRawKey(key: string): boolean {
  return [...key].length === 1 && !/[\p{Cc}\p{Cf}]/u.test(key)
}

function hasRawKeyModifier(event: ReactKeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.metaKey || event.ctrlKey || event.altKey
}

function finishRawVimKey(
  event: ReactKeyboardEvent<HTMLTextAreaElement>,
  handled: boolean
): boolean {
  const consumePrintable = isPrintableRawKey(event.key)
  if (handled || consumePrintable) {
    event.preventDefault()
  }

  return handled || consumePrintable
}

function getRawSelection(textarea: HTMLTextAreaElement): { from: number; to: number } {
  return {
    from: Math.min(textarea.selectionStart, textarea.selectionEnd),
    to: Math.max(textarea.selectionStart, textarea.selectionEnd)
  }
}

export const NoteRawEditor = forwardRef<NoteRawEditorHandle, NoteRawEditorProps>(
  function NoteRawEditor(
    {
      value,
      active,
      readOnly = false,
      vimModeEnabled,
      vimKeyMappings,
      onChange,
      onVimModeChange,
      onEditorElementChange,
      className
    },
    ref
  ): ReactElement {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const valueRef = useRef(value)
    const onChangeRef = useRef(onChange)
    const onVimModeChangeRef = useRef(onVimModeChange)
    const onEditorElementChangeRef = useRef(onEditorElementChange)
    const vimModeEnabledRef = useRef(vimModeEnabled)
    const vimKeyMappingsRef = useRef(vimKeyMappings)
    const readOnlyRef = useRef(readOnly)
    const activeRef = useRef(active)
    const modeRef = useRef<NoteVimMode>('insert')
    const pendingCommandRef = useRef<NoteRawPendingCommand>(null)
    const commandMappingRef = useRef<NoteRawCommandMappingState>({
      mode: 'normal',
      sequence: '',
      timestamp: 0
    })
    const insertMappingSequenceRef = useRef('')
    const insertMappingStartRef = useRef<number | null>(null)
    const visualAnchorRef = useRef<number | null>(null)
    const visualHeadRef = useRef<number | null>(null)
    const preferredColumnRef = useRef<number | null>(null)
    const historyRef = useRef<string[]>([])
    const historyBytesRef = useRef(0)
    const registerRef = useRef('')
    const wasActiveRef = useRef(false)

    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
      onVimModeChangeRef.current = onVimModeChange
    }, [onVimModeChange])

    useEffect(() => {
      onEditorElementChangeRef.current = onEditorElementChange
    }, [onEditorElementChange])

    useEffect(() => {
      vimModeEnabledRef.current = vimModeEnabled
    }, [vimModeEnabled])

    useEffect(() => {
      vimKeyMappingsRef.current = vimKeyMappings
    }, [vimKeyMappings])

    useEffect(() => {
      readOnlyRef.current = readOnly
    }, [readOnly])

    useEffect(() => {
      activeRef.current = active
    }, [active])

    const setTextareaElement = useCallback((element: HTMLTextAreaElement | null): void => {
      textareaRef.current = element
      onEditorElementChangeRef.current?.(element)
    }, [])

    const setSelection = useCallback(
      (from: number, to = from, direction: 'forward' | 'backward' = 'forward'): void => {
        const textarea = textareaRef.current
        if (!textarea) {
          return
        }

        const boundedFrom = clampNoteRawPosition(textarea.value, from)
        const boundedTo = clampNoteRawPosition(textarea.value, to)
        try {
          textarea.setSelectionRange(boundedFrom, boundedTo, direction)
        } catch {
          textarea.selectionStart = boundedFrom
          textarea.selectionEnd = boundedTo
        }
      },
      []
    )

    const setNormalModeSelection = useCallback(
      (position: number): void => {
        const textarea = textareaRef.current
        if (!textarea) {
          return
        }

        const boundedPosition = clampNoteRawPosition(textarea.value, position)
        const nextPosition =
          textarea.value.length > 0 ? Math.min(boundedPosition, textarea.value.length - 1) : 0
        setSelection(
          nextPosition,
          textarea.value.length > 0
            ? Math.min(nextPosition + 1, textarea.value.length)
            : nextPosition
        )
      },
      [setSelection]
    )

    const resetCommandSequences = useCallback((): void => {
      pendingCommandRef.current = null
      commandMappingRef.current = {
        mode: 'normal',
        sequence: '',
        timestamp: 0
      }
      insertMappingSequenceRef.current = ''
      insertMappingStartRef.current = null
    }, [])

    const setMode = useCallback((nextMode: NoteVimMode): void => {
      const previousMode = modeRef.current
      modeRef.current = nextMode
      pendingCommandRef.current = null
      commandMappingRef.current = {
        mode: nextMode === 'insert' ? 'normal' : nextMode,
        sequence: '',
        timestamp: 0
      }
      insertMappingSequenceRef.current = ''
      insertMappingStartRef.current = null
      preferredColumnRef.current = null

      if (nextMode !== 'visual' && nextMode !== 'visualLine') {
        visualAnchorRef.current = null
        visualHeadRef.current = null
      }

      if (previousMode !== nextMode) {
        onVimModeChangeRef.current?.(nextMode)
      }
    }, [])

    useEffect(() => {
      if (active && !wasActiveRef.current) {
        resetCommandSequences()
        visualAnchorRef.current = null
        visualHeadRef.current = null
        preferredColumnRef.current = null
        const previousMode = modeRef.current
        setMode('insert')
        if (previousMode === 'insert') {
          onVimModeChangeRef.current?.('insert')
        }
      }

      wasActiveRef.current = active
    }, [active, resetCommandSequences, setMode])

    useEffect(() => {
      if (active && !vimModeEnabled) {
        setMode('insert')
      }
    }, [active, setMode, vimModeEnabled])

    useEffect(() => {
      const textarea = textareaRef.current
      if (!textarea || textarea.value === value) {
        return
      }

      textarea.value = value
      valueRef.current = value
      historyRef.current = []
      historyBytesRef.current = 0
      setSelection(0, 0)
    }, [setSelection, value])

    const pushHistory = (previousValue: string): void => {
      const history = historyRef.current
      if (history[history.length - 1] === previousValue) {
        return
      }

      history.push(previousValue)
      historyBytesRef.current = trimNoteRawHistory(
        history,
        historyBytesRef.current + getNoteRawHistoryEntryBytes(previousValue)
      )
    }

    const updateValue = (
      nextValue: string,
      selectionFrom: number,
      selectionTo = selectionFrom,
      recordHistory = true
    ): void => {
      const textarea = textareaRef.current
      if (!textarea || readOnlyRef.current) {
        return
      }

      const previousValue = textarea.value
      if (previousValue === nextValue) {
        setSelection(selectionFrom, selectionTo)
        return
      }

      if (recordHistory) {
        pushHistory(previousValue)
      }

      textarea.value = nextValue
      valueRef.current = nextValue
      setSelection(selectionFrom, selectionTo)
      onChangeRef.current(nextValue)
    }

    const replaceRange = (
      from: number,
      to: number,
      replacement: string,
      recordHistory = true
    ): void => {
      const textarea = textareaRef.current
      if (!textarea || readOnlyRef.current) {
        return
      }

      const boundedFrom = clampNoteRawPosition(textarea.value, from)
      const boundedTo = clampNoteRawPosition(textarea.value, Math.max(boundedFrom, to))
      const nextValue =
        textarea.value.slice(0, boundedFrom) + replacement + textarea.value.slice(boundedTo)
      updateValue(
        nextValue,
        boundedFrom + replacement.length,
        boundedFrom + replacement.length,
        recordHistory
      )
    }

    const replaceSelection = (replacement: string, recordHistory = true): void => {
      const textarea = textareaRef.current
      if (!textarea) {
        return
      }

      replaceRange(textarea.selectionStart, textarea.selectionEnd, replacement, recordHistory)
    }

    const handleMarkdownEnter = (event: ReactKeyboardEvent<HTMLTextAreaElement>): boolean => {
      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const { from, to } = getRawSelection(textarea)
      const result = applyNoteRawEnter(textarea.value, from, to, {
        continueList: !event.shiftKey
      })
      event.preventDefault()
      updateValue(result.text, result.selection, result.selection)
      return true
    }

    const enterNormalMode = (position?: number): void => {
      const textarea = textareaRef.current
      if (!textarea) {
        return
      }

      const nextPosition = clampNoteRawPosition(textarea.value, position ?? textarea.selectionStart)
      setNormalModeSelection(nextPosition)
      setMode('normal')
    }

    const enterInsertMode = (position?: number): void => {
      const textarea = textareaRef.current
      if (!textarea) {
        return
      }

      setSelection(position ?? textarea.selectionStart)
      setMode('insert')
    }

    const resolveInsertModeExitPosition = (position: number): number => {
      const textarea = textareaRef.current
      if (!textarea) {
        return position
      }

      const line = getNoteRawLineBounds(textarea.value, position)
      if (line.end <= line.start || position <= line.start) {
        return position
      }

      return Math.min(position - 1, line.end - 1)
    }

    const selectNormalModePosition = (position: number): boolean => {
      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const nextPosition =
        textarea.value.length > 0
          ? Math.min(clampNoteRawPosition(textarea.value, position), textarea.value.length - 1)
          : 0
      setNormalModeSelection(nextPosition)
      return true
    }

    const moveVertically = (direction: 'up' | 'down'): boolean => {
      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const position = textarea.selectionStart
      const line = getNoteRawLineBounds(textarea.value, position)
      const currentColumn = Math.max(0, position - line.start)
      const preferredColumn = preferredColumnRef.current ?? currentColumn
      preferredColumnRef.current = preferredColumn
      return selectNormalModePosition(
        getNoteRawAdjacentLinePosition(textarea.value, position, direction, preferredColumn)
      )
    }

    const setVisualSelection = (
      mode: Extract<NoteVimMode, 'visual' | 'visualLine'>,
      head: number
    ): boolean => {
      const textarea = textareaRef.current
      const anchor = visualAnchorRef.current
      if (!textarea || anchor === null) {
        return false
      }

      const boundedHead = clampNoteRawPosition(textarea.value, head)
      visualHeadRef.current = boundedHead
      const range =
        mode === 'visualLine'
          ? getNoteRawVisualLineRange(textarea.value, anchor, boundedHead)
          : {
              from: Math.min(anchor, boundedHead),
              to: Math.min(textarea.value.length, Math.max(anchor, boundedHead) + 1)
            }
      setSelection(range.from, range.to, boundedHead >= anchor ? 'forward' : 'backward')
      return true
    }

    const enterVisualMode = (mode: Extract<NoteVimMode, 'visual' | 'visualLine'>): boolean => {
      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const position =
        textarea.value.length > 0 ? Math.min(textarea.selectionStart, textarea.value.length - 1) : 0
      visualAnchorRef.current = position
      visualHeadRef.current = position
      setMode(mode)
      return setVisualSelection(mode, position)
    }

    const deleteRangeAndSetMode = (
      from: number,
      to: number,
      nextMode: Extract<NoteVimMode, 'insert' | 'normal'>
    ): boolean => {
      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const boundedFrom = clampNoteRawPosition(textarea.value, from)
      const boundedTo = clampNoteRawPosition(textarea.value, Math.max(boundedFrom, to))
      if (boundedTo <= boundedFrom) {
        if (nextMode === 'insert') {
          enterInsertMode(boundedFrom)
        } else {
          enterNormalMode(boundedFrom)
        }
        return true
      }

      replaceRange(boundedFrom, boundedTo, '')
      if (nextMode === 'insert') {
        enterInsertMode(boundedFrom)
      } else {
        enterNormalMode(boundedFrom)
      }
      return true
    }

    const deleteSelectionAndEnterNormal = (): boolean => {
      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const { from, to } = getRawSelection(textarea)
      return deleteRangeAndSetMode(from, to, 'normal')
    }

    const deleteSelectionAndEnterInsert = (): boolean => {
      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const { from, to } = getRawSelection(textarea)
      return deleteRangeAndSetMode(from, to, 'insert')
    }

    const copyRawTextToRegister = (text: string): void => {
      registerRef.current = text
      void navigator.clipboard?.writeText(text).catch((error: unknown) => {
        console.warn('Failed to copy raw note editor text:', error)
      })
    }

    const yankSelectionAndEnterNormal = (): boolean => {
      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const { from, to } = getRawSelection(textarea)
      const selectedText = textarea.value.slice(from, to)
      if (selectedText) {
        copyRawTextToRegister(selectedText)
      }

      enterNormalMode(from)
      return true
    }

    const pasteText = (text: string, placement: 'after' | 'before'): void => {
      const textarea = textareaRef.current
      if (!textarea || !text || readOnlyRef.current) {
        return
      }

      const position =
        placement === 'after'
          ? Math.min(textarea.value.length, textarea.selectionStart + 1)
          : textarea.selectionStart
      replaceRange(position, position, text)
      enterNormalMode(position + text.length)
    }

    const pasteClipboardText = (placement: 'after' | 'before'): boolean => {
      if (registerRef.current) {
        pasteText(registerRef.current, placement)
        return true
      }

      void navigator.clipboard
        ?.readText()
        .then((clipboardText) => {
          if (clipboardText) {
            pasteText(clipboardText, placement)
          }
        })
        .catch((error: unknown) => {
          console.warn('Failed to paste raw note editor clipboard text:', error)
        })
      return true
    }

    const openLineBelow = (): boolean => {
      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const line = getNoteRawLineBounds(textarea.value, textarea.selectionStart)
      replaceRange(line.end, line.end, '\n')
      enterInsertMode(line.end + 1)
      return true
    }

    const openLineAbove = (): boolean => {
      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const line = getNoteRawLineBounds(textarea.value, textarea.selectionStart)
      replaceRange(line.start, line.start, '\n')
      enterInsertMode(line.start)
      return true
    }

    const runVimMappingAction = (action: NoteVimMappingAction): boolean => {
      preferredColumnRef.current = null
      switch (action) {
        case 'enterNormalMode':
          enterNormalMode()
          return true
        case 'enterInsertMode':
          enterInsertMode()
          return true
        case 'appendAfterCursor': {
          const textarea = textareaRef.current
          if (!textarea) return false
          enterInsertMode(Math.min(textarea.value.length, textarea.selectionStart + 1))
          return true
        }
        case 'appendLineEnd': {
          const textarea = textareaRef.current
          if (!textarea) return false
          enterInsertMode(getNoteRawLineBounds(textarea.value, textarea.selectionStart).end)
          return true
        }
        case 'openLineBelow':
          return openLineBelow()
        case 'openLineAbove':
          return openLineAbove()
        case 'pasteAfterCursor':
          return pasteClipboardText('after')
        case 'pasteBeforeCursor':
          return pasteClipboardText('before')
        case 'deleteSelection':
          return deleteSelectionAndEnterNormal()
        case 'yankSelection':
          return yankSelectionAndEnterNormal()
        default:
          return false
      }
    }

    const tryCommandMapping = (
      event: ReactKeyboardEvent<HTMLTextAreaElement>,
      mode: NoteRawCommandMode
    ): boolean => {
      if (!isPrintableRawKey(event.key)) {
        return false
      }

      const mappings = vimKeyMappingsRef.current.filter((mapping) => mapping.mode === mode)
      if (mappings.length === 0) {
        return false
      }

      const mappingState = commandMappingRef.current
      const nextSequence =
        mappingState.mode === mode &&
        Date.now() - mappingState.timestamp <= NOTE_RAW_VIM_MAPPING_TIMEOUT_MS
          ? mappingState.sequence + event.key
          : event.key
      const matchingMapping = mappings.find((mapping) => mapping.sequence === nextSequence)
      const hasPrefix = mappings.some(
        (mapping) => mapping.sequence !== nextSequence && mapping.sequence.startsWith(nextSequence)
      )

      if (matchingMapping) {
        event.preventDefault()
        commandMappingRef.current = { mode, sequence: '', timestamp: 0 }
        return runVimMappingAction(matchingMapping.action)
      }

      if (hasPrefix) {
        event.preventDefault()
        preferredColumnRef.current = null
        commandMappingRef.current = { mode, sequence: nextSequence, timestamp: Date.now() }
        return true
      }

      commandMappingRef.current = { mode, sequence: '', timestamp: 0 }
      return false
    }

    const tryInsertMapping = (event: ReactKeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!isPrintableRawKey(event.key)) {
        return false
      }

      const mappings = vimKeyMappingsRef.current.filter((mapping) => mapping.mode === 'insert')
      if (mappings.length === 0) {
        return false
      }

      const now = Date.now()
      const previousSequence = insertMappingSequenceRef.current
      const nextSequence =
        previousSequence &&
        now - commandMappingRef.current.timestamp <= NOTE_RAW_VIM_MAPPING_TIMEOUT_MS
          ? previousSequence + event.key
          : event.key
      const matchingMapping = mappings.find((mapping) => mapping.sequence === nextSequence)
      const hasPrefix = mappings.some(
        (mapping) => mapping.sequence !== nextSequence && mapping.sequence.startsWith(nextSequence)
      )

      if (!matchingMapping && !hasPrefix) {
        insertMappingSequenceRef.current = ''
        insertMappingStartRef.current = null
        return false
      }

      event.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) {
        return true
      }

      const insertStart = insertMappingStartRef.current ?? textarea.selectionStart
      if (insertMappingStartRef.current === null) {
        insertMappingStartRef.current = insertStart
      }
      replaceRange(textarea.selectionStart, textarea.selectionEnd, event.key)
      insertMappingSequenceRef.current = nextSequence
      commandMappingRef.current = { mode: 'normal', sequence: '', timestamp: now }

      if (matchingMapping) {
        const end = insertStart + nextSequence.length
        replaceRange(insertStart, end, '')
        insertMappingSequenceRef.current = ''
        insertMappingStartRef.current = null
        return runVimMappingAction(matchingMapping.action)
      }

      return true
    }

    const handlePendingCommand = (key: string): boolean => {
      const textarea = textareaRef.current
      const pendingCommand = pendingCommandRef.current
      if (!textarea || !pendingCommand) {
        return false
      }

      if (pendingCommand.kind === 'prefix') {
        pendingCommandRef.current = null
        if (key === 'g') {
          return selectNormalModePosition(0)
        }
        return true
      }

      pendingCommandRef.current = null
      const position = textarea.selectionStart
      let range: { from: number; to: number } | null = null
      if (key === pendingCommand.operator) {
        range = getNoteRawLinewiseRange(textarea.value, position)
        if (pendingCommand.operator === 'd') {
          copyRawTextToRegister(getNoteRawLinewiseText(textarea.value, position))
        }
      } else if (key === 'w') {
        range = { from: position, to: getNoteRawWordStartAfter(textarea.value, position) }
      } else if (key === 'e') {
        range = { from: position, to: getNoteRawWordEndAfter(textarea.value, position) + 1 }
      } else if (key === '$') {
        range = { from: position, to: getNoteRawLineBounds(textarea.value, position).end }
      }

      if (!range) {
        return true
      }

      return deleteRangeAndSetMode(
        range.from,
        range.to,
        pendingCommand.operator === 'c' ? 'insert' : 'normal'
      )
    }

    const handleNormalModeKey = (event: ReactKeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (hasRawKeyModifier(event)) {
        return false
      }

      if (tryCommandMapping(event, 'normal')) {
        return true
      }

      if (event.key !== 'j' && event.key !== 'k') {
        preferredColumnRef.current = null
      }

      if (handlePendingCommand(event.key)) {
        event.preventDefault()
        return true
      }

      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      let handled = true
      switch (event.key) {
        case 'Escape':
          resetCommandSequences()
          break
        case 'i':
          enterInsertMode()
          break
        case 'a':
          enterInsertMode(Math.min(textarea.value.length, textarea.selectionStart + 1))
          break
        case 'A':
          enterInsertMode(getNoteRawLineBounds(textarea.value, textarea.selectionStart).end)
          break
        case 'o':
          handled = openLineBelow()
          break
        case 'O':
          handled = openLineAbove()
          break
        case 'v':
          handled = enterVisualMode('visual')
          break
        case 'V':
          handled = enterVisualMode('visualLine')
          break
        case 'h':
          handled = selectNormalModePosition(textarea.selectionStart - 1)
          break
        case 'l':
          handled = selectNormalModePosition(textarea.selectionStart + 1)
          break
        case 'j':
          handled = moveVertically('down')
          break
        case 'k':
          handled = moveVertically('up')
          break
        case 'w':
          handled = selectNormalModePosition(
            getNoteRawWordStartAfter(textarea.value, textarea.selectionStart)
          )
          break
        case 'b':
          handled = selectNormalModePosition(
            getNoteRawWordStartBefore(textarea.value, textarea.selectionStart)
          )
          break
        case 'e':
          handled = selectNormalModePosition(
            getNoteRawWordEndAfter(textarea.value, textarea.selectionStart)
          )
          break
        case '0':
          handled = selectNormalModePosition(
            getNoteRawLineBounds(textarea.value, textarea.selectionStart).start
          )
          break
        case '^':
          handled = selectNormalModePosition(
            getNoteRawFirstNonWhitespacePosition(textarea.value, textarea.selectionStart)
          )
          break
        case '$':
          handled = selectNormalModePosition(
            getNoteRawLineEndPosition(textarea.value, textarea.selectionStart)
          )
          break
        case 'G':
          handled = selectNormalModePosition(Math.max(0, textarea.value.length - 1))
          break
        case 'g':
          pendingCommandRef.current = { kind: 'prefix', key: 'g' }
          break
        case 'd':
          pendingCommandRef.current = { kind: 'operator', operator: 'd' }
          break
        case 'c':
          pendingCommandRef.current = { kind: 'operator', operator: 'c' }
          break
        case 'x':
          handled = deleteRangeAndSetMode(
            textarea.selectionStart,
            textarea.selectionStart + 1,
            'normal'
          )
          break
        case 'D':
          handled = deleteRangeAndSetMode(
            textarea.selectionStart,
            getNoteRawLineBounds(textarea.value, textarea.selectionStart).end,
            'normal'
          )
          break
        case 'C':
          handled = deleteRangeAndSetMode(
            textarea.selectionStart,
            getNoteRawLineBounds(textarea.value, textarea.selectionStart).end,
            'insert'
          )
          break
        case 'p':
          handled = pasteClipboardText('after')
          break
        case 'P':
          handled = pasteClipboardText('before')
          break
        case 'u': {
          const previousValue = historyRef.current.pop()
          if (previousValue !== undefined) {
            historyBytesRef.current = Math.max(
              0,
              historyBytesRef.current - getNoteRawHistoryEntryBytes(previousValue)
            )
            const nextPosition = Math.min(textarea.selectionStart, previousValue.length)
            updateValue(previousValue, nextPosition, nextPosition, false)
            setNormalModeSelection(nextPosition)
          }
          break
        }
        case 'Enter':
          break
        default:
          handled = false
      }

      const consumePrintable = isPrintableRawKey(event.key)
      if (handled || consumePrintable) {
        event.preventDefault()
      }
      return handled || consumePrintable
    }

    const handleVisualModeKey = (
      event: ReactKeyboardEvent<HTMLTextAreaElement>,
      mode: Extract<NoteVimMode, 'visual' | 'visualLine'>
    ): boolean => {
      if (hasRawKeyModifier(event)) {
        return false
      }

      if (tryCommandMapping(event, mode)) {
        return true
      }

      if (event.key !== 'j' && event.key !== 'k') {
        preferredColumnRef.current = null
      }

      const textarea = textareaRef.current
      if (!textarea) {
        return false
      }

      const head = visualHeadRef.current ?? textarea.selectionStart
      if (event.key === 'g' && pendingCommandRef.current?.kind === 'prefix') {
        pendingCommandRef.current = null
        return finishRawVimKey(event, setVisualSelection(mode, 0))
      }

      if (handlePendingCommand(event.key)) {
        return finishRawVimKey(event, true)
      }

      const handled = (() => {
        switch (event.key) {
          case 'Escape':
            enterNormalMode(head)
            return true
          case 'i':
            enterInsertMode(head)
            return true
          case 'v':
            if (mode === 'visual') {
              enterNormalMode(head)
              return true
            }
            setMode('visual')
            return setVisualSelection('visual', head)
          case 'V':
            if (mode === 'visualLine') {
              enterNormalMode(head)
              return true
            }
            setMode('visualLine')
            return setVisualSelection('visualLine', head)
          case 'g':
            pendingCommandRef.current = { kind: 'prefix', key: 'g' }
            return true
          case 'd':
          case 'x':
            return deleteSelectionAndEnterNormal()
          case 'c':
            return deleteSelectionAndEnterInsert()
          case 'y':
            return yankSelectionAndEnterNormal()
          case 'h':
            return setVisualSelection(mode, head - 1)
          case 'l':
            return setVisualSelection(mode, head + 1)
          case 'j':
            return setVisualSelection(
              mode,
              getNoteRawAdjacentLinePosition(
                textarea.value,
                head,
                'down',
                preferredColumnRef.current ?? 0
              )
            )
          case 'k':
            return setVisualSelection(
              mode,
              getNoteRawAdjacentLinePosition(
                textarea.value,
                head,
                'up',
                preferredColumnRef.current ?? 0
              )
            )
          case 'w':
            return setVisualSelection(mode, getNoteRawWordStartAfter(textarea.value, head))
          case 'b':
            return setVisualSelection(mode, getNoteRawWordStartBefore(textarea.value, head))
          case 'e':
            return setVisualSelection(mode, getNoteRawWordEndAfter(textarea.value, head))
          case '0':
          case '^':
            return setVisualSelection(
              mode,
              event.key === '0'
                ? getNoteRawLineBounds(textarea.value, head).start
                : getNoteRawFirstNonWhitespacePosition(textarea.value, head)
            )
          case '$':
            return setVisualSelection(mode, getNoteRawLineEndPosition(textarea.value, head))
          case 'G':
            return setVisualSelection(mode, Math.max(0, textarea.value.length - 1))
          case 'Enter':
            return true
          default:
            return false
        }
      })()

      return finishRawVimKey(event, handled)
    }

    const handleInsertModeKey = (event: ReactKeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (event.key === 'Escape') {
        event.preventDefault()
        const textarea = textareaRef.current
        const nextPosition = textarea
          ? resolveInsertModeExitPosition(textarea.selectionStart)
          : undefined
        enterNormalMode(nextPosition)
        resetCommandSequences()
        return true
      }

      if (hasRawKeyModifier(event)) {
        resetCommandSequences()
        return false
      }

      if (tryInsertMapping(event)) {
        return true
      }

      resetCommandSequences()
      return false
    }

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
      if (!activeRef.current || readOnlyRef.current || event.nativeEvent.isComposing) {
        return
      }

      if (modeRef.current === 'insert' && event.key === 'Enter' && !hasRawKeyModifier(event)) {
        handleMarkdownEnter(event)
        return
      }

      if (!vimModeEnabledRef.current) {
        return
      }

      if (modeRef.current === 'insert') {
        handleInsertModeKey(event)
        return
      }

      if (modeRef.current === 'visual' || modeRef.current === 'visualLine') {
        handleVisualModeKey(event, modeRef.current)
        return
      }

      handleNormalModeKey(event)
    }

    const handlePaste = (event: ReactClipboardEvent<HTMLTextAreaElement>): void => {
      if (!activeRef.current || !vimModeEnabledRef.current || readOnlyRef.current) {
        return
      }

      if (modeRef.current === 'insert') {
        return
      }

      event.preventDefault()
      const pastedText = event.clipboardData.getData('text/plain')
      if (!pastedText) {
        return
      }

      const textarea = textareaRef.current
      if (!textarea) {
        return
      }

      const { from, to } = getRawSelection(textarea)
      replaceRange(from, to, pastedText)
      enterNormalMode(from + pastedText.length)
    }

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const nextValue = event.currentTarget.value
      if (nextValue !== valueRef.current) {
        pushHistory(valueRef.current)
      }
      valueRef.current = nextValue
      onChangeRef.current(nextValue)
    }

    const handleFocus = (): void => {
      if (activeRef.current && vimModeEnabledRef.current) {
        resetCommandSequences()
        visualAnchorRef.current = null
        visualHeadRef.current = null
        setMode('insert')
      }
    }

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      hasFocus: () => document.activeElement === textareaRef.current,
      insertText: (text: string) => replaceSelection(text),
      jumpToOutlineIndex: (index: number) => {
        const textarea = textareaRef.current
        if (!textarea || index < 0) {
          return
        }

        const position = findNoteRawHeadingPositions(textarea.value)[index]
        if (position === undefined) {
          return
        }

        textarea.focus()
        setSelection(position, position)
        textarea.scrollIntoView({ block: 'center', behavior: 'auto' })
      }
    }))

    return (
      <div
        className={cn('note-raw-editor-surface min-h-[10vh] min-w-0', className)}
        data-testid="note-raw-editor-surface"
        data-note-raw-scroll="bounded"
        hidden={!active}
        aria-hidden={!active}
      >
        <textarea
          ref={setTextareaElement}
          defaultValue={value}
          aria-label="Raw markdown editor"
          data-note-raw-editor="true"
          data-testid="note-raw-editor"
          className="note-raw-editor-input"
          readOnly={readOnly}
          spellCheck={false}
          wrap="soft"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
        />
      </div>
    )
  }
)

NoteRawEditor.displayName = 'NoteRawEditor'
