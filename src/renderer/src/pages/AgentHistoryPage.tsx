import {
  type KeyboardEvent,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  AtSign,
  Bot,
  CheckCircle2,
  Copy,
  FileText,
  FolderKanban,
  MessageSquarePlus,
  Pencil,
  Trash2,
  X
} from 'lucide-react'
import type {
  AgentChatMentionRef,
  AgentChatMessageRecord,
  AgentChatSession,
  AgentChatToolStep,
  NoteListItem,
  Project,
  RendererVaultApi
} from '../../../shared/types'
import { stripNoteExtension } from '../../../shared/noteDocument'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton
} from '../components/ai-elements/conversation'
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse
} from '../components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools
} from '../components/ai-elements/prompt-input'
import {
  DocumentWorkspace,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainContent,
  DocumentWorkspaceMainHeader,
  DocumentWorkspacePanel,
  DocumentWorkspacePanelContent,
  DocumentWorkspacePanelHeader,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionDivider,
  WorkspaceHeaderActionGroup
} from '../components/ui/document-workspace'
import { WorkspacePanelSectionHeader } from '../components/ui/workspace-panel-section'
import { cn } from '../lib/utils'

interface AgentHistoryPageProps {
  vaultApi: RendererVaultApi | undefined
  pushToast: (kind: 'info' | 'error' | 'success', message: string) => void
  notes: NoteListItem[]
  projects: Project[]
}

