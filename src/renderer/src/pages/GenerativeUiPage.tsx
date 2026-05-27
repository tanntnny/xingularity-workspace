import {
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes
} from 'react'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Database,
  Download,
  FileJson2,
  Files,
  Library,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Wand2
} from 'lucide-react'
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import katex from 'katex'
import {
  buildGenerativeUiCorrectionPrompt,
  buildGenerativeUiPrompt,
  GENERATIVE_UI_DOMAIN_PRESETS,
  extractGenerativeUiJsonFromText,
  GENERATIVE_UI_ARTIFACT_TYPES,
  GENERATIVE_UI_PROMPT_COMPONENT_TYPES,
  stringifyGenerativeUiArtifact,
  tryRepairGenerativeUiJson,
  validateGenerativeUiArtifactJson,
  type GenerativeUiArtifact,
  type GenerativeUiArtifactType,
  type GenerativeUiNode,
  type SavedGenerativeUiArtifact
} from '../../../shared/generativeUi'
import type { RendererVaultApi } from '../../../shared/types'
import { cn } from '../lib/utils'
import { generativeUiSampleArtifacts } from '../lib/generativeUiSamples'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../components/ui/breadcrumb'
import {
  DocumentWorkspace,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainContent,
  DocumentWorkspaceMainHeader,
  DocumentWorkspacePanel,
  DocumentWorkspacePanelContent,
  DocumentWorkspacePanelHeader,
  WorkspaceActionButton
} from '../components/ui/document-workspace'
import { TabMenu, TabMenuItem } from '../components/ui/tab-menu'
import {
  WorkspacePanelSection,
  WorkspacePanelSectionHeader
} from '../components/ui/workspace-panel-section'
import { Badge } from '../components/ui/badge'
import { Button as UiButton } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table'
import type { NativeMenuItemDescriptor } from '../../../shared/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuDestructiveItem,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '../components/ui/context-menu'
import { canUseNativeMenus, getMouseMenuPosition, showNativeMenu } from '../lib/nativeMenu'

type GenerativeUiTab = 'prompt' | 'editor' | 'preview'
type GenerativeUiStatus = 'Draft' | 'Valid' | 'Invalid' | 'Saved'
type PushToast = (type: 'success' | 'error' | 'info', message: string) => void

interface GenerativeUiPageProps {
  vaultApi: RendererVaultApi
  pushToast: PushToast
}

const navItems: Array<{ tab: GenerativeUiTab; label: string; icon: ReactElement }> = [
  { tab: 'prompt', label: 'Prompt', icon: <Sparkles className="h-4 w-4" /> },
  { tab: 'editor', label: 'Paste', icon: <FileJson2 className="h-4 w-4" /> },
  { tab: 'preview', label: 'Preview', icon: <Database className="h-4 w-4" /> }
]

export function GenerativeUiPage({ vaultApi, pushToast }: GenerativeUiPageProps): ReactElement {
  const [tab, setTab] = useState<GenerativeUiTab>('prompt')
  const [tabActions, setTabActions] = useState<ReactNode>(null)
  const [editorText, setEditorText] = useState(() =>
    stringifyGenerativeUiArtifact(generativeUiSampleArtifacts[0])
  )
  const [currentArtifact, setCurrentArtifact] = useState<GenerativeUiArtifact | null>(
    generativeUiSampleArtifacts[0]
  )
  const [currentSavedId, setCurrentSavedId] = useState<string | undefined>()
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [savedArtifacts, setSavedArtifacts] = useState<SavedGenerativeUiArtifact[]>([])
  const [, setStatus] = useState<GenerativeUiStatus>('Draft')

  const openArtifact = useCallback((artifact: GenerativeUiArtifact, savedId?: string): void => {
    setTab('preview')
    setEditorText(stringifyGenerativeUiArtifact(artifact))
    setCurrentArtifact(artifact)
    setCurrentSavedId(savedId)
    setValidationErrors([])
    setStatus(savedId ? 'Saved' : 'Valid')
  }, [])

  const refreshSavedArtifacts = useCallback(async (): Promise<void> => {
    try {
      setSavedArtifacts(await vaultApi.generativeUi.listArtifacts())
    } catch (error) {
      pushToast('error', String(error))
    }
  }, [pushToast, vaultApi])

  useEffect(() => {
    void refreshSavedArtifacts()
  }, [refreshSavedArtifacts])

  const handleArtifactSaved = useCallback(
    (saved: SavedGenerativeUiArtifact): void => {
      setSavedArtifacts((current) => upsertSavedArtifact(current, saved))
      openArtifact(saved.artifact, saved.id)
    },
    [openArtifact]
  )

  const handleArtifactDeleted = useCallback(
    (id: string): void => {
      setSavedArtifacts((current) => current.filter((item) => item.id !== id))
      if (currentSavedId === id) {
        setCurrentSavedId(undefined)
        setStatus(currentArtifact ? 'Valid' : 'Draft')
      }
    },
    [currentArtifact, currentSavedId]
  )

  const startNewSession = useCallback((): void => {
    const draftArtifact = generativeUiSampleArtifacts[0]
    setTab('prompt')
    setEditorText(stringifyGenerativeUiArtifact(draftArtifact))
    setCurrentArtifact(draftArtifact)
    setCurrentSavedId(undefined)
    setValidationErrors([])
    setStatus('Draft')
  }, [])

  return (
    <ReactFlowProvider>
      <DocumentWorkspace className="bg-transparent">
        <DocumentWorkspaceMain>
          <DocumentWorkspaceMainHeader
            breadcrumb={
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <span className="text-[var(--muted)]">Automation</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Generative UI</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            }
            actions={tabActions}
          />

          <DocumentWorkspaceMainContent className="overflow-y-auto">
            <div className="workspace-clear-surface flex h-full min-h-0 flex-col gap-3 px-8 py-5 text-[var(--text)]">
              <TabMenu
                variant="inline-accent"
                className="project-tab-menu"
                value={tab}
                onValueChange={(value) => setTab(value as GenerativeUiTab)}
              >
                {navItems.map((item) => (
                  <TabMenuItem
                    key={item.tab}
                    variant="inline-accent"
                    className="project-tab-menu-item"
                    value={item.tab}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {item.icon}
                      {item.label}
                    </span>
                  </TabMenuItem>
                ))}
              </TabMenu>

              <section className="min-h-0 min-w-0 flex-1 pb-6">
                {tab === 'prompt' ? <PromptBuilderPage setHeaderActions={setTabActions} /> : null}
                {tab === 'editor' ? (
                  <ArtifactEditorPage
                    editorText={editorText}
                    setEditorText={(text) => {
                      setEditorText(text)
                      setStatus('Draft')
                    }}
                    setCurrentArtifact={setCurrentArtifact}
                    validationErrors={validationErrors}
                    setValidationErrors={setValidationErrors}
                    setStatus={setStatus}
                    pushToast={pushToast}
                    setHeaderActions={setTabActions}
                  />
                ) : null}
                {tab === 'preview' ? (
                  <ArtifactPreviewPage
                    vaultApi={vaultApi}
                    pushToast={pushToast}
                    editorText={editorText}
                    currentArtifact={currentArtifact}
                    currentSavedId={currentSavedId}
                    onArtifactSaved={handleArtifactSaved}
                    setHeaderActions={setTabActions}
                  />
                ) : null}
              </section>
            </div>
          </DocumentWorkspaceMainContent>
        </DocumentWorkspaceMain>
        <GenerativeUiSidebar
          vaultApi={vaultApi}
          pushToast={pushToast}
          savedArtifacts={savedArtifacts}
          currentSavedId={currentSavedId}
          openArtifact={openArtifact}
          onStartNewSession={startNewSession}
          onArtifactSaved={handleArtifactSaved}
          onArtifactDeleted={handleArtifactDeleted}
        />
      </DocumentWorkspace>
    </ReactFlowProvider>
  )
}

function PromptBuilderPage({
  setHeaderActions
}: {
  setHeaderActions: (actions: ReactNode) => void
}): ReactElement {
  const [artifactType, setArtifactType] = useState<GenerativeUiArtifactType>('Study UI')
  const [domainPresetId, setDomainPresetId] = useState<string>('general')
  const [topic, setTopic] = useState(
    'Design an interactive artifact explaining a complex concept clearly.'
  )
  const [allowedComponents, setAllowedComponents] = useState<string[]>([
    ...GENERATIVE_UI_PROMPT_COMPONENT_TYPES
  ])
  const [copied, setCopied] = useState(false)
  const selectedDomainPreset =
    GENERATIVE_UI_DOMAIN_PRESETS.find((preset) => preset.id === domainPresetId) ??
    GENERATIVE_UI_DOMAIN_PRESETS[0]
  const prompt = useMemo(
    () =>
      buildGenerativeUiPrompt({
        artifactType,
        allowedComponents,
        topic,
        domainPresetLabel: selectedDomainPreset.label
      }),
    [allowedComponents, artifactType, selectedDomainPreset.label, topic]
  )

  async function copyPrompt(): Promise<void> {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function reset(): void {
    setArtifactType('Study UI')
    setDomainPresetId('general')
    setTopic('Design an interactive artifact explaining a complex concept clearly.')
    setAllowedComponents([...GENERATIVE_UI_PROMPT_COMPONENT_TYPES])
  }

  function applyDomainPreset(presetId: string): void {
    const preset =
      GENERATIVE_UI_DOMAIN_PRESETS.find((currentPreset) => currentPreset.id === presetId) ??
      GENERATIVE_UI_DOMAIN_PRESETS[0]
    setDomainPresetId(preset.id)
    setAllowedComponents([...preset.components])
  }

  useEffect(() => {
    setHeaderActions(
      <>
        <WorkspaceActionButton
          icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          aria-label={copied ? 'Copied' : 'Copy prompt'}
          title={copied ? 'Copied' : 'Copy prompt'}
          onClick={() => void copyPrompt()}
        />
        <WorkspaceActionButton
          icon={<RotateCcw className="h-4 w-4" />}
          aria-label="Reset template"
          title="Reset template"
          onClick={reset}
        />
      </>
    )

    return () => setHeaderActions(null)
  }, [copied, setHeaderActions])

  return (
    <div className="flex flex-col gap-3">
      <Panel className={glassPanelClass}>
        <div>
          <h2 className="text-2xl font-bold text-[var(--text)]">Prompt Controls</h2>
          <p className="mt-1 text-[var(--muted)]">
            Configure the prompt inputs and allowed component set.
          </p>
        </div>

        <label className="mt-4 block text-sm font-semibold text-[var(--text)]">Topic or job</label>
        <textarea
          className={cn(inputClass, 'border border-[var(--line)]')}
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        />

        <label className="mt-4 block text-sm font-semibold text-[var(--text)]">Artifact type</label>
        <div className="relative mt-2">
          <select
            className="workspace-flat-input w-full appearance-none rounded-lg border border-[var(--line)] py-3 pl-3 pr-12 font-medium text-[var(--text)] outline-none"
            value={artifactType}
            onChange={(event) => setArtifactType(event.target.value as GenerativeUiArtifactType)}
          >
            {GENERATIVE_UI_ARTIFACT_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        </div>

        <label className="mt-4 block text-sm font-semibold text-[var(--text)]">Domain preset</label>
        <div className="relative mt-2">
          <select
            className="workspace-flat-input w-full appearance-none rounded-lg border border-[var(--line)] py-3 pl-3 pr-12 font-medium text-[var(--text)] outline-none"
            value={domainPresetId}
            onChange={(event) => applyDomainPreset(event.target.value)}
          >
            {GENERATIVE_UI_DOMAIN_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold text-[var(--text)]">Allowed components</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {GENERATIVE_UI_PROMPT_COMPONENT_TYPES.map((component) => {
              const checked = allowedComponents.includes(component)
              return (
                <label
                  key={component}
                  className="workspace-subtle-control flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2 pr-4 text-sm font-medium text-[var(--text)] transition hover:text-[var(--accent)]"
                >
                  <span className="truncate">{component}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setAllowedComponents((current) =>
                        checked
                          ? current.filter((item) => item !== component)
                          : [...current, component]
                      )
                    }
                  />
                </label>
              )
            })}
          </div>
        </div>

      </Panel>

      <section
        className={cn(
          glassPanelClass,
          'workspace-subtle-surface flex h-full flex-col rounded-lg border border-[var(--line)] p-4 text-[var(--text)] md:p-5'
        )}
      >
        <div className="mb-3">
          <h2 className="text-2xl font-bold text-[var(--text)]">Generated Prompt</h2>
          <p className="mt-1 text-[var(--muted)]">
            Review and copy the generated JSON prompt before sending it to a model.
          </p>
        </div>
        <textarea
          className="workspace-flat-input h-full min-h-[650px] w-full flex-1 resize-y rounded-lg border border-[var(--line)] p-4 font-mono text-sm leading-relaxed text-[var(--text)] outline-none"
          value={prompt}
          onChange={() => undefined}
          readOnly
        />
      </section>
    </div>
  )
}

