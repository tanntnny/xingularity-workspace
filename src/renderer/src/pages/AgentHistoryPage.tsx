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
} from '../components/ui/icons'
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
  WorkspaceIconButton,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionDivider,
  WorkspaceHeaderActionGroup
} from '../components/ui/document-workspace'
import { WorkspacePanelSectionHeader } from '../components/ui/workspace-panel-section'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useStaggeredScrollReveal } from '../hooks/useStaggeredScrollReveal'
import { cn } from '../lib/utils'

interface AgentHistoryPageProps {
  vaultApi: RendererVaultApi | undefined
  pushToast: (kind: 'info' | 'error' | 'success', message: string) => void
  notes: NoteListItem[]
  projects: Project[]
  isRightPanelCollapsed?: boolean
  onToggleRightPanel: () => void
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

function stepStatusTone(status: AgentChatToolStep['status']): {
  badgeClass: string
  label: string
  icon: ReactElement
} {
  switch (status) {
    case 'error':
      return {
        badgeClass: 'bg-rose-500/10 text-rose-500',
        label: 'Error',
        icon: <span className="h-2.5 w-2.5 rounded-lg bg-rose-500" />
      }
    case 'approval-required':
      return {
        badgeClass: 'bg-accent text-muted-foreground',
        label: 'Needs approval',
        icon: <span className="h-2.5 w-2.5 rounded-lg bg-accent0" />
      }
    case 'rejected':
      return {
        badgeClass: 'bg-muted text-muted-foreground',
        label: 'Rejected',
        icon: <span className="h-2.5 w-2.5 rounded-lg bg-muted" />
      }
    default:
      return {
        badgeClass: 'bg-accent text-primary',
        label: 'Completed',
        icon: <CheckCircle2 size={14} className="text-primary" />
      }
  }
}

export function AgentHistoryPage({
  vaultApi,
  pushToast,
  notes,
  projects,
  isRightPanelCollapsed = false,
  onToggleRightPanel
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
  const panelRevealItemIds = useMemo(
    () => [
      'agent-chat-cards-section',
      ...sessions.map((session) => `agent-session:${session.id}`),
      'agent-active-chat-section',
      ...(activeSession
        ? [
            'agent-active-title',
            'agent-active-messages',
            'agent-active-title-mode',
            'agent-active-updated'
          ]
        : ['agent-active-empty']),
      'agent-context-section',
      ...(selectedMentions.length
        ? selectedMentions.map((mention) => `agent-mention:${mention.id}`)
        : ['agent-context-empty'])
    ],
    [activeSession, selectedMentions, sessions]
  )
  const { containerRef: panelRevealRef, getRevealItemProps } = useStaggeredScrollReveal(
    panelRevealItemIds,
    {
      resetKey: panelRevealItemIds.join('|')
    }
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
              toolSteps: message.toolSteps?.map((step) =>
                step.id === stepId ? result.toolStep : step
              )
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
            toolSteps: message.toolSteps?.map(
              (step): AgentChatToolStep =>
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
    <DocumentWorkspace
      panelCollapsed={isRightPanelCollapsed}
      onTogglePanel={onToggleRightPanel}
      style={{ ['--workspace-pane-width' as string]: '340px' }}
    >
      <DocumentWorkspaceMain>
        <DocumentWorkspaceMainHeader
          breadcrumb={
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Agent Chat</p>
              {isRenaming && activeSession ? (
                <Input
                  ref={renameInputRef}
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.currentTarget.value)}
                  onBlur={() => {
                    void saveRename()
                  }}
                  onKeyDown={handleRenameKeyDown}
                  className="border border-input bg-card text-foreground mt-1 w-full max-w-[360px] rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground"
                />
              ) : (
                <p className="truncate text-sm font-semibold text-foreground">{headerTitle}</p>
              )}
            </div>
          }
          actions={
            <WorkspaceHeaderActions>
              <WorkspaceHeaderActionGroup>
                <WorkspaceIconButton
                  onClick={() => {
                    if (!activeSession) {
                      return
                    }
                    setRenameDraft(activeSession.title)
                    setIsRenaming(true)
                  }}
                  disabled={!activeSession}
                  icon={<Pencil size={14} />}
                  label="Rename"
                />
              </WorkspaceHeaderActionGroup>
              <WorkspaceHeaderActionDivider />
              <WorkspaceHeaderActionGroup>
                <WorkspaceIconButton
                  onClick={handleDeleteActiveSession}
                  disabled={!activeSession}
                  icon={<Trash2 size={14} />}
                  label="Delete chat"
                />
              </WorkspaceHeaderActionGroup>
            </WorkspaceHeaderActions>
          }
        />
        <DocumentWorkspaceMainContent className="min-h-0">
          {!vaultApi ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Agent chat is only available inside the desktop app.
            </div>
          ) : (
            <div className="bg-transparent flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 px-5 pt-5">
                <Conversation className="border bg-card text-card-foreground rounded-lg shadow-sm">
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
                                      className="border bg-card text-card-foreground rounded-lg p-4 shadow-sm"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                          {tone.icon}
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-foreground">
                                              Step {index + 1}: {step.toolName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Agent tool activity
                                            </p>
                                          </div>
                                        </div>
                                        <span
                                          className={cn(
                                            'rounded-lg px-2.5 py-1 text-xs uppercase tracking-wide',
                                            tone.badgeClass
                                          )}
                                        >
                                          {tone.label}
                                        </span>
                                      </div>
                                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <div>
                                          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                                            Input
                                          </div>
                                          <pre className="border bg-card text-card-foreground overflow-x-auto whitespace-pre-wrap rounded-lg px-3 py-2 text-xs text-muted-foreground">
                                            {step.inputSummary}
                                          </pre>
                                        </div>
                                        <div>
                                          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                                            Output
                                          </div>
                                          <pre className="border bg-card text-card-foreground overflow-x-auto whitespace-pre-wrap rounded-lg px-3 py-2 text-xs text-muted-foreground">
                                            {step.outputSummary}
                                          </pre>
                                        </div>
                                      </div>
                                      {step.status === 'approval-required' &&
                                      step.approvalRequest ? (
                                        <div className="mt-3 flex items-center gap-2">
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => {
                                              void approveToolStep(
                                                step.id,
                                                step.approvalRequest!.toolName,
                                                step.approvalRequest!.input
                                              )
                                            }}
                                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                                          >
                                            Approve and run
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              void rejectToolStep(step.id)
                                            }}
                                          >
                                            Reject
                                          </Button>
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
                                    ? 'border border-input bg-card text-foreground'
                                    : 'border-primary/20 bg-accent'
                                )}
                              >
                                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                                  <span>{isAssistant ? 'Agent' : 'You'}</span>
                                  <span>{formatRelativeTime(message.createdAt)}</span>
                                  {message.model ? <span>{message.model}</span> : null}
                                </div>
                                {isAssistant ? (
                                  <MessageResponse>{message.content}</MessageResponse>
                                ) : (
                                  <div className="whitespace-pre-wrap text-sm text-foreground">
                                    {message.content}
                                  </div>
                                )}
                                {message.contexts?.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {message.contexts.map((context) => (
                                      <span
                                        key={context.id}
                                        className="border border-input bg-card text-foreground inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground"
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
                                        className="border border-input bg-card text-foreground inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground"
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
                    <div className="absolute bottom-[calc(100%+12px)] left-0 right-0 z-10 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
                      <div className="border-b border-border px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                        Attach context
                      </div>
                      <div className="max-h-72 overflow-y-auto p-3">
                        {filteredSuggestions.map((suggestion) => (
                          <Button
                            key={suggestion.id}
                            type="button"
                            variant="ghost"
                            onClick={() => insertMention(suggestion)}
                            className="h-auto w-full items-start justify-start gap-3 px-3 py-3 text-left"
                          >
                            <div className="mt-0.5 text-muted-foreground">
                              {suggestion.kind === 'note' ? (
                                <FileText size={15} />
                              ) : (
                                <FolderKanban size={15} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-foreground">
                                {suggestion.label}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {suggestion.detail}
                              </div>
                            </div>
                            <div className="rounded-lg border border-border px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                              {suggestion.kind}
                            </div>
                          </Button>
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
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground"
                          >
                            {mention.kind === 'note' ? (
                              <FileText size={13} />
                            ) : (
                              <FolderKanban size={13} />
                            )}
                            <span>{mention.label}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMention(mention.id)}
                              className="h-5 w-5 text-muted-foreground"
                              aria-label={`Remove ${mention.label}`}
                            >
                              <X size={13} />
                            </Button>
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
                        <div className="text-xs text-muted-foreground">
                          Attach notes or projects with{' '}
                          <span className="font-semibold text-foreground">@</span>
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

      <DocumentWorkspacePanel className={isRightPanelCollapsed ? 'hidden' : 'flex'}>
        <DocumentWorkspacePanelHeader
          leading={
            <div>
              <p className="text-sm font-semibold text-foreground">Chats</p>
              <p className="text-xs text-muted-foreground">Manage sessions and attached context</p>
            </div>
          }
          actions={
            <WorkspaceHeaderActions>
              <WorkspaceHeaderActionGroup>
                <WorkspaceIconButton
                  onClick={() => {
                    void createSession()
                  }}
                  icon={<MessageSquarePlus size={14} />}
                  label="New chat"
                />
              </WorkspaceHeaderActionGroup>
            </WorkspaceHeaderActions>
          }
        />
        <DocumentWorkspacePanelContent ref={panelRevealRef} className="space-y-5 p-4">
          {(() => {
            const revealProps = getRevealItemProps('agent-chat-cards-section')
            return (
              <section
                ref={revealProps.ref}
                style={revealProps.style}
                className={`${revealProps.className} rounded-lg border bg-card text-card-foreground flex-col p-4`}
              >
                <WorkspacePanelSectionHeader
                  className="mb-3"
                  icon={<Bot size={16} aria-hidden="true" />}
                  iconContainerClassName="bg-accent text-primary"
                  heading="Chat cards"
                  description="Select the conversation you want to continue"
                />
                {isLoadingSessions ? (
                  <p className="text-sm text-muted-foreground">Loading chats...</p>
                ) : sessions.length ? (
                  <div className="space-y-2">
                    {sessions.map((session) => {
                      const isActive = session.id === selectedSessionId
                      const sessionRevealProps = getRevealItemProps(`agent-session:${session.id}`)
                      return (
                        <Button
                          key={session.id}
                          ref={sessionRevealProps.ref}
                          style={sessionRevealProps.style}
                          type="button"
                          variant={isActive ? 'secondary' : 'ghost'}
                          onClick={() => setSelectedSessionId(session.id)}
                          data-active={isActive}
                          className={cn(
                            sessionRevealProps.className,
                            'rounded-lg border bg-card text-card-foreground h-auto w-full justify-start px-3 py-3 text-left'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {session.title}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {session.messages.length} messages
                              </p>
                            </div>
                            {isActive ? (
                              <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs uppercase tracking-wide text-primary">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Updated {formatRelativeTime(session.updatedAt)}
                          </p>
                        </Button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No saved chats yet.</p>
                )}
              </section>
            )
          })()}

          {(() => {
            const revealProps = getRevealItemProps('agent-active-chat-section')
            return (
              <section
                ref={revealProps.ref}
                style={revealProps.style}
                className={`${revealProps.className} rounded-lg border bg-card text-card-foreground flex-col p-4`}
              >
                <WorkspacePanelSectionHeader
                  className="mb-3"
                  icon={<MessageSquarePlus size={16} aria-hidden="true" />}
                  iconContainerClassName="bg-accent text-primary"
                  heading="Active chat"
                  description="Details for the selected conversation"
                />
                {activeSession ? (
                  <div className="space-y-3">
                    {(() => {
                      const titleRevealProps = getRevealItemProps('agent-active-title')
                      return (
                        <div
                          ref={titleRevealProps.ref}
                          style={titleRevealProps.style}
                          className={titleRevealProps.className}
                        >
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Title
                          </div>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {activeSession.title}
                          </p>
                        </div>
                      )
                    })()}
                    <div className="grid grid-cols-2 gap-3">
                      {(() => {
                        const messageRevealProps = getRevealItemProps('agent-active-messages')
                        return (
                          <div
                            ref={messageRevealProps.ref}
                            style={messageRevealProps.style}
                            className={`${messageRevealProps.className} rounded-lg border bg-card text-card-foreground flex-col p-3`}
                          >
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              Messages
                            </div>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {activeSession.messages.length}
                            </p>
                          </div>
                        )
                      })()}
                      {(() => {
                        const modeRevealProps = getRevealItemProps('agent-active-title-mode')
                        return (
                          <div
                            ref={modeRevealProps.ref}
                            style={modeRevealProps.style}
                            className={`${modeRevealProps.className} rounded-lg border bg-card text-card-foreground flex-col p-3`}
                          >
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              Title mode
                            </div>
                            <p className="mt-1 text-sm font-medium capitalize text-foreground">
                              {activeSession.titleMode ?? 'auto'}
                            </p>
                          </div>
                        )
                      })()}
                    </div>
                    {(() => {
                      const updatedRevealProps = getRevealItemProps('agent-active-updated')
                      return (
                        <div
                          ref={updatedRevealProps.ref}
                          style={updatedRevealProps.style}
                          className={`${updatedRevealProps.className} rounded-lg border bg-card text-card-foreground flex-col p-3`}
                        >
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Updated
                          </div>
                          <p className="mt-1 text-sm text-foreground">
                            {formatRelativeTime(activeSession.updatedAt)}
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <p
                    ref={getRevealItemProps('agent-active-empty').ref}
                    className={`${getRevealItemProps('agent-active-empty').className} text-sm text-muted-foreground`}
                  >
                    Select or create a chat to see its details.
                  </p>
                )}
              </section>
            )
          })()}

          {(() => {
            const revealProps = getRevealItemProps('agent-context-section')
            return (
              <section
                ref={revealProps.ref}
                style={revealProps.style}
                className={`${revealProps.className} rounded-lg border bg-card text-card-foreground flex-col p-4`}
              >
                <WorkspacePanelSectionHeader
                  className="mb-3"
                  icon={<AtSign size={16} aria-hidden="true" />}
                  iconContainerClassName="bg-accent text-muted-foreground"
                  heading="Context added"
                  description="Mentions attached to the current draft before sending"
                />
                {selectedMentions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedMentions.map((mention) => {
                      const mentionRevealProps = getRevealItemProps(`agent-mention:${mention.id}`)
                      return (
                        <span
                          key={mention.id}
                          ref={mentionRevealProps.ref}
                          style={mentionRevealProps.style}
                          className={`${mentionRevealProps.className} border border-input bg-card text-foreground inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground`}
                        >
                          {mention.kind === 'note' ? (
                            <FileText size={13} />
                          ) : (
                            <FolderKanban size={13} />
                          )}
                          <span>{mention.label}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMention(mention.id)}
                            className="h-5 w-5 text-muted-foreground"
                            title={`Remove ${mention.label}`}
                            aria-label={`Remove ${mention.label}`}
                          >
                            <X size={13} />
                          </Button>
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <div
                    ref={getRevealItemProps('agent-context-empty').ref}
                    className={`${getRevealItemProps('agent-context-empty').className} rounded-lg border bg-card text-card-foreground border-dashed px-3 py-4 text-sm text-muted-foreground`}
                  >
                    No context attached yet. Use{' '}
                    <span className="font-semibold text-foreground">@</span> in the composer or the
                    mention button below the chat.
                  </div>
                )}
              </section>
            )
          })()}
        </DocumentWorkspacePanelContent>
      </DocumentWorkspacePanel>
    </DocumentWorkspace>
  )
}