interface MentionSuggestion {
  id: string
  kind: 'note' | 'project'
  label: string
  detail: string
  notePath?: string
  projectId?: string
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 3)}...`
}

function createEmptySession(): AgentChatSession {
  const now = new Date().toISOString()
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'New chat',
    titleMode: 'auto',
    createdAt: now,
    updatedAt: now,
    messages: []
  }
}

function deriveSessionTitle(messages: AgentChatMessageRecord[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user')
  if (!firstUserMessage) {
    return 'New chat'
  }
  const normalized = firstUserMessage.content.replace(/\s+/g, ' ').trim()
  return truncateText(normalized || 'New chat', 60)
}

function getSessionTitle(session: AgentChatSession): string {
  if ((session.titleMode ?? 'auto') === 'manual') {
    return truncateText(session.title.trim() || 'New chat', 60)
  }
  return deriveSessionTitle(session.messages)
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function extractActiveMention(
  value: string,
  cursor: number
): { start: number; query: string } | null {
  if (cursor < 0) {
    return null
  }

  const left = value.slice(0, cursor)
  const atIndex = left.lastIndexOf('@')
  if (atIndex < 0) {
    return null
  }

  const previousChar = atIndex === 0 ? ' ' : left[atIndex - 1]
  if (!/\s|\(|\[|\{|^/.test(previousChar)) {
    return null
  }

  const query = left.slice(atIndex + 1)
  if (/\s/.test(query)) {
    return null
  }

  return { start: atIndex, query }
}

function buildMentionSuggestions(notes: NoteListItem[], projects: Project[]): MentionSuggestion[] {
  const noteSuggestions = notes.map((note) => ({
    id: `note:${note.relPath}`,
    kind: 'note' as const,
    label: stripNoteExtension(note.name),
    detail: note.relPath,
    notePath: note.relPath
  }))

  const projectSuggestions = projects.map((project) => ({
    id: `project:${project.id}`,
    kind: 'project' as const,
    label: project.name,
    detail: project.summary || project.status,
    projectId: project.id
  }))

  return [...projectSuggestions, ...noteSuggestions]
}

function stepStatusTone(
  status: AgentChatToolStep['status']
): { badgeClass: string; label: string; icon: ReactElement } {
  switch (status) {
    case 'error':
      return {
        badgeClass: 'bg-rose-500/10 text-rose-500',
        label: 'Error',
        icon: <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
      }
    case 'approval-required':
      return {
        badgeClass: 'bg-amber-500/10 text-amber-600',
        label: 'Needs approval',
        icon: <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
      }
    case 'rejected':
      return {
        badgeClass: 'bg-slate-500/10 text-slate-500',
        label: 'Rejected',
        icon: <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
      }
    default:
      return {
        badgeClass: 'bg-emerald-500/10 text-emerald-600',
        label: 'Completed',
        icon: <CheckCircle2 size={14} className="text-emerald-500" />
      }
  }
}

export function AgentHistoryPage({
  vaultApi,
  pushToast,
  notes,
  projects
}: AgentHistoryPageProps): ReactElement {
  const [sessions, setSessions] = useState<AgentChatSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [selectedMentions, setSelectedMentions] = useState<AgentChatMentionRef[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [liveRequestId, setLiveRequestId] = useState<string | null>(null)
  const [liveContent, setLiveContent] = useState('')
  const [liveToolSteps, setLiveToolSteps] = useState<
    NonNullable<AgentChatMessageRecord['toolSteps']>
  >([])
  const [cursorIndex, setCursorIndex] = useState(0)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  )

  const messages = useMemo(() => {
    const baseMessages = activeSession?.messages ?? []
    if (!liveRequestId) {
      return baseMessages
    }
    return [
      ...baseMessages,
      {
        id: `streaming-${liveRequestId}`,
        role: 'assistant' as const,
        content: liveContent || '...',
        createdAt: new Date().toISOString(),
        toolSteps: liveToolSteps,
        model: 'live'
      }
    ]
  }, [activeSession?.messages, liveContent, liveRequestId, liveToolSteps])

  const allSuggestions = useMemo(() => buildMentionSuggestions(notes, projects), [notes, projects])
  const activeMention = useMemo(
    () => extractActiveMention(input, cursorIndex),
    [input, cursorIndex]
  )

  const filteredSuggestions = useMemo(() => {
    if (!activeMention) {
      return []
    }

    const search = activeMention.query.trim().toLowerCase()
    return allSuggestions
      .filter((suggestion) => !selectedMentions.some((item) => item.id === suggestion.id))
      .filter((suggestion) => {
        if (!search) {
          return true
        }
        return [suggestion.label, suggestion.detail, suggestion.kind].some((value) =>
          value.toLowerCase().includes(search)
        )
      })
      .slice(0, 8)
  }, [activeMention, allSuggestions, selectedMentions])

  const loadSessions = useCallback(async () => {
    if (!vaultApi) {
      return
    }

    setIsLoadingSessions(true)
    try {
      const nextSessions = await vaultApi.agentChat.listSessions()
      setSessions(nextSessions)
      setSelectedSessionId((current) => current ?? nextSessions[0]?.id ?? null)
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setIsLoadingSessions(false)
    }
  }, [pushToast, vaultApi])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!vaultApi) {
      return
    }

    return vaultApi.agentChat.onEvent((event) => {
      if (!liveRequestId || event.requestId !== liveRequestId) {
        return
      }

      if (event.type === 'status') {
        if (event.status === 'started') {
          setLiveContent('')
          setLiveToolSteps([])
        }
        return
      }

      if (event.type === 'text-delta') {
        setLiveContent((current) => `${current}${event.delta}`)
        return
      }

      setLiveToolSteps((current) => {
        const existingIndex = current.findIndex((step) => step.id === event.toolStep.id)
        if (existingIndex < 0) {
          return [...current, event.toolStep]
        }
        const next = [...current]
        next[existingIndex] = event.toolStep
        return next
      })
    })
  }, [liveRequestId, vaultApi])

  useEffect(() => {
    setIsRenaming(false)
    setRenameDraft(activeSession?.title ?? '')
  }, [activeSession?.id, activeSession?.title])

  useEffect(() => {
    if (!isRenaming) {
      return
    }
    requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
  }, [isRenaming])

  const persistSession = useCallback(
    async (session: AgentChatSession): Promise<AgentChatSession | null> => {
      if (!vaultApi) {
        return null
      }

      const nextSession: AgentChatSession = {
        ...session,
        titleMode: session.titleMode ?? 'auto',
        title: getSessionTitle(session),
        updatedAt: new Date().toISOString()
      }

      try {
        const saved = await vaultApi.agentChat.saveSession(nextSession)
        setSessions((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
        setSelectedSessionId(saved.id)
        return saved
      } catch (error) {
        pushToast('error', String(error))
        return null
      }
    },
    [pushToast, vaultApi]
  )

  const createSession = useCallback(async (): Promise<void> => {
    const session = createEmptySession()
    setInput('')
    setSelectedMentions([])
    setCursorIndex(0)
    await persistSession(session)
  }, [persistSession])

  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!vaultApi) {
        return
      }
      try {
        await vaultApi.agentChat.deleteSession(sessionId)
        setSessions((current) => {
          const nextSessions = current.filter((session) => session.id !== sessionId)
          setSelectedSessionId((selected) =>
            selected === sessionId ? (nextSessions[0]?.id ?? null) : selected
          )
          return nextSessions
        })
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [pushToast, vaultApi]
  )

  const approveToolStep = useCallback(
    async (stepId: string, toolName: string, input: unknown): Promise<void> => {
      if (!vaultApi || !activeSession) {
        return
      }

      const requestId = `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      try {
        setLiveRequestId(requestId)
        setLiveContent('')
        setLiveToolSteps([])
        const result = await vaultApi.agentChat.approveTool({
          requestId,
          stepId,
          toolName,
          input,
          sessionMessages: activeSession.messages
        })
        const updatedSession: AgentChatSession = {
          ...activeSession,
          updatedAt: new Date().toISOString(),
          messages: [
            ...activeSession.messages.map((message) => ({
              ...message,
              toolSteps: message.toolSteps?.map((step) => (step.id === stepId ? result.toolStep : step))
            })),
            result.assistantMessage
          ]
        }
        await persistSession(updatedSession)
      } catch (error) {
        pushToast('error', String(error))
      } finally {
        setLiveRequestId(null)
        setLiveContent('')
        setLiveToolSteps([])
      }
    },
    [activeSession, persistSession, pushToast, vaultApi]
  )

  const rejectToolStep = useCallback(
    async (stepId: string): Promise<void> => {
      if (!activeSession) {
        return
      }

      const rejectedMessage: AgentChatMessageRecord = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content: 'Okay - I did not apply that change.',
        createdAt: new Date().toISOString()
      }
      const updatedSession: AgentChatSession = {
        ...activeSession,
        updatedAt: new Date().toISOString(),
        messages: [
          ...activeSession.messages.map((message) => ({
            ...message,
            toolSteps: message.toolSteps?.map((step): AgentChatToolStep =>
              step.id === stepId
                ? ({
                    ...step,
                    status: 'rejected',
                    outputSummary: 'User rejected this change.',
                    approvalRequest: undefined
                  } satisfies AgentChatToolStep)
                : step
            )
          })),
          rejectedMessage
        ]
      }
      await persistSession(updatedSession)
    },
    [activeSession, persistSession]
  )

  const insertMention = (suggestion: MentionSuggestion): void => {
    const mention: AgentChatMentionRef = {
      id: suggestion.id,
      kind: suggestion.kind,
      label: suggestion.label,
      notePath: suggestion.notePath,
      projectId: suggestion.projectId
    }

    setSelectedMentions((current) => [...current, mention])
    if (activeMention) {
      const nextInput = `${input.slice(0, activeMention.start)}${input.slice(cursorIndex)}`.replace(
        /\s{2,}/g,
        ' '
      )
      setInput(nextInput)
      const nextCursor = activeMention.start
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
        setCursorIndex(nextCursor)
      })
    }
  }

  const removeMention = (mentionId: string): void => {
    setSelectedMentions((current) => current.filter((mention) => mention.id !== mentionId))
  }

  const submitMessage = async (): Promise<void> => {
    const trimmed = input.trim()
    if (!trimmed || !vaultApi) {
      return
    }

    const session = activeSession ?? createEmptySession()
    const requestId = `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const userMessage: AgentChatMessageRecord = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
      mentions: selectedMentions
    }

    const nextUserSession: AgentChatSession = {
      ...session,
      titleMode: session.titleMode ?? 'auto',
      updatedAt: new Date().toISOString(),
      messages: [...session.messages, userMessage]
    }
    nextUserSession.title = getSessionTitle(nextUserSession)

    setSessions((current) => [nextUserSession, ...current.filter((item) => item.id !== session.id)])
    setSelectedSessionId(nextUserSession.id)
    setInput('')
    setSelectedMentions([])
    setCursorIndex(0)
    setIsSending(true)
    setLiveRequestId(requestId)
    setLiveContent('')
    setLiveToolSteps([])

    try {
      const result = await vaultApi.agentChat.sendMessage({
        requestId,
        message: trimmed,
        mentions: selectedMentions
      })

      const assistantMessage: AgentChatMessageRecord = {
        id: result.id,
        role: 'assistant',
        content: result.content,
        createdAt: result.createdAt,
        contexts: result.contexts,
        toolSteps: result.toolSteps,
        model: result.model
      }

      const finalSession: AgentChatSession = {
        ...nextUserSession,
        updatedAt: new Date().toISOString(),
        messages: [...nextUserSession.messages, assistantMessage]
      }
      finalSession.title = getSessionTitle(finalSession)

      await persistSession(finalSession)
    } catch (error) {
      pushToast('error', String(error))
      setSessions((current) => current.filter((item) => item.id !== nextUserSession.id))
    } finally {
      setIsSending(false)
      setLiveRequestId(null)
      setLiveContent('')
      setLiveToolSteps([])
    }
  }

  const saveRename = useCallback(async (): Promise<void> => {
    if (!activeSession) {
      return
    }

    const trimmed = renameDraft.trim()
    if (!trimmed) {
      setRenameDraft(activeSession.title)
      setIsRenaming(false)
      return
    }

    const renamedSession: AgentChatSession = {
      ...activeSession,
      title: trimmed,
      titleMode: 'manual'
    }

    await persistSession(renamedSession)
    setIsRenaming(false)
  }, [activeSession, persistSession, renameDraft])

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void saveRename()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setRenameDraft(activeSession?.title ?? '')
      setIsRenaming(false)
    }
  }

  const handleDeleteActiveSession = (): void => {
    if (!activeSession) {
      return
    }
    if (!window.confirm(`Delete "${activeSession.title}"? This chat will be removed.`)) {
      return
    }
    setInput('')
    setSelectedMentions([])
    setCursorIndex(0)
    void deleteSession(activeSession.id)
  }

  const headerTitle = activeSession?.title ?? 'Agent Chat'

  return (
    <DocumentWorkspace>
      <DocumentWorkspaceMain>
        <DocumentWorkspaceMainHeader
          breadcrumb={
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Agent Chat
              </p>
              {isRenaming && activeSession ? (
                <input
                  ref={renameInputRef}
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.currentTarget.value)}
                  onBlur={() => {
                    void saveRename()
                  }}
                  onKeyDown={handleRenameKeyDown}
                  className="mt-1 w-full max-w-[360px] rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                />
              ) : (
                <p className="truncate text-sm font-semibold text-[var(--text)]">{headerTitle}</p>
              )}
            </div>
          }
          actions={
            <WorkspaceHeaderActions>
              <WorkspaceHeaderActionGroup>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeSession) {
                      return
                    }
                    setRenameDraft(activeSession.title)
                    setIsRenaming(true)
                  }}
                  disabled={!activeSession}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Pencil size={14} />
                  <span>Rename</span>
                </button>
              </WorkspaceHeaderActionGroup>
              <WorkspaceHeaderActionDivider />
              <WorkspaceHeaderActionGroup>
                <button
                  type="button"
                  onClick={handleDeleteActiveSession}
                  disabled={!activeSession}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/5 px-3 text-xs font-medium text-rose-500 transition hover:border-rose-500/40 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  <span>Delete chat</span>
                </button>
              </WorkspaceHeaderActionGroup>
            </WorkspaceHeaderActions>
          }
        />
        <DocumentWorkspaceMainContent className="min-h-0">
          {!vaultApi ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--muted)]">
              Agent chat is only available inside the desktop app.
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.09),transparent_42%)]">
              <div className="min-h-0 flex-1 px-5 pt-5">
                <Conversation className="rounded-[28px] border border-[var(--line)] bg-[var(--panel)] shadow-sm">
                  <ConversationContent className="space-y-4">
                    {messages.length === 0 ? (
                      <ConversationEmptyState
                        icon={<Bot size={28} />}
                        title="Start agent chat"
                        description="Ask for plans, summaries, rewrites, or next actions. Use @ to attach note or project context before sending."
                      />
                    ) : (
                      messages.map((message) => {
                        const isAssistant = message.role === 'assistant'

                        return (
                          <div key={message.id} className="space-y-2">
                            {isAssistant && message.toolSteps?.length ? (
                              <div className="space-y-2 pl-4">
                                {message.toolSteps.map((step, index) => {
                                  const tone = stepStatusTone(step.status)
                                  return (
                                    <div
                                      key={step.id}
                                      className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)] p-4 shadow-sm"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                          {tone.icon}
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[var(--text)]">
                                              Step {index + 1}: {step.toolName}
                                            </p>
                                            <p className="text-xs text-[var(--muted)]">
                                              Agent tool activity
                                            </p>
                                          </div>
                                        </div>
                                        <span
                                          className={cn(
                                            'rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]',
                                            tone.badgeClass
                                          )}
                                        >
                                          {tone.label}
                                        </span>
                                      </div>
                                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <div>
                                          <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                                            Input
                                          </div>
                                          <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)]">
                                            {step.inputSummary}
                                          </pre>
                                        </div>
                                        <div>
                                          <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                                            Output
                                          </div>
                                          <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)]">
                                            {step.outputSummary}
                                          </pre>
                                        </div>
                                      </div>
                                      {step.status === 'approval-required' && step.approvalRequest ? (
                                        <div className="mt-3 flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              void approveToolStep(
                                                step.id,
                                                step.approvalRequest!.toolName,
                                                step.approvalRequest!.input
                                              )
                                            }}
                                            className="inline-flex h-9 items-center rounded-full bg-emerald-600 px-3 text-xs font-medium text-white transition hover:bg-emerald-500"
                                          >
                                            Approve and run
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              void rejectToolStep(step.id)
                                            }}
                                            className="inline-flex h-9 items-center rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : null}

                            <Message from={message.role}>
                              <MessageContent
                                className={cn(
                                  isAssistant
                                    ? 'bg-[var(--panel)]'
                                    : 'border-[var(--accent)]/20 bg-[var(--accent-soft)]'
                                )}
                              >
                                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                                  <span>{isAssistant ? 'Agent' : 'You'}</span>
                                  <span>{formatRelativeTime(message.createdAt)}</span>
                                  {message.model ? <span>{message.model}</span> : null}
                                </div>
                                {isAssistant ? (
                                  <MessageResponse>{message.content}</MessageResponse>
                                ) : (
                                  <div className="whitespace-pre-wrap text-sm text-[var(--text)]">
                                    {message.content}
                                  </div>
                                )}
                                {message.contexts?.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {message.contexts.map((context) => (
                                      <span
                                        key={context.id}
                                        className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-1 text-[11px] text-[var(--muted)]"
                                      >
                                        {context.kind === 'note' ? (
                                          <FileText size={12} />
                                        ) : (
                                          <FolderKanban size={12} />
                                        )}
                                        <span>{context.label}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {message.mentions?.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {message.mentions.map((mention) => (
                                      <span
                                        key={mention.id}
                                        className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11px] text-[var(--muted)]"
                                      >
                                        {mention.kind === 'note' ? (
                                          <FileText size={12} />
                                        ) : (
                                          <FolderKanban size={12} />
                                        )}
                                        <span>{mention.label}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </MessageContent>
                            </Message>
                            {isAssistant ? (
                              <MessageActions>
                                <MessageAction
                                  label="Copy response"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(message.content)
                                    pushToast('success', 'Response copied')
                                  }}
                                >
                                  <Copy size={14} />
                                </MessageAction>
                              </MessageActions>
                            ) : null}
                          </div>
                        )
                      })
                    )}
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>
              </div>

              <div className="shrink-0 px-5 pb-5 pt-3">
                <div className="relative mx-auto w-full max-w-4xl">
                  {activeMention && filteredSuggestions.length > 0 ? (
                    <div className="absolute bottom-[calc(100%+12px)] left-0 right-0 z-10 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
                      <div className="border-b border-[var(--line)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Attach context
                      </div>
                      <div className="max-h-72 overflow-y-auto p-2">
                        {filteredSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => insertMention(suggestion)}
                            className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[var(--panel-2)]"
                          >
                            <div className="mt-0.5 text-[var(--muted)]">
                              {suggestion.kind === 'note' ? (
                                <FileText size={15} />
                              ) : (
                                <FolderKanban size={15} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-[var(--text)]">
                                {suggestion.label}
                              </div>
                              <div className="truncate text-xs text-[var(--muted)]">
                                {suggestion.detail}
                              </div>
                            </div>
                            <div className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                              {suggestion.kind}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <PromptInput
                    className="mx-auto w-full max-w-4xl"
                    onSubmit={() => {
                      void submitMessage()
                    }}
                  >
                    {selectedMentions.length > 0 ? (
                      <PromptInputHeader>
                        {selectedMentions.map((mention) => (
                          <span
                            key={mention.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-xs text-[var(--text)]"
                          >
                            {mention.kind === 'note' ? (
                              <FileText size={13} />
                            ) : (
                              <FolderKanban size={13} />
                            )}
                            <span>{mention.label}</span>
                            <button
                              type="button"
                              onClick={() => removeMention(mention.id)}
                              className="text-[var(--muted)] transition hover:text-[var(--text)]"
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                      </PromptInputHeader>
                    ) : null}

                    <PromptInputBody>
                      <PromptInputTextarea
                        ref={textareaRef}
                        value={input}
                        placeholder="Ask the agent to plan, summarize, rewrite, or break down work..."
                        onChange={(event) => {
                          setInput(event.currentTarget.value)
                          setCursorIndex(
                            event.currentTarget.selectionStart ?? event.currentTarget.value.length
                          )
                        }}
                        onClick={(event) => setCursorIndex(event.currentTarget.selectionStart ?? 0)}
                        onKeyUp={(event) => setCursorIndex(event.currentTarget.selectionStart ?? 0)}
                      />
                    </PromptInputBody>
                    <PromptInputFooter>
                      <PromptInputTools>
                        <PromptInputButton
                          onClick={() => {
                            const nextValue = `${input}${input.endsWith(' ') || input.length === 0 ? '' : ' '}@`
                            setInput(nextValue)
                            requestAnimationFrame(() => {
                              textareaRef.current?.focus()
                              const nextCursor = nextValue.length
                              textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
                              setCursorIndex(nextCursor)
                            })
                          }}
                        >
                          <AtSign size={14} />
                          <span>Mention context</span>
                        </PromptInputButton>
                        <div className="text-xs text-[var(--muted)]">
                          Attach notes or projects with{' '}
                          <span className="font-semibold text-[var(--text)]">@</span>
                        </div>
                      </PromptInputTools>
                      <PromptInputSubmit
                        status={isSending ? 'streaming' : 'ready'}
                        disabled={!input.trim()}
                      />
                    </PromptInputFooter>
                  </PromptInput>
                </div>
              </div>
            </div>
          )}
        </DocumentWorkspaceMainContent>
      </DocumentWorkspaceMain>

      <DocumentWorkspacePanel style={{ ['--workspace-pane-width' as string]: '340px' }}>
        <DocumentWorkspacePanelHeader
          leading={
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Chats</p>
              <p className="text-xs text-[var(--muted)]">Manage sessions and attached context</p>
            </div>
          }
          actions={
            <WorkspaceHeaderActions>
              <WorkspaceHeaderActionGroup>
                <button
                  type="button"
                  onClick={() => {
                    void createSession()
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <MessageSquarePlus size={14} />
                  <span>New chat</span>
                </button>
              </WorkspaceHeaderActionGroup>
            </WorkspaceHeaderActions>
          }
        />
        <DocumentWorkspacePanelContent className="space-y-5 p-4">
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <WorkspacePanelSectionHeader
              className="mb-3"
              icon={<Bot size={16} aria-hidden="true" />}
              heading="Chat cards"
              description="Select the conversation you want to continue"
            />
            {isLoadingSessions ? (
              <p className="text-sm text-[var(--muted)]">Loading chats...</p>
            ) : sessions.length ? (
              <div className="space-y-2">
                {sessions.map((session) => {
                  const isActive = session.id === selectedSessionId
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedSessionId(session.id)}
                      className={cn(
                        'block w-full rounded-2xl border px-3 py-3 text-left transition',
                        isActive
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                          : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text)]">
                            {session.title}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--muted)]">
                            {session.messages.length} messages
                          </p>
                        </div>
                        {isActive ? (
                          <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-[11px] text-[var(--muted)]">
                        Updated {formatRelativeTime(session.updatedAt)}
                      </p>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">No saved chats yet.</p>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <WorkspacePanelSectionHeader
              className="mb-3"
              icon={<MessageSquarePlus size={16} aria-hidden="true" />}
              heading="Active chat"
              description="Details for the selected conversation"
            />
            {activeSession ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    Title
                  </div>
                  <p className="mt-1 text-sm font-medium text-[var(--text)]">
                    {activeSession.title}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                      Messages
                    </div>
                    <p className="mt-1 text-sm font-medium text-[var(--text)]">
                      {activeSession.messages.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                      Title mode
                    </div>
                    <p className="mt-1 text-sm font-medium capitalize text-[var(--text)]">
                      {activeSession.titleMode ?? 'auto'}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    Updated
                  </div>
                  <p className="mt-1 text-sm text-[var(--text)]">
                    {formatRelativeTime(activeSession.updatedAt)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Select or create a chat to see its details.</p>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <WorkspacePanelSectionHeader
              className="mb-3"
              icon={<AtSign size={16} aria-hidden="true" />}
              heading="Context added"
              description="Mentions attached to the current draft before sending"
            />
            {selectedMentions.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedMentions.map((mention) => (
                  <span
                    key={mention.id}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-xs text-[var(--text)]"
                  >
                    {mention.kind === 'note' ? <FileText size={13} /> : <FolderKanban size={13} />}
                    <span>{mention.label}</span>
                    <button
                      type="button"
                      onClick={() => removeMention(mention.id)}
                      className="text-[var(--muted)] transition hover:text-[var(--text)]"
                      title={`Remove ${mention.label}`}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel-2)] px-3 py-4 text-sm text-[var(--muted)]">
                No context attached yet. Use <span className="font-semibold text-[var(--text)]">@</span> in the composer or the mention button below the chat.
              </div>
            )}
          </section>
        </DocumentWorkspacePanelContent>
      </DocumentWorkspacePanel>
    </DocumentWorkspace>
  )
}