function ArtifactEditorPage({
  editorText,
  setEditorText,
  setCurrentArtifact,
  validationErrors,
  setValidationErrors,
  setStatus,
  pushToast,
  setHeaderActions
}: {
  editorText: string
  setEditorText: (text: string) => void
  setCurrentArtifact: (artifact: GenerativeUiArtifact | null) => void
  validationErrors: string[]
  setValidationErrors: (errors: string[]) => void
  setStatus: (status: GenerativeUiStatus) => void
  pushToast: PushToast
  setHeaderActions: (actions: ReactNode) => void
}): ReactElement {
  function extract(): void {
    setEditorText(extractGenerativeUiJsonFromText(editorText).text)
  }

  function validate(): void {
    const result = validateGenerativeUiArtifactJson(editorText)
    if (result.ok) {
      setCurrentArtifact(result.artifact)
      setValidationErrors([])
      setStatus('Valid')
    } else {
      setCurrentArtifact(null)
      setValidationErrors(result.errors)
      setStatus('Invalid')
    }
  }

  async function copyCorrectionPrompt(): Promise<void> {
    await navigator.clipboard.writeText(
      buildGenerativeUiCorrectionPrompt(validationErrors.join('; '))
    )
    pushToast('success', 'Correction prompt copied')
  }

  useEffect(() => {
    setHeaderActions(
      <>
        <WorkspaceActionButton
          icon={<Code2 className="h-4 w-4" />}
          aria-label="Extract JSON"
          title="Extract JSON"
          onClick={extract}
        />
        <WorkspaceActionButton
          icon={<CheckCircle2 className="h-4 w-4" />}
          aria-label="Validate"
          title="Validate"
          active={validationErrors.length === 0}
          onClick={validate}
        />
        <WorkspaceActionButton
          icon={<Wand2 className="h-4 w-4" />}
          aria-label="Repair JSON"
          title="Repair JSON"
          onClick={() => setEditorText(tryRepairGenerativeUiJson(editorText).text)}
        />
      </>
    )

    return () => setHeaderActions(null)
  }, [editorText, setEditorText, setHeaderActions, validationErrors.length])

  return (
    <div className="flex min-h-full flex-col">
      <Panel className={cn('flex min-h-full w-full flex-col', editorGlassPanelClass)}>
        <div className="mb-3">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text)]">Paste & Validate</h2>
            <p className="text-[var(--muted)]">
              Paste raw chatbot text or a fenced JSON codeblock, then validate or repair it.
            </p>
          </div>
        </div>
        <JsonEditor value={editorText} onChange={setEditorText} />
        {validationErrors.length ? (
          <ValidationErrors
            errors={validationErrors}
            onCopyCorrectionPrompt={copyCorrectionPrompt}
          />
        ) : null}
      </Panel>
    </div>
  )
}

function ArtifactPreviewPage({
  vaultApi,
  pushToast,
  editorText,
  currentArtifact,
  currentSavedId,
  onArtifactSaved,
  setHeaderActions
}: {
  vaultApi: RendererVaultApi
  pushToast: PushToast
  editorText: string
  currentArtifact: GenerativeUiArtifact | null
  currentSavedId?: string
  onArtifactSaved: (saved: SavedGenerativeUiArtifact) => void
  setHeaderActions: (actions: ReactNode) => void
}): ReactElement {
  async function save(): Promise<void> {
    if (!currentArtifact) return
    const saved = await vaultApi.generativeUi.saveArtifact({
      artifact: currentArtifact,
      id: currentSavedId
    })
    onArtifactSaved(saved)
    pushToast('success', 'Generative UI artifact saved')
  }

  async function duplicate(): Promise<void> {
    if (!currentArtifact) return
    const saved = await vaultApi.generativeUi.saveArtifact({
      artifact: {
        ...currentArtifact,
        metadata: { ...currentArtifact.metadata, title: `${currentArtifact.metadata.title} Copy` }
      }
    })
    onArtifactSaved(saved)
    pushToast('success', 'Generative UI artifact duplicated')
  }

  async function copyJson(): Promise<void> {
    await navigator.clipboard.writeText(editorText)
    pushToast('success', 'Artifact JSON copied')
  }

  function exportJson(): void {
    const blob = new Blob([editorText], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${currentArtifact?.metadata.title ?? 'artifact'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!currentArtifact) {
      setHeaderActions(null)
      return
    }

    setHeaderActions(
      <>
        <WorkspaceActionButton
          icon={<Save className="h-4 w-4" />}
          aria-label="Save"
          title="Save"
          onClick={() => void save()}
        />
        <WorkspaceActionButton
          icon={<Files className="h-4 w-4" />}
          aria-label="Duplicate"
          title="Duplicate"
          onClick={() => void duplicate()}
        />
        <WorkspaceActionButton
          icon={<Download className="h-4 w-4" />}
          aria-label="Export JSON"
          title="Export JSON"
          onClick={exportJson}
        />
        <WorkspaceActionButton
          icon={<Copy className="h-4 w-4" />}
          aria-label="Copy JSON"
          title="Copy JSON"
          onClick={() => void copyJson()}
        />
      </>
    )

    return () => setHeaderActions(null)
  }, [currentArtifact, currentSavedId, editorText, setHeaderActions])

  if (!currentArtifact) {
    return (
      <Panel className="p-6 text-center">
        <h2 className="text-3xl font-bold text-[var(--text)]">No artifact selected</h2>
        <p className="mt-2 text-[var(--muted)]">Validate JSON or open a saved artifact first.</p>
      </Panel>
    )
  }

  return (
    <Panel>
      <div className="mb-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text)]">Preview</h2>
          <p className="mt-1 text-[var(--muted)]">
            Inspect the rendered artifact and save or export the current session.
          </p>
        </div>
      </div>
      <ArtifactRenderer artifact={currentArtifact} />
    </Panel>
  )
}

function GenerativeUiSidebar({
  vaultApi,
  pushToast,
  savedArtifacts,
  currentSavedId,
  openArtifact,
  onStartNewSession,
  onArtifactSaved,
  onArtifactDeleted
}: {
  vaultApi: RendererVaultApi
  pushToast: PushToast
  savedArtifacts: SavedGenerativeUiArtifact[]
  currentSavedId?: string
  openArtifact: (artifact: GenerativeUiArtifact, savedId?: string) => void
  onStartNewSession: () => void
  onArtifactSaved: (saved: SavedGenerativeUiArtifact) => void
  onArtifactDeleted: (id: string) => void
}): ReactElement {
  const useNativeMenus = canUseNativeMenus()
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([])
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
  const [, setContextDeleteIds] = useState<string[]>([])

  async function addSample(index: number): Promise<void> {
    const saved = await vaultApi.generativeUi.saveArtifact({
      artifact: generativeUiSampleArtifacts[index]
    })
    onArtifactSaved(saved)
    pushToast('success', 'Sample artifact added to this vault')
  }

  async function deleteArtifacts(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)]
    if (!uniqueIds.length) return

    await Promise.all(
      uniqueIds.map(async (id) => {
        await vaultApi.generativeUi.deleteArtifact(id)
        onArtifactDeleted(id)
      })
    )

    setSelectedArtifactIds((current) => current.filter((id) => !uniqueIds.includes(id)))
    if (selectionAnchorId && uniqueIds.includes(selectionAnchorId)) {
      setSelectionAnchorId(null)
    }
    pushToast(
      'success',
      uniqueIds.length === 1
        ? 'Generative UI artifact deleted'
        : `${uniqueIds.length} generative UI artifacts deleted`
    )
  }

  function requestDelete(ids: string[]): void {
    const uniqueIds = [...new Set(ids)]
    if (!uniqueIds.length) return
    const confirmed = window.confirm(
      uniqueIds.length > 1
        ? `Delete ${uniqueIds.length} selected sessions? This action cannot be undone.`
        : 'Delete this session? This action cannot be undone.'
    )
    if (!confirmed) return
    void deleteArtifacts(uniqueIds)
  }

  function getRangeSelection(targetId: string): string[] {
    const orderedIds = savedArtifacts.map((item) => item.id)
    const anchorId = selectionAnchorId ?? targetId
    const start = orderedIds.indexOf(anchorId)
    const end = orderedIds.indexOf(targetId)
    if (start === -1 || end === -1) return [targetId]
    const [from, to] = start < end ? [start, end] : [end, start]
    return orderedIds.slice(from, to + 1)
  }

  function resolveDeleteTargetIds(artifactId: string): string[] {
    return selectedArtifactIds.includes(artifactId) && selectedArtifactIds.length > 1
      ? selectedArtifactIds
      : [artifactId]
  }

  function handleArtifactClick(
    event: React.MouseEvent<HTMLButtonElement>,
    artifact: SavedGenerativeUiArtifact
  ): void {
    if (event.shiftKey) {
      setSelectedArtifactIds(getRangeSelection(artifact.id))
      return
    }

    if (event.metaKey || event.ctrlKey) {
      setSelectedArtifactIds((current) =>
        current.includes(artifact.id)
          ? current.filter((id) => id !== artifact.id)
          : [...current, artifact.id]
      )
      setSelectionAnchorId(artifact.id)
      return
    }

    setSelectedArtifactIds([artifact.id])
    setSelectionAnchorId(artifact.id)
    openArtifact(artifact.artifact, artifact.id)
  }

  function handleArtifactContextSelection(artifactId: string): string[] {
    const targetIds = resolveDeleteTargetIds(artifactId)
    setSelectedArtifactIds(targetIds)
    setSelectionAnchorId(artifactId)
    setContextDeleteIds(targetIds)
    return targetIds
  }

  async function handleNativeArtifactContextMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    artifactId: string
  ): Promise<void> {
    event.preventDefault()
    const targetIds = handleArtifactContextSelection(artifactId)
    const items: NativeMenuItemDescriptor[] = [
      {
        id: 'delete',
        label: targetIds.length > 1 ? `Delete ${targetIds.length} Sessions` : 'Delete',
        accelerator: 'Command+Backspace'
      }
    ]
    const actionId = await showNativeMenu(items, getMouseMenuPosition(event))
    if (actionId === 'delete') {
      requestDelete(targetIds)
    }
  }

  useEffect(() => {
    setSelectedArtifactIds((current) =>
      current.filter((id) => savedArtifacts.some((artifact) => artifact.id === id))
    )
    if (selectionAnchorId && !savedArtifacts.some((artifact) => artifact.id === selectionAnchorId)) {
      setSelectionAnchorId(null)
    }
  }, [savedArtifacts, selectionAnchorId])

  useEffect(() => {
    if (!selectedArtifactIds.length) return

    function handleKeyDown(event: KeyboardEvent): void {
      if (isEditableShortcutTarget(event.target)) return
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key !== 'Backspace' && event.key !== 'Delete') return
      event.preventDefault()
      requestDelete(selectedArtifactIds)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedArtifactIds])

  return (
    <DocumentWorkspacePanel>
      <DocumentWorkspacePanelHeader
        actions={
          <WorkspaceActionButton
            icon={<Plus size={15} aria-hidden="true" />}
            aria-label="New session"
            title="New session"
            onClick={onStartNewSession}
          />
        }
      />
      <DocumentWorkspacePanelContent className="p-3">
        <div className="space-y-4">
          <WorkspacePanelSection>
            <WorkspacePanelSectionHeader
              icon={<Save size={16} aria-hidden="true" />}
              heading="Artifact Sessions"
              description={`${savedArtifacts.length} saved in this vault`}
            />
            {savedArtifacts.length ? (
              <div className="space-y-2">
                {savedArtifacts.map((item) => {
                  const isActive = item.id === currentSavedId
                  const isSelected = selectedArtifactIds.includes(item.id)
                  const contextDeleteIds = resolveDeleteTargetIds(item.id)
                  const artifactButton = (
                    <button
                      type="button"
                      data-active={isSelected || isActive}
                      onClick={(event) => handleArtifactClick(event, item)}
                      onContextMenu={
                        useNativeMenus
                          ? (event) => void handleNativeArtifactContextMenu(event, item.id)
                          : () => {
                              handleArtifactContextSelection(item.id)
                            }
                      }
                      className="sidebar-menu-card right-panel-menu-card flex w-full flex-col gap-2 px-3 py-3 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text)]">
                            {item.artifact.metadata.title}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Created {formatArtifactCreatedAt(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  )

                  return useNativeMenus ? (
                    <div key={item.id}>{artifactButton}</div>
                  ) : (
                    <ContextMenu key={item.id}>
                      <ContextMenuTrigger asChild>{artifactButton}</ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuDestructiveItem
                          onClick={() =>
                            requestDelete(
                              contextDeleteIds.length ? contextDeleteIds : resolveDeleteTargetIds(item.id)
                            )
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {(contextDeleteIds.length ? contextDeleteIds : resolveDeleteTargetIds(item.id))
                            .length > 1
                            ? `Delete ${(contextDeleteIds.length
                                ? contextDeleteIds
                                : resolveDeleteTargetIds(item.id)
                              ).length} Sessions`
                            : 'Delete'}
                          <ContextMenuShortcut keys={['cmd', 'backspace']} />
                        </ContextMenuDestructiveItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })}
              </div>
            ) : (
              <div className="sidebar-menu-card right-panel-menu-card border-dashed px-3 py-4 text-sm text-[var(--muted)]">
                Save from Preview to create a persistent artifact session in this vault.
              </div>
            )}
          </WorkspacePanelSection>

          <WorkspacePanelSection>
            <WorkspacePanelSectionHeader
              icon={<Library size={16} aria-hidden="true" />}
              heading="Library"
              description="Add bundled sample artifacts into the current vault"
            />
            <div className="space-y-2">
              {generativeUiSampleArtifacts.map((artifact, index) => (
                <button
                  key={artifact.metadata.title}
                  type="button"
                  onClick={() => {
                    void addSample(index)
                  }}
                  className="sidebar-menu-card right-panel-menu-card flex-col items-start gap-1.5 px-3 py-3 text-left"
                >
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {artifact.metadata.title}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{artifact.metadata.description}</p>
                </button>
              ))}
            </div>
          </WorkspacePanelSection>
        </div>
      </DocumentWorkspacePanelContent>
    </DocumentWorkspacePanel>
  )
}

function ArtifactRenderer({ artifact }: { artifact: GenerativeUiArtifact }): ReactElement {
  return (
    <article
      className="generative-ui-preview workspace-subtle-surface rounded-lg p-4 text-[var(--text)]"
    >
      <div className="mb-4">
        <h2 className="text-3xl font-extrabold tracking-tight">{artifact.metadata.title}</h2>
        {artifact.metadata.description ? (
          <p className="mt-2 text-[var(--muted)]">{artifact.metadata.description}</p>
        ) : null}
        {artifact.metadata.tags?.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {artifact.metadata.tags.map((tag) => (
              <Badge key={tag} variant="neutral" className="font-mono text-[11px]">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <RenderNode node={artifact.layout} />
    </article>
  )
}

function upsertSavedArtifact(
  current: SavedGenerativeUiArtifact[],
  saved: SavedGenerativeUiArtifact
): SavedGenerativeUiArtifact[] {
  return [saved, ...current.filter((item) => item.id !== saved.id)].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  )
}

function formatArtifactCreatedAt(value: string): string {
  return new Date(value).toLocaleString()
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
  )
}

const previewCardClass =
  'rounded-lg border border-[color:color-mix(in_srgb,var(--line)_80%,transparent)] !bg-transparent [background:none] text-[var(--text)] shadow-none backdrop-blur-0'

const previewInsetClass =
  'workspace-subtle-control rounded-lg border border-[color:color-mix(in_srgb,var(--line)_82%,transparent)]'

const previewAxisColor = 'var(--line-strong)'
const previewSeriesPalette = [
  'var(--accent)',
  'var(--tag-1-line)',
  'var(--tag-2-line)',
  'var(--tag-4-line)',
  'var(--danger)',
  'var(--tag-5-line)',
  'var(--line-strong)'
] as const

function getPreviewSeriesColor(index: number): string {
  return previewSeriesPalette[index % previewSeriesPalette.length]
}

function PreviewCard({
  title,
  description,
  children,
  className,
  contentClassName
}: {
  title?: string
  description?: string
  children: ReactNode
  className?: string
  contentClassName?: string
}): ReactElement {
  return (
    <Card className={cn(previewCardClass, className)}>
      {title || description ? (
        <CardHeader className="space-y-1.5 p-4 pb-0">
          {title ? <CardTitle className="text-xl font-extrabold">{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(title || description ? 'p-4 pt-3' : 'p-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}

function RenderNode({ node }: { node: GenerativeUiNode }): ReactElement {
  switch (node.type) {
    case 'page':
      return (
        <div className="space-y-3">
          {node.children.map((child, index) => (
            <RenderNode key={index} node={child} />
          ))}
        </div>
      )
    case 'section':
      return (
        <PreviewCard
          title={node.title}
          description={node.description}
          className="!bg-transparent [background:none]"
          contentClassName="space-y-3"
        >
          <div className="space-y-3">
            {node.children.map((child, index) => (
              <RenderNode key={index} node={child} />
            ))}
          </div>
        </PreviewCard>
      )
    case 'text':
      return node.variant === 'heading' ? (
        <h3 className="text-2xl font-extrabold tracking-tight">{node.body}</h3>
      ) : (
        <p
          className={cn(
            'leading-relaxed',
            node.variant === 'muted' && 'text-[var(--muted)]',
            node.variant === 'caption' &&
              'text-sm font-bold uppercase tracking-[0.18em] text-[var(--muted)]'
          )}
        >
          {node.body}
        </p>
      )
    case 'callout':
      return <CalloutNode node={node} />
    case 'card':
      return (
        <PreviewCard title={node.title} contentClassName="space-y-3">
          {node.body ? <p className="leading-relaxed text-[var(--muted)]">{node.body}</p> : null}
          {node.children?.length ? (
            <div className="space-y-2">
              {node.children.map((child, index) => (
                <RenderNode key={index} node={child} />
              ))}
            </div>
          ) : null}
        </PreviewCard>
      )
    case 'grid':
      return (
        <div
          className={cn(
            'grid gap-3',
            (node.columns ?? 2) === 1 && 'grid-cols-1',
            (node.columns ?? 2) === 2 && 'md:grid-cols-2',
            (node.columns ?? 2) === 3 && 'md:grid-cols-3',
            (node.columns ?? 2) === 4 && 'md:grid-cols-4'
          )}
        >
          {node.children.map((child, index) => (
            <RenderNode key={index} node={child} />
          ))}
        </div>
      )
    case 'tabs':
      return <TabsNode node={node} />
    case 'accordion':
      return <AccordionNode node={node} />
    case 'table':
      return <TableNode node={node} />
    case 'chart':
      return <ChartNode node={node} />
    case 'quiz':
      return <QuizNode node={node} />
    case 'timeline':
      return <TimelineNode node={node} />
    case 'flowDiagram':
      return <FlowDiagramNode node={node} />
    case 'sliderSimulator':
      return <SliderSimulatorNode node={node} />
    case 'formulaBlock':
      return <FormulaBlockNode node={node} />
    case 'formulaDerivation':
      return <FormulaDerivationNode node={node} />
    case 'signalPlot':
      return <SignalPlotNode node={node} />
    case 'stemPlot':
      return <StemPlotNode node={node} />
    case 'spectrumPlot':
      return <SpectrumPlotNode node={node} />
    case 'complexPlane':
      return <ComplexPlaneNode node={node} />
    case 'poleZeroPlot':
      return <PoleZeroPlotNode node={node} />
    case 'convolutionVisualizer':
      return <ConvolutionVisualizerNode node={node} />
    case 'transformPairCard':
      return <TransformPairCardNode node={node} />
    case 'confusionMatrix':
      return <ConfusionMatrixNode node={node} />
    case 'lossCurve':
      return <LossCurveNode node={node} />
    case 'decisionBoundary':
      return <DecisionBoundaryNode node={node} />
    case 'clusterPlot':
      return <ClusterPlotNode node={node} />
    case 'featureImportance':
      return <FeatureImportanceNode node={node} />
    case 'modelPipeline':
      return <ModelPipelineNode node={node} />
    case 'neuralNetworkDiagram':
      return <NeuralNetworkDiagramNode node={node} />
    case 'transformerBlockDiagram':
      return <TransformerBlockDiagramNode node={node} />
    case 'attentionMap':
      return <AttentionMapNode node={node} />
    case 'tokenFlow':
      return <TokenFlowNode node={node} />
    case 'embeddingPlot':
      return <EmbeddingPlotNode node={node} />
    case 'ragPipeline':
      return <RagPipelineNode node={node} />
    case 'agentWorkflow':
      return <AgentWorkflowNode node={node} />
    default:
      return <UnsupportedNode type={(node as { type?: string }).type ?? 'unknown'} />
  }
}

function UnsupportedNode({ type, message }: { type: string; message?: string }): ReactElement {
  return (
    <PreviewCard
      title="Unsupported component"
      className="border-[color:color-mix(in_srgb,var(--danger)_48%,var(--line))] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)]"
      contentClassName="space-y-2"
    >
      <p className="font-mono text-sm">{type}</p>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </PreviewCard>
  )
}

function CalloutNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'callout' }>
}): ReactElement {
  const tones = {
    info: 'border-[var(--tag-0-line)] bg-[var(--tag-0-bg)] text-[var(--tag-0-text)]',
    warning: 'border-[var(--tag-2-line)] bg-[var(--tag-2-bg)] text-[var(--tag-2-text)]',
    success: 'border-[var(--tag-1-line)] bg-[var(--tag-1-bg)] text-[var(--tag-1-text)]',
    danger: 'border-[color:color-mix(in_srgb,var(--danger)_48%,var(--line))] bg-[color:color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--text)]'
  }
  return (
    <div className={cn('h-full rounded-lg border p-4', tones[node.tone ?? 'info'])}>
      {node.title ? <p className="font-extrabold">{node.title}</p> : null}
      <p className="mt-1 leading-relaxed">{node.body}</p>
    </div>
  )
}

function TabsNode({ node }: { node: Extract<GenerativeUiNode, { type: 'tabs' }> }): ReactElement {
  const [active, setActive] = useState<string>(node.tabs[0]?.label ?? '')
  const activeTab = node.tabs.find((tab) => tab.label === active) ?? node.tabs[0]
  return (
    <PreviewCard contentClassName="space-y-3 p-3">
      <TabMenu
        variant="inline-accent"
        className="project-tab-menu"
        value={active}
        onValueChange={setActive}
      >
        {node.tabs.map((tab) => (
          <TabMenuItem
            key={tab.label}
            variant="inline-accent"
            className="project-tab-menu-item"
            value={tab.label}
          >
            {tab.label}
          </TabMenuItem>
        ))}
      </TabMenu>
      <div className="space-y-2">
        {activeTab?.children.map((child, index) => (
          <RenderNode key={index} node={child} />
        ))}
      </div>
    </PreviewCard>
  )
}

function AccordionNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'accordion' }>
}): ReactElement {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="space-y-2">
      {node.items.map((item, index) => (
        <div
          key={item.title}
          className={cn(previewCardClass, 'overflow-hidden')}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 pr-5 text-left font-extrabold text-[var(--text)]"
            onClick={() => setOpen(open === index ? null : index)}
          >
            {item.title}
            <span>{open === index ? '-' : '+'}</span>
          </button>
          {open === index ? (
            <div className="space-y-2 border-t border-[var(--line)] p-3">
              {item.children.map((child, childIndex) => (
                <RenderNode key={childIndex} node={child} />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function TableNode({ node }: { node: Extract<GenerativeUiNode, { type: 'table' }> }): ReactElement {
  return (
    <Card className={cn(previewCardClass, 'overflow-hidden p-0')}>
      <Table className="min-w-[520px]">
        <TableHeader>
          <TableRow>
            {node.columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {node.rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {node.columns.map((column) => (
                <TableCell key={column}>{String(row[column] ?? '')}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function ChartNode({ node }: { node: Extract<GenerativeUiNode, { type: 'chart' }> }): ReactElement {
  const values = node.data.map((item) => Number(item[node.yKey])).filter(Number.isFinite)
  const max = Math.max(...values, 1)
  const chartWidth = 620
  const chartHeight = 260
  const padding = 34
  const plotWidth = chartWidth - padding * 2
  const plotHeight = chartHeight - padding * 2
  const points = node.data.map((item, index) => {
    const value = Number(item[node.yKey])
    const x =
      padding +
      (node.data.length <= 1 ? plotWidth / 2 : (index / (node.data.length - 1)) * plotWidth)
    const y = padding + plotHeight - (Number.isFinite(value) ? value / max : 0) * plotHeight
    return { x, y, value, label: String(item[node.xKey] ?? '') }
  })
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPoints = `${padding},${padding + plotHeight} ${linePoints} ${padding + plotWidth},${padding + plotHeight}`
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1
  const pieSegments = node.data.reduce<Array<{ start: number; end: number; color: string }>>(
    (segments, item, index) => {
      const start = segments.at(-1)?.end ?? 0
      const value = Math.max(0, Number(item[node.yKey]) || 0)
      const end = start + (value / total) * Math.PI * 2
      return [...segments, { start, end, color: getPreviewSeriesColor(index) }]
    },
    []
  )

  return (
    <PreviewCard className="h-80">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full" role="img">
        {node.chartType === 'pie' ? (
          <>
            {pieSegments.map((segment, index) => {
              const pathData = describeArc(
                chartWidth / 2,
                chartHeight / 2,
                88,
                segment.start,
                segment.end
              )
              return <path key={index} d={pathData} fill={segment.color} />
            })}
          </>
        ) : (
          <>
            <line
              x1={padding}
              x2={padding}
              y1={padding}
              y2={padding + plotHeight}
              stroke={previewAxisColor}
            />
            <line
              x1={padding}
              x2={padding + plotWidth}
              y1={padding + plotHeight}
              y2={padding + plotHeight}
              stroke={previewAxisColor}
            />
            {node.chartType === 'bar'
              ? points.map((point, index) => {
                  const width = Math.max(18, plotWidth / Math.max(points.length, 1) - 16)
                  const height = padding + plotHeight - point.y
                  return (
                    <rect
                      key={index}
                      x={point.x - width / 2}
                      y={point.y}
                      width={width}
                      height={height}
                      rx={8}
                      fill={getPreviewSeriesColor(index)}
                    />
                  )
                })
              : null}
            {node.chartType === 'area' ? (
              <polygon points={areaPoints} fill={getPreviewSeriesColor(0)} opacity={0.22} />
            ) : null}
            {node.chartType === 'line' || node.chartType === 'area' ? (
              <polyline
                points={linePoints}
                fill="none"
                stroke={getPreviewSeriesColor(0)}
                strokeWidth={4}
                strokeLinecap="round"
              />
            ) : null}
            {points.map((point, index) => (
              <text
                key={index}
                x={point.x}
                y={chartHeight - 8}
                textAnchor="middle"
                className="text-[11px] font-bold fill-[var(--muted)]"
              >
                {point.label}
              </text>
            ))}
          </>
        )}
      </svg>
    </PreviewCard>
  )
}

function QuizNode({ node }: { node: Extract<GenerativeUiNode, { type: 'quiz' }> }): ReactElement {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  return (
    <div className="space-y-3">
      {node.questions.map((question, questionIndex) => {
        const selected = answers[questionIndex]
        const answered = selected !== undefined
        return (
          <PreviewCard key={question.question} title={question.question}>
            <div className="mt-3 grid gap-2">
              {question.choices.map((choice, choiceIndex) => (
                <UiButton
                  key={choice}
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setAnswers((current) => ({ ...current, [questionIndex]: choiceIndex }))
                  }
                  className={cn(
                    'h-auto justify-start whitespace-normal px-3 py-2 text-left font-bold',
                    selected === choiceIndex
                      ? choiceIndex === question.answerIndex
                        ? 'border-[var(--tag-1-line)] bg-[var(--tag-1-bg)] text-[var(--tag-1-text)]'
                        : 'border-[color:color-mix(in_srgb,var(--danger)_46%,var(--line))] bg-[color:color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--text)]'
                      : ''
                  )}
                >
                  {choice}
                </UiButton>
              ))}
            </div>
            {answered ? (
              <p className="mt-3 text-sm font-bold text-[var(--muted)]">
                {selected === question.answerIndex ? 'Correct. ' : 'Not quite. '}
                {question.explanation}
              </p>
            ) : null}
          </PreviewCard>
        )
      })}
    </div>
  )
}

function TimelineNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'timeline' }>
}): ReactElement {
  return (
    <div className="space-y-2">
      {node.items.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 text-[var(--text)]"
        >
          <div className="flex flex-col items-center">
            <span className="mt-1 h-3 w-3 rounded-lg bg-[var(--accent)]" />
            {index < node.items.length - 1 ? (
              <span className="mt-1 h-full min-h-10 w-px bg-[var(--line-strong)]" />
            ) : null}
          </div>
          <Card className={cn(previewCardClass, 'p-4')}>
            {item.date ? (
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                {item.date}
              </p>
            ) : null}
            <p className="font-extrabold">{item.title}</p>
            {item.description ? <p className="mt-1 text-[var(--muted)]">{item.description}</p> : null}
          </Card>
        </div>
      ))}
    </div>
  )
}

function FlowDiagramNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'flowDiagram' }>
}): ReactElement {
  const nodes: Node[] = node.nodes.map((flowNode, index) => ({
    id: flowNode.id,
    data: { label: flowNode.label },
    position: { x: (index % 3) * 220, y: Math.floor(index / 3) * 120 },
    style: {
      border: '1px solid var(--line)',
      borderRadius: 14,
      color: 'var(--text)',
      padding: 12,
      fontWeight: 800,
      background: 'color-mix(in srgb, var(--panel) 76%, transparent)'
    }
  }))
  const edges: Edge[] = node.edges.map((edge, index) => ({
    id: `${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 2, stroke: 'var(--line-strong)' }
  }))

  return (
    <PreviewCard>
      <div className={cn(previewInsetClass, 'h-80 overflow-hidden')}>
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background color={previewAxisColor} />
          <Controls />
        </ReactFlow>
      </div>
    </PreviewCard>
  )
}

function SliderSimulatorNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'sliderSimulator' }>
}): ReactElement {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(node.inputs.map((input) => [input.id, input.defaultValue]))
  )
  const outputs = useMemo(
    () =>
      node.outputs.map((output) => ({ ...output, value: evaluateFormula(output.formula, values) })),
    [node.outputs, values]
  )

  return (
    <PreviewCard title={node.title} description={node.description}>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          {node.inputs.map((input) => (
            <label key={input.id} className="block">
              <div className="mb-2 flex justify-between text-sm font-extrabold">
                <span>{input.label}</span>
                <span>{values[input.id]}</span>
              </div>
              <input
                className="w-full accent-[var(--accent)]"
                type="range"
                min={input.min}
                max={input.max}
                step={input.step}
                value={values[input.id]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [input.id]: Number(event.target.value) }))
                }
              />
            </label>
          ))}
        </div>
        <div className="grid gap-3">
          {outputs.map((output) => (
            <div
              key={output.label}
              className="rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] p-4 text-[var(--text)]"
            >
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {output.label}
              </p>
              <p className="mt-2 text-3xl font-extrabold">
                {output.value.ok ? formatNumber(output.value.value) : 'Formula'}
              </p>
              {!output.value.ok ? (
                <p className="mt-2 font-mono text-xs text-[var(--muted)]">{output.formula}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </PreviewCard>
  )
}

function FormulaBlockNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'formulaBlock' }>
}): ReactElement {
  return (
    <PreviewCard title={node.title}>
      <MathBlock expression={node.formula} />
      {node.description ? (
        <p className="mt-3 leading-relaxed text-[var(--muted)]">{node.description}</p>
      ) : null}
      {node.variables?.length ? (
        <Card className={cn(previewCardClass, 'mt-3 overflow-hidden p-0')}>
          <Table className="min-w-[360px]">
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Meaning</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {node.variables.map((variable) => (
                <TableRow key={variable.symbol}>
                  <TableCell className="font-mono font-bold">{variable.symbol}</TableCell>
                  <TableCell>{variable.meaning}</TableCell>
                  <TableCell className="text-[var(--muted)]">{variable.unit ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </PreviewCard>
  )
}

function FormulaDerivationNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'formulaDerivation' }>
}): ReactElement {
  return (
    <PreviewCard title={node.title}>
      <ol className="mt-3 space-y-3">
        {node.steps.map((step, index) => (
          <li key={`${step.expression}-${index}`} className={cn(previewInsetClass, 'p-3')}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-extrabold text-[var(--primary-foreground)]">
                {index + 1}
              </span>
              {step.label ? <p className="font-extrabold">{step.label}</p> : null}
            </div>
            <MathBlock expression={step.expression} compact />
            {step.explanation ? (
              <p className="mt-2 text-sm text-[var(--muted)]">{step.explanation}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </PreviewCard>
  )
}

function SignalPlotNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'signalPlot' }>
}): ReactElement {
  return (
    <PlotCard title={node.title} xLabel={node.xLabel} yLabel={node.yLabel}>
      <MiniPlot
        series={[
          {
            label: node.signalType === 'continuous' ? 'continuous signal' : 'discrete signal',
            points: node.data,
            mode: node.signalType === 'continuous' ? 'line' : 'stem',
            color: getPreviewSeriesColor(0)
          }
        ]}
      />
    </PlotCard>
  )
}

function StemPlotNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'stemPlot' }>
}): ReactElement {
  return (
    <PlotCard title={node.title} xLabel={node.nLabel ?? 'n'} yLabel={node.valueLabel ?? 'value'}>
      <MiniPlot
        series={[
          {
            label: 'sequence',
            points: node.data.map((point) => ({ x: point.n, y: point.value })),
            mode: 'stem',
            color: getPreviewSeriesColor(1)
          }
        ]}
      />
    </PlotCard>
  )
}

function SpectrumPlotNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'spectrumPlot' }>
}): ReactElement {
  const showMagnitude = node.showMagnitude ?? Boolean(node.magnitude?.length)
  const showPhase = node.showPhase ?? Boolean(node.phase?.length)
  return (
    <PreviewCard title={node.title}>
      <div className="mt-3 grid gap-3">
        {showMagnitude && node.magnitude?.length ? (
          <PlotCard title="Magnitude" xLabel={node.xLabel ?? node.domain} yLabel="|X|">
            <MiniPlot
              series={[
                {
                  label: 'magnitude',
                  points: node.magnitude.map((point) => ({ x: point.x, y: point.value })),
                  mode: 'line',
                  color: getPreviewSeriesColor(0)
                }
              ]}
            />
          </PlotCard>
        ) : null}
        {showPhase && node.phase?.length ? (
          <PlotCard title="Phase" xLabel={node.xLabel ?? node.domain} yLabel="angle">
            <MiniPlot
              series={[
                {
                  label: 'phase',
                  points: node.phase.map((point) => ({ x: point.x, y: point.value })),
                  mode: 'line',
                  color: getPreviewSeriesColor(2)
                }
              ]}
            />
          </PlotCard>
        ) : null}
        {!node.magnitude?.length && !node.phase?.length ? (
          <UnsupportedNode type={node.type} message="No magnitude or phase data was provided." />
        ) : null}
      </div>
    </PreviewCard>
  )
}

function ComplexPlaneNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'complexPlane' }>
}): ReactElement {
  return (
    <ComplexPlaneCard
      title={node.title}
      points={node.points}
      showUnitCircle={node.showUnitCircle}
      xRange={node.xRange}
      yRange={node.yRange}
    />
  )
}

function PoleZeroPlotNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'poleZeroPlot' }>
}): ReactElement {
  return (
    <PreviewCard>
      <ComplexPlaneSvg
        title={node.title}
        points={[
          ...node.zeros.map((zero) => ({ ...zero, kind: 'zero' as const })),
          ...node.poles.map((pole) => ({ ...pole, kind: 'pole' as const }))
        ]}
        showUnitCircle={node.showUnitCircle ?? true}
        xRange={node.xRange}
        yRange={node.yRange}
      />
      {node.stabilityNote ? (
        <p className={cn(previewInsetClass, 'mt-3 px-3 py-2 text-sm font-bold')}>
          {node.stabilityNote}
        </p>
      ) : null}
    </PreviewCard>
  )
}

function ConvolutionVisualizerNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'convolutionVisualizer' }>
}): ReactElement {
  const y = useMemo(() => node.y ?? computeConvolution(node.x, node.h), [node.h, node.x, node.y])
  const [activeIndex, setActiveIndex] = useState(0)
  const activeOutput = y[Math.min(activeIndex, Math.max(0, y.length - 1))]
  const contribution = activeOutput
    ? node.x.flatMap((xPoint) => {
        const hPoint = node.h.find((candidate) => candidate.n === activeOutput.n - xPoint.n)
        return hPoint ? [{ x: xPoint, h: hPoint, product: xPoint.value * hPoint.value }] : []
      })
    : []

  return (
    <PreviewCard title={node.title} description={node.explanation}>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <PlotCard title="x[n]">
          <MiniPlot
            series={[
              {
                label: 'x[n]',
                points: toPlotPoints(node.x),
                mode: 'stem',
                color: getPreviewSeriesColor(0)
              }
            ]}
          />
        </PlotCard>
        <PlotCard title="h[n]">
          <MiniPlot
            series={[
              {
                label: 'h[n]',
                points: toPlotPoints(node.h),
                mode: 'stem',
                color: getPreviewSeriesColor(1)
              }
            ]}
          />
        </PlotCard>
        <PlotCard title="y[n]">
          <MiniPlot
            series={[
              { label: 'y[n]', points: toPlotPoints(y), mode: 'stem', color: getPreviewSeriesColor(2) }
            ]}
          />
        </PlotCard>
      </div>
      {y.length ? (
        <div className={cn(previewInsetClass, 'mt-4 p-3')}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-extrabold">Current output n = {activeOutput?.n}</label>
            <input
              className="min-w-52 flex-1 accent-[var(--accent)]"
              type="range"
              min={0}
              max={Math.max(0, y.length - 1)}
              value={Math.min(activeIndex, y.length - 1)}
              onChange={(event) => setActiveIndex(Number(event.target.value))}
            />
            <span className="font-mono text-sm font-bold">
              y = {formatNumber(activeOutput?.value ?? 0)}
            </span>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Contributions:{' '}
            {contribution.length
              ? contribution
                  .map((item) => `x[${item.x.n}]h[${item.h.n}] = ${formatNumber(item.product)}`)
                  .join(' + ')
              : 'none'}
          </p>
        </div>
      ) : null}
    </PreviewCard>
  )
}

function TransformPairCardNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'transformPairCard' }>
}): ReactElement {
  return (
    <PreviewCard title={node.title}>
      <div className="mt-3 grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className={cn(previewInsetClass, 'p-4')}>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">
            {node.leftLabel ?? 'Time domain'}
          </p>
          <MathBlock expression={node.timeExpression} compact />
        </div>
        <div className="text-center text-3xl font-extrabold text-[var(--muted)]">-&gt;</div>
        <div className="rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] p-4 text-[var(--text)]">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">
            {node.rightLabel ?? 'Transform domain'}
          </p>
          <MathBlock expression={node.transformExpression} compact />
        </div>
      </div>
      {node.conditions ? (
        <p className="mt-3 text-sm font-bold text-[var(--text)]">Conditions: {node.conditions}</p>
      ) : null}
      {node.notes ? <p className="mt-1 text-sm text-[var(--muted)]">{node.notes}</p> : null}
    </PreviewCard>
  )
}

function ConfusionMatrixNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'confusionMatrix' }>
}): ReactElement {
  const rowTotals = node.matrix.map((row) => row.reduce((sum, value) => sum + value, 0) || 1)
  const max = Math.max(...node.matrix.flat(), 1)
  return (
    <PreviewCard title={node.title}>
      <div className="mt-3 overflow-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-1 text-center text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left text-[var(--muted)]">Actual / Predicted</th>
              {node.labels.map((label) => (
                <th key={label} className={cn(previewInsetClass, 'rounded-lg p-2 font-extrabold')}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {node.matrix.map((row, rowIndex) => (
              <tr key={node.labels[rowIndex] ?? rowIndex}>
                <th className={cn(previewInsetClass, 'rounded-lg p-2 text-left font-extrabold')}>
                  {node.labels[rowIndex] ?? rowIndex}
                </th>
                {row.map((value, columnIndex) => {
                  const ratio = node.normalize ? value / rowTotals[rowIndex] : value / max
                  return (
                    <td
                      key={columnIndex}
                      className="rounded-lg p-2 font-mono font-bold text-[var(--text)]"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--accent) ${12 + Math.min(78, ratio * 78)}%, var(--panel))`
                      }}
                    >
                      {node.normalize
                        ? `${Math.round((value / rowTotals[rowIndex]) * 100)}%`
                        : value}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {node.notes ? <p className="mt-3 text-sm text-[var(--muted)]">{node.notes}</p> : null}
    </PreviewCard>
  )
}

function LossCurveNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'lossCurve' }>
}): ReactElement {
  const series = [
    { key: 'trainLoss', label: 'Train loss', color: getPreviewSeriesColor(0) },
    { key: 'valLoss', label: 'Val loss', color: getPreviewSeriesColor(1) },
    { key: 'trainMetric', label: 'Train metric', color: getPreviewSeriesColor(2) },
    { key: 'valMetric', label: 'Val metric', color: getPreviewSeriesColor(3) }
  ].flatMap((config) => {
    const points = node.data.flatMap((item) => {
      const value = item[config.key as keyof (typeof node.data)[number]]
      return typeof value === 'number' ? [{ x: item.epoch, y: value }] : []
    })
    return points.length
      ? [{ label: config.label, points, mode: 'line' as const, color: config.color }]
      : []
  })

  return (
    <PlotCard title={node.title} xLabel={node.xLabel ?? 'epoch'} yLabel={node.yLabel ?? 'value'}>
      <MiniPlot series={series} showLegend />
    </PlotCard>
  )
}

function DecisionBoundaryNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'decisionBoundary' }>
}): ReactElement {
  return (
    <ScatterCard
      title={node.title}
      xLabel={node.xLabel}
      yLabel={node.yLabel}
      points={node.points}
      regions={node.regions}
    />
  )
}

function ClusterPlotNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'clusterPlot' }>
}): ReactElement {
  return (
    <ScatterCard
      title={node.title}
      xLabel={node.xLabel}
      yLabel={node.yLabel}
      points={node.points.map((point) => ({
        x: point.x,
        y: point.y,
        label: String(point.cluster ?? 'unassigned')
      }))}
      centroids={node.centroids?.map((centroid) => ({
        x: centroid.x,
        y: centroid.y,
        label: String(centroid.cluster ?? 'centroid')
      }))}
    />
  )
}

function FeatureImportanceNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'featureImportance' }>
}): ReactElement {
  const features = [...node.features].sort((a, b) => b.importance - a.importance)
  const max = Math.max(...features.map((feature) => feature.importance), 1)
  return (
    <PreviewCard title={node.title}>
      <div className="mt-3 space-y-3">
        {features.map((feature) => (
          <div key={feature.name}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="font-extrabold">{feature.name}</span>
              <span className="font-mono font-bold text-[var(--muted)]">
                {formatNumber(feature.importance)}
              </span>
            </div>
            <div className={cn(previewInsetClass, 'h-3 overflow-hidden rounded-lg p-0')}>
              <div
                className="h-full rounded-lg bg-[var(--accent)]"
                style={{ width: `${Math.max(3, (feature.importance / max) * 100)}%` }}
              />
            </div>
            {feature.description ? (
              <p className="mt-1 text-xs text-[var(--muted)]">{feature.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </PreviewCard>
  )
}

function ModelPipelineNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'modelPipeline' }>
}): ReactElement {
  return <WorkflowGraph title={node.title} stages={node.stages} edges={node.edges} />
}

function NeuralNetworkDiagramNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'neuralNetworkDiagram' }>
}): ReactElement {
  const width = 680
  const height = 260
  const layerGap = width / Math.max(1, node.layers.length + 1)
  return (
    <PreviewCard title={node.title}>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-72 w-full">
        {node.layers.map((layer, layerIndex) => {
          const x = layerGap * (layerIndex + 1)
          const units = Math.max(1, Math.min(layer.units ?? 4, 8))
          const yGap = height / (units + 1)
          return (
            <g key={layer.id}>
              {Array.from({ length: units }).map((_, unitIndex) => (
                <circle
                  key={unitIndex}
                  cx={x}
                  cy={yGap * (unitIndex + 1)}
                  r={10}
                  fill="var(--panel)"
                  stroke="var(--accent)"
                  strokeWidth={2}
                />
              ))}
              <text
                x={x}
                y={20}
                textAnchor="middle"
                className="text-[12px] font-bold fill-[var(--text)]"
              >
                {layer.label}
              </text>
              <text
                x={x}
                y={height - 8}
                textAnchor="middle"
                className="text-[11px] fill-[var(--muted)]"
              >
                {layer.activation ?? ''}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="grid gap-2 md:grid-cols-3">
        {node.layers.map((layer) => (
          <div key={layer.id} className={cn(previewInsetClass, 'p-2 text-sm')}>
            <p className="font-extrabold">{layer.label}</p>
            <p className="text-[var(--muted)]">
              {layer.units ? `${layer.units} units` : 'units not specified'}
              {layer.activation ? ` - ${layer.activation}` : ''}
            </p>
            {layer.description ? (
              <p className="mt-1 text-xs text-[var(--muted)]">{layer.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </PreviewCard>
  )
}

function TransformerBlockDiagramNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'transformerBlockDiagram' }>
}): ReactElement {
  return (
    <PreviewCard title={node.title}>
      <div className="relative mt-3 grid gap-2">
        {node.blocks.map((block, index) => (
          <div
            key={`${block.label}-${index}`}
            className={cn(previewInsetClass, 'p-3')}
          >
            <p className="font-extrabold">{block.label}</p>
            {block.description ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{block.description}</p>
            ) : null}
          </div>
        ))}
        {node.showResiduals ? (
          <div className="rounded-lg border border-dashed border-[var(--line-strong)] p-3 text-center text-sm font-bold text-[var(--muted)]">
            Residual connections wrap attention and feed-forward sublayers.
          </div>
        ) : null}
      </div>
      {node.notes ? <p className="mt-3 text-sm text-[var(--muted)]">{node.notes}</p> : null}
    </PreviewCard>
  )
}

function AttentionMapNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'attentionMap' }>
}): ReactElement {
  const max = Math.max(...node.weights.flat(), 1)
  return (
    <PreviewCard title={node.title}>
      {node.headLabel ? (
        <p className="mt-1 text-sm font-bold text-[var(--muted)]">{node.headLabel}</p>
      ) : null}
      <div className="mt-3 overflow-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-1 text-center text-xs">
          <thead>
            <tr>
              <th />
              {node.tokens.map((token) => (
                <th key={token} className={cn(previewInsetClass, 'rounded p-2 font-bold')}>
                  {token}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {node.weights.map((row, rowIndex) => (
              <tr key={node.tokens[rowIndex] ?? rowIndex}>
                <th className={cn(previewInsetClass, 'rounded p-2 text-left font-bold')}>
                  {node.tokens[rowIndex]}
                </th>
                {row.map((weight, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="rounded p-2 font-mono font-bold"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--tag-4-line) ${8 + Math.min(84, (weight / max) * 84)}%, var(--panel))`
                    }}
                    title={`${node.tokens[rowIndex]} -> ${node.tokens[columnIndex]}: ${weight}`}
                  >
                    {formatNumber(weight)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {node.notes ? <p className="mt-3 text-sm text-[var(--muted)]">{node.notes}</p> : null}
    </PreviewCard>
  )
}

function TokenFlowNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'tokenFlow' }>
}): ReactElement {
  return (
    <PreviewCard title={node.title}>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {node.steps.map((step, index) => (
          <div key={`${step.label}-${index}`} className={cn(previewInsetClass, 'p-3')}>
            <p className="font-extrabold">
              {index + 1}. {step.label}
            </p>
            {step.description ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{step.description}</p>
            ) : null}
            {step.tokens?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {step.tokens.map((token) => (
                  <Badge key={token} variant="outline" className="font-mono text-[11px]">
                    {token}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </PreviewCard>
  )
}

function EmbeddingPlotNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'embeddingPlot' }>
}): ReactElement {
  return (
    <div>
      <ScatterCard
        title={node.title}
        xLabel={node.xLabel}
        yLabel={node.yLabel}
        points={node.points}
        labelPoints
      />
      {node.notes ? <p className="-mt-3 px-4 pb-4 text-sm text-[var(--muted)]">{node.notes}</p> : null}
    </div>
  )
}

function RagPipelineNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'ragPipeline' }>
}): ReactElement {
  return (
    <WorkflowGraph title={node.title} stages={node.stages} edges={node.edges} notes={node.notes} />
  )
}

function AgentWorkflowNode({
  node
}: {
  node: Extract<GenerativeUiNode, { type: 'agentWorkflow' }>
}): ReactElement {
  const stages = node.steps.map((step) => {
    const agent = node.agents?.find((candidate) => candidate.id === step.agentId)
    return {
      id: step.id,
      label: step.label,
      description: agent
        ? `${agent.name}${agent.role ? ` (${agent.role})` : ''}${step.description ? `: ${step.description}` : ''}`
        : step.description
    }
  })
  return <WorkflowGraph title={node.title} stages={stages} edges={node.edges} notes={node.notes} />
}

type PlotPoint = { x: number; y: number; label?: string }
type SequencePoint = { n: number; value: number }
type MiniPlotSeries = {
  label: string
  points: PlotPoint[]
  mode: 'line' | 'stem' | 'scatter'
  color: string
}

function MathBlock({
  expression,
  compact = false,
  inverted = false
}: {
  expression: string
  compact?: boolean
  inverted?: boolean
}): ReactElement {
  let html: string | null = null
  try {
    html = katex.renderToString(expression, {
      displayMode: !compact,
      throwOnError: false,
      strict: false,
      trust: false
    })
  } catch {
    html = null
  }

  return (
    <div
      className={cn(
        'overflow-auto rounded-lg border p-3 font-mono text-sm font-bold',
        compact ? 'mt-0' : 'mt-3',
        inverted
          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
          : previewInsetClass
      )}
    >
      {html ? (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span className="whitespace-pre-wrap">{expression}</span>
      )}
    </div>
  )
}

function PlotCard({
  title,
  xLabel,
  yLabel,
  children
}: {
  title?: string
  xLabel?: string
  yLabel?: string
  children: ReactNode
}): ReactElement {
  return (
    <PreviewCard title={title}>
      <div className="mt-2">{children}</div>
      {xLabel || yLabel ? (
        <div className="mt-2 flex justify-between gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          <span>{xLabel ?? ''}</span>
          <span>{yLabel ?? ''}</span>
        </div>
      ) : null}
    </PreviewCard>
  )
}

function MiniPlot({
  series,
  showLegend = false
}: {
  series: MiniPlotSeries[]
  showLegend?: boolean
}): ReactElement {
  const allPoints = series.flatMap((item) => item.points)
  const width = 620
  const height = 260
  const padding = 34
  const xValues = allPoints.map((point) => point.x)
  const yValues = allPoints.flatMap((point) => [point.y, 0])
  const [minX, maxX] = expandRange(Math.min(...xValues, 0), Math.max(...xValues, 1))
  const [minY, maxY] = expandRange(Math.min(...yValues, -1), Math.max(...yValues, 1))
  const plotWidth = width - padding * 2
  const plotHeight = height - padding * 2
  const xScale = (value: number): number => padding + ((value - minX) / (maxX - minX)) * plotWidth
  const yScale = (value: number): number =>
    padding + plotHeight - ((value - minY) / (maxY - minY)) * plotHeight
  const zeroY = yScale(0)

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full" role="img">
        <line x1={padding} x2={padding + plotWidth} y1={zeroY} y2={zeroY} stroke={previewAxisColor} />
        <line x1={padding} x2={padding} y1={padding} y2={padding + plotHeight} stroke={previewAxisColor} />
        {series.map((item) => {
          const points = item.points.map((point) => ({
            ...point,
            sx: xScale(point.x),
            sy: yScale(point.y)
          }))
          const linePoints = points.map((point) => `${point.sx},${point.sy}`).join(' ')
          return (
            <g key={item.label}>
              {item.mode === 'line' ? (
                <polyline
                  points={linePoints}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {item.mode === 'stem'
                ? points.map((point, index) => (
                    <line
                      key={`stem-${index}`}
                      x1={point.sx}
                      x2={point.sx}
                      y1={zeroY}
                      y2={point.sy}
                      stroke={item.color}
                      strokeWidth={2}
                    />
                  ))
                : null}
              {points.map((point, index) => (
                <circle key={index} cx={point.sx} cy={point.sy} r={4} fill={item.color} />
              ))}
            </g>
          )
        })}
      </svg>
      {showLegend ? (
        <div className="flex flex-wrap gap-2">
          {series.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--muted)]"
            >
              <span className="h-2.5 w-2.5 rounded-lg" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ComplexPlaneCard({
  title,
  points,
  showUnitCircle,
  xRange,
  yRange
}: {
  title?: string
  points: Array<{ label?: string; re: number; im: number; kind?: 'point' | 'vector' | 'root' }>
  showUnitCircle?: boolean
  xRange?: [number, number]
  yRange?: [number, number]
}): ReactElement {
  return (
    <PreviewCard>
      <ComplexPlaneSvg
        title={title}
        points={points.map((point) => ({ ...point, kind: point.kind ?? 'point' }))}
        showUnitCircle={showUnitCircle}
        xRange={xRange}
        yRange={yRange}
      />
    </PreviewCard>
  )
}

function ComplexPlaneSvg({
  title,
  points,
  showUnitCircle,
  xRange,
  yRange
}: {
  title?: string
  points: Array<{
    label?: string
    re: number
    im: number
    kind?: 'point' | 'vector' | 'root' | 'zero' | 'pole'
  }>
  showUnitCircle?: boolean
  xRange?: [number, number]
  yRange?: [number, number]
}): ReactElement {
  const width = 420
  const height = 320
  const padding = 32
  const autoX = expandRange(
    Math.min(-1, ...points.map((point) => point.re)),
    Math.max(1, ...points.map((point) => point.re))
  )
  const autoY = expandRange(
    Math.min(-1, ...points.map((point) => point.im)),
    Math.max(1, ...points.map((point) => point.im))
  )
  const [minX, maxX] = xRange ?? autoX
  const [minY, maxY] = yRange ?? autoY
  const plotWidth = width - padding * 2
  const plotHeight = height - padding * 2
  const xScale = (value: number): number => padding + ((value - minX) / (maxX - minX)) * plotWidth
  const yScale = (value: number): number =>
    padding + plotHeight - ((value - minY) / (maxY - minY)) * plotHeight
  const originX = xScale(0)
  const originY = yScale(0)
  const unitRadius = Math.abs(xScale(1) - xScale(0))

  return (
    <div>
      {title ? <h3 className="text-xl font-extrabold">{title}</h3> : null}
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-80 w-full" role="img">
        <line x1={padding} x2={padding + plotWidth} y1={originY} y2={originY} stroke={previewAxisColor} />
        <line x1={originX} x2={originX} y1={padding} y2={padding + plotHeight} stroke={previewAxisColor} />
        {showUnitCircle ? (
          <circle
            cx={originX}
            cy={originY}
            r={unitRadius}
            fill="none"
            stroke={previewAxisColor}
            strokeDasharray="5 5"
          />
        ) : null}
        {points.map((point, index) => {
          const x = xScale(point.re)
          const y = yScale(point.im)
          const color =
            point.kind === 'pole'
              ? 'var(--danger)'
              : point.kind === 'zero'
                ? getPreviewSeriesColor(0)
                : 'var(--text)'
          return (
            <g key={`${point.label ?? point.kind}-${index}`}>
              {point.kind === 'vector' ? (
                <line x1={originX} x2={x} y1={originY} y2={y} stroke={color} strokeWidth={2.5} />
              ) : null}
              {point.kind === 'pole' ? (
                <>
                  <line
                    x1={x - 7}
                    x2={x + 7}
                    y1={y - 7}
                    y2={y + 7}
                    stroke={color}
                    strokeWidth={3}
                  />
                  <line
                    x1={x + 7}
                    x2={x - 7}
                    y1={y - 7}
                    y2={y + 7}
                    stroke={color}
                    strokeWidth={3}
                  />
                </>
              ) : (
                <circle
                  cx={x}
                  cy={y}
                  r={point.kind === 'zero' ? 8 : 5}
                  fill={point.kind === 'zero' ? 'var(--panel)' : color}
                  stroke={color}
                  strokeWidth={point.kind === 'zero' ? 3 : 1}
                />
              )}
              {point.label ? (
                <text x={x + 8} y={y - 8} className="text-[11px] font-bold fill-[var(--muted)]">
                  {point.label}
                </text>
              ) : null}
            </g>
          )
        })}
        <text x={padding + plotWidth - 10} y={originY - 6} className="text-[11px] fill-[var(--muted)]">
          Re
        </text>
        <text x={originX + 6} y={padding + 12} className="text-[11px] fill-[var(--muted)]">
          Im
        </text>
      </svg>
    </div>
  )
}

function ScatterCard({
  title,
  xLabel,
  yLabel,
  points,
  regions,
  centroids,
  labelPoints = false
}: {
  title?: string
  xLabel?: string
  yLabel?: string
  points: Array<{ x: number; y: number; label: string }>
  regions?: Array<{ label: string; colorHint?: string; polygon: Array<{ x: number; y: number }> }>
  centroids?: Array<{ x: number; y: number; label: string }>
  labelPoints?: boolean
}): ReactElement {
  const width = 620
  const height = 320
  const padding = 36
  const allPoints = [
    ...points,
    ...(centroids ?? []),
    ...(regions ?? []).flatMap((region) => region.polygon)
  ]
  const [minX, maxX] = expandRange(
    Math.min(...allPoints.map((point) => point.x), -1),
    Math.max(...allPoints.map((point) => point.x), 1)
  )
  const [minY, maxY] = expandRange(
    Math.min(...allPoints.map((point) => point.y), -1),
    Math.max(...allPoints.map((point) => point.y), 1)
  )
  const plotWidth = width - padding * 2
  const plotHeight = height - padding * 2
  const xScale = (value: number): number => padding + ((value - minX) / (maxX - minX)) * plotWidth
  const yScale = (value: number): number =>
    padding + plotHeight - ((value - minY) / (maxY - minY)) * plotHeight

  return (
    <PreviewCard title={title}>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-80 w-full" role="img">
        <line
          x1={padding}
          x2={padding + plotWidth}
          y1={padding + plotHeight}
          y2={padding + plotHeight}
          stroke={previewAxisColor}
        />
        <line x1={padding} x2={padding} y1={padding} y2={padding + plotHeight} stroke={previewAxisColor} />
        {regions?.map((region, index) => (
          <polygon
            key={region.label}
            points={region.polygon
              .map((point) => `${xScale(point.x)},${yScale(point.y)}`)
              .join(' ')}
            fill={colorForKey(region.colorHint ?? region.label, index)}
            opacity={0.16}
            stroke={colorForKey(region.colorHint ?? region.label, index)}
          />
        ))}
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle
              cx={xScale(point.x)}
              cy={yScale(point.y)}
              r={5}
              fill={colorForKey(point.label, index)}
            />
            {labelPoints ? (
              <text
                x={xScale(point.x) + 7}
                y={yScale(point.y) - 6}
                className="text-[11px] font-bold fill-[var(--muted)]"
              >
                {point.label}
              </text>
            ) : null}
          </g>
        ))}
        {centroids?.map((point, index) => (
          <g key={`centroid-${point.label}-${index}`}>
            <path
              d={`M ${xScale(point.x)} ${yScale(point.y) - 9} L ${xScale(point.x) + 9} ${yScale(point.y)} L ${xScale(point.x)} ${yScale(point.y) + 9} L ${xScale(point.x) - 9} ${yScale(point.y)} Z`}
              fill={colorForKey(point.label, index)}
              stroke="var(--text)"
              strokeWidth={1.5}
            />
          </g>
        ))}
      </svg>
      {xLabel || yLabel ? (
        <div className="flex justify-between text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          <span>{xLabel ?? ''}</span>
          <span>{yLabel ?? ''}</span>
        </div>
      ) : null}
    </PreviewCard>
  )
}

function WorkflowGraph({
  title,
  stages,
  edges,
  notes
}: {
  title?: string
  stages: Array<{ id: string; label: string; description?: string; kind?: string }>
  edges?: Array<{ source: string; target: string; label?: string }>
  notes?: string
}): ReactElement {
  const graphEdges: Array<{ source: string; target: string; label?: string }> =
    edges ?? stages.slice(1).map((stage, index) => ({ source: stages[index].id, target: stage.id }))
  const flowNodes: Node[] = stages.map((stage, index) => ({
    id: stage.id,
    data: {
      label: (
        <div className="max-w-44 text-left">
          <p className="font-extrabold">{stage.label}</p>
          {stage.description ? (
            <p className="mt-1 text-xs text-[var(--muted)]">{stage.description}</p>
          ) : null}
        </div>
      )
    },
    position: { x: (index % 4) * 220, y: Math.floor(index / 4) * 140 },
    style: {
      border: '1px solid var(--line)',
      borderRadius: 14,
      color: 'var(--text)',
      padding: 10,
      background: 'color-mix(in srgb, var(--panel) 76%, transparent)'
    }
  }))
  const flowEdges: Edge[] = graphEdges.map((edge, index) => ({
    id: `${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    markerEnd: { type: MarkerType.ArrowClosed }
  }))

  return (
    <PreviewCard title={title}>
      <div className={cn(previewInsetClass, 'mt-3 h-96 overflow-hidden')}>
        <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
          <Background color={previewAxisColor} />
          <Controls />
        </ReactFlow>
      </div>
      {notes ? <p className="mt-3 text-sm text-[var(--muted)]">{notes}</p> : null}
    </PreviewCard>
  )
}

function toPlotPoints(points: SequencePoint[]): PlotPoint[] {
  return points.map((point) => ({ x: point.n, y: point.value }))
}

function computeConvolution(x: SequencePoint[], h: SequencePoint[]): SequencePoint[] {
  const output = new Map<number, number>()
  x.forEach((xPoint) => {
    h.forEach((hPoint) => {
      const n = xPoint.n + hPoint.n
      output.set(n, (output.get(n) ?? 0) + xPoint.value * hPoint.value)
    })
  })
  return [...output.entries()].map(([n, value]) => ({ n, value })).sort((a, b) => a.n - b.n)
}

function expandRange(min: number, max: number): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1]
  if (min === max) return [min - 1, max + 1]
  const padding = (max - min) * 0.08
  return [min - padding, max + padding]
}

function colorForKey(key: string, index = 0): string {
  const palette = [...previewSeriesPalette]
  const lower = key.toLowerCase()
  const direct: Record<string, string> = {
    blue: 'var(--accent)',
    green: 'var(--tag-1-line)',
    orange: 'var(--tag-2-line)',
    purple: 'var(--tag-4-line)',
    red: 'var(--danger)',
    gray: 'var(--line-strong)',
    slate: 'var(--line-strong)'
  }
  if (direct[lower]) return direct[lower]
  let hash = index
  for (let i = 0; i < key.length; i += 1) hash += key.charCodeAt(i)
  return palette[Math.abs(hash) % palette.length]
}

function JsonEditor({
  value,
  onChange
}: {
  value: string
  onChange: (value: string) => void
}): ReactElement {
  const [scroll, setScroll] = useState({ left: 0, top: 0 })

  return (
    <div
      className={cn(
        'workspace-flat-input relative min-h-[420px] flex-1 overflow-hidden rounded-lg border border-[var(--line)] font-mono text-sm leading-relaxed',
        editorGlassPanelClass
      )}
    >
      <pre
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-4 text-sm leading-relaxed"
      >
        <code
          className="block"
          style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}
        >
          {renderJsonHighlight(value)}
        </code>
      </pre>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) =>
          setScroll({
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop
          })
        }
        spellCheck={false}
        wrap="off"
        className="relative z-10 min-h-[420px] w-full resize-y overflow-auto whitespace-pre rounded-lg bg-transparent p-4 font-mono text-sm leading-relaxed text-transparent caret-[var(--accent)] outline-none selection:bg-[var(--accent-soft)]"
      />
    </div>
  )
}

function renderJsonHighlight(value: string): ReactNode[] {
  const pattern =
    /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}[\],:]|\s+|./g
  const tokens = [...value.matchAll(pattern)]

  return tokens.map((match, index) => {
    const token = match[0]
    if (/^\s+$/.test(token)) return token
    const tokenEnd = (match.index ?? 0) + token.length
    const isKey = token.startsWith('"') && /^\s*:/.test(value.slice(tokenEnd))
    const className = getJsonTokenClass(token, isKey)
    return (
      <span key={`${token}-${index}`} className={className}>
        {token}
      </span>
    )
  })
}

function getJsonTokenClass(token: string, isKey: boolean): string {
  if (isKey) {
    return 'text-[color-mix(in_srgb,var(--accent)_88%,var(--text))]'
  }
  if (token.startsWith('"')) return 'text-emerald-600 dark:text-emerald-300'
  if (/^-?\d/.test(token)) return 'text-amber-600 dark:text-amber-300'
  if (token === 'true' || token === 'false') return 'text-sky-600 dark:text-sky-300'
  if (token === 'null') return 'text-[var(--muted)]'
  if (/^[{}[\],:]$/.test(token)) return 'text-[var(--muted)]'
  return 'text-[var(--text)]'
}

function ValidationErrors({
  errors,
  onCopyCorrectionPrompt
}: {
  errors: string[]
  onCopyCorrectionPrompt: () => void
}): ReactElement {
  return (
    <div className="mt-3 rounded-lg border border-[var(--danger)]/40 bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] p-4 text-[var(--text)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-[var(--danger)]">Validation errors</p>
        <Button onClick={onCopyCorrectionPrompt}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Correction Prompt
        </Button>
      </div>
      <ul className="mt-3 space-y-2 font-mono text-sm">
        {errors.map((error) => (
          <li key={error} className="whitespace-pre-wrap break-words">
            {error}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Button({
  className,
  variant = 'secondary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
}): ReactElement {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'border border-[var(--accent-line)] bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_86%,var(--text))]',
        variant === 'secondary' &&
          'workspace-subtle-control border text-[var(--text)] hover:text-[var(--accent)]',
        variant === 'danger' &&
          'border border-[var(--danger)] bg-[var(--danger)] text-white hover:opacity-90',
        className
      )}
      {...props}
    />
  )
}

function Panel({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return (
    <section
      className={cn(
        'workspace-subtle-surface rounded-lg p-4',
        className
      )}
    >
      {children}
    </section>
  )
}

const glassPanelClass =
  'rounded-lg border-[color:color-mix(in_srgb,var(--line)_78%,transparent)]'

const editorGlassPanelClass =
  'rounded-lg border-[color:color-mix(in_srgb,var(--line)_74%,transparent)]'

const inputClass =
  'workspace-flat-input mt-2 w-full rounded-lg p-3 font-medium text-[var(--text)] outline-none'

type Token = number | string
const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }

function evaluateFormula(
  formula: string,
  values: Record<string, number>
): { ok: true; value: number } | { ok: false } {
  if (!/^[A-Za-z0-9_+\-*/^().\s]+$/.test(formula)) return { ok: false }
  const tokens = tokenize(formula)
  if (!tokens) return { ok: false }
  const rpn = toRpn(tokens)
  if (!rpn) return { ok: false }
  const value = evalRpn(rpn, values)
  return Number.isFinite(value) ? { ok: true, value } : { ok: false }
}

function tokenize(formula: string): Token[] | null {
  const matches = formula.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[+\-*/^()]/g)
  if (!matches) return null
  return matches.map((match) => (/^\d/.test(match) ? Number(match) : match))
}

function toRpn(tokens: Token[]): Token[] | null {
  const output: Token[] = []
  const operators: string[] = []

  for (const token of tokens) {
    if (typeof token === 'number' || /^[A-Za-z_]/.test(token)) {
      output.push(token)
    } else if (token in precedence) {
      while (
        operators.length &&
        operators[operators.length - 1] in precedence &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        output.push(operators.pop()!)
      }
      operators.push(token)
    } else if (token === '(') {
      operators.push(token)
    } else if (token === ')') {
      while (operators.length && operators[operators.length - 1] !== '(')
        output.push(operators.pop()!)
      if (operators.pop() !== '(') return null
    }
  }

  while (operators.length) {
    const operator = operators.pop()!
    if (operator === '(') return null
    output.push(operator)
  }

  return output
}

function evalRpn(tokens: Token[], values: Record<string, number>): number {
  const stack: number[] = []
  for (const token of tokens) {
    if (typeof token === 'number') {
      stack.push(token)
    } else if (token in precedence) {
      const right = stack.pop()
      const left = stack.pop()
      if (left === undefined || right === undefined) return Number.NaN
      if (token === '+') stack.push(left + right)
      if (token === '-') stack.push(left - right)
      if (token === '*') stack.push(left * right)
      if (token === '/') stack.push(left / right)
      if (token === '^') stack.push(left ** right)
    } else {
      stack.push(values[token] ?? Number.NaN)
    }
  }
  return stack.length === 1 ? stack[0] : Number.NaN
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = {
    x: centerX + radius * Math.cos(startAngle),
    y: centerY + radius * Math.sin(startAngle)
  }
  const end = {
    x: centerX + radius * Math.cos(endAngle),
    y: centerY + radius * Math.sin(endAngle)
  }
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    'Z'
  ].join(' ')
}
