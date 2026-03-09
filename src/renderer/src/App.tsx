import { ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import {
  Pencil,
  Eye,
  Share2,
  Heart,
  Trash2,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from 'lucide-react'
import {
  CalendarTask,
  Project,
  ProjectIconStyle,
  ProjectMilestone,
  ProjectSubtask,
  RendererVaultApi,
  TaskPriority
} from '../../shared/types'
import {
  createRandomProjectIcon,
  PROJECT_ICON_COLORS,
  PROJECT_ICON_SHAPES,
  PROJECT_ICON_VARIANTS
} from '../../shared/projectIcons'
import { replaceNoteBody, splitNoteContent } from '../../shared/noteContent'
import { normalizeMentionTarget } from '../../shared/noteMentions'
import {
  listTagsFromMarkdown,
  normalizeTag,
  upsertTagsInMarkdown,
  generateProjectTag
} from '../../shared/noteTags'
import { CalendarMonthView } from './components/CalendarMonthView'
import { UnscheduledTaskList } from './components/UnscheduledTaskList'
import { CommandPalette } from './components/CommandPalette'
import { NoteShapeIcon } from './components/NoteShapeIcon'
import { NotePreviewList } from './components/NotePreviewList'
import { ProjectPreviewList } from './components/ProjectPreviewList'
import { SonnerBridge } from './components/SonnerBridge'
import { AppSidebar } from './components/AppSidebar'
import type { AppPage } from './components/AppSidebar'
import { TopBar } from './components/TopBar'
import { SidebarProvider, SidebarInset, SidebarTrigger } from './components/ui/sidebar'
import { EditorPage } from './pages/EditorPage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'
import { SearchPage } from './pages/SearchPage'
import { FontOption, SettingsPage } from './pages/SettingsPage'
import { useVaultStore } from './state/store'

const FONT_OPTIONS: FontOption[] = [
  {
    label: 'Iowan Serif',
    value: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif"
  },
  { label: 'Inter', value: "Inter, 'Segoe UI', sans-serif" },
  { label: 'Atkinson Hyperlegible', value: "'Atkinson Hyperlegible', 'Segoe UI', sans-serif" },
  { label: 'Source Sans', value: "'Source Sans 3', 'Gill Sans', 'Trebuchet MS', sans-serif" },
  {
    label: 'JetBrains Mono',
    value: "'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace"
  },
  { label: 'Charter', value: "'Charter', 'Georgia', 'Times New Roman', serif" }
]

const PROJECT_SEED: Project[] = [
  {
    id: 'project-client-portal',
    name: 'Client Portal Refresh',
    summary: 'Redesign the customer portal to improve onboarding and reduce support requests.',
    status: 'on-track',
    icon: createRandomProjectIcon('project-client-portal'),
    updatedAt: '2026-02-27T16:14:00.000Z',
    progress: 62,
    milestones: [
      {
        id: 'milestone-discovery',
        title: 'Discovery Interviews',
        dueDate: '2026-02-14',
        status: 'completed',
        subtasks: [
          {
            id: 'subtask-discovery-1',
            title: 'Interview 10 customers',
            completed: true,
            createdAt: '2026-02-02T09:00:00.000Z'
          },
          {
            id: 'subtask-discovery-2',
            title: 'Summarize key pain points',
            completed: true,
            createdAt: '2026-02-03T09:00:00.000Z'
          }
        ]
      },
      {
        id: 'milestone-wireframes',
        title: 'Approved Wireframes',
        dueDate: '2026-03-08',
        status: 'in-progress',
        subtasks: [
          {
            id: 'subtask-wireframes-1',
            title: 'Draft core page wireframes',
            completed: true,
            createdAt: '2026-02-20T09:00:00.000Z'
          },
          {
            id: 'subtask-wireframes-2',
            title: 'Run design review',
            completed: false,
            createdAt: '2026-02-24T09:00:00.000Z'
          }
        ]
      },
      {
        id: 'milestone-beta',
        title: 'Internal Beta Release',
        dueDate: '2026-03-26',
        status: 'pending',
        subtasks: []
      }
    ]
  },
  {
    id: 'project-mobile-sync',
    name: 'Mobile Sync Rollout',
    summary: 'Ship reliable offline sync for iOS and Android with conflict resolution.',
    status: 'at-risk',
    icon: createRandomProjectIcon('project-mobile-sync'),
    updatedAt: '2026-02-25T09:30:00.000Z',
    progress: 44,
    milestones: [
      {
        id: 'milestone-protocol',
        title: 'Finalize Sync Protocol',
        dueDate: '2026-02-20',
        status: 'completed',
        subtasks: [
          {
            id: 'subtask-protocol-1',
            title: 'Approve merge strategy',
            completed: true,
            createdAt: '2026-02-11T09:00:00.000Z'
          }
        ]
      },
      {
        id: 'milestone-load-tests',
        title: 'Conflict Load Tests',
        dueDate: '2026-03-05',
        status: 'blocked',
        subtasks: [
          {
            id: 'subtask-load-1',
            title: 'Prepare production-like dataset',
            completed: false,
            createdAt: '2026-02-22T09:00:00.000Z'
          }
        ]
      },
      {
        id: 'milestone-rollout',
        title: 'Public Rollout',
        dueDate: '2026-04-01',
        status: 'pending',
        subtasks: []
      }
    ]
  },
  {
    id: 'project-knowledge-base',
    name: 'Knowledge Base Revamp',
    summary: 'Migrate top support topics into guided help docs and in-app walkthroughs.',
    status: 'on-track',
    icon: createRandomProjectIcon('project-knowledge-base'),
    updatedAt: '2026-02-23T11:02:00.000Z',
    progress: 71,
    milestones: [
      {
        id: 'milestone-topic-map',
        title: 'Topic Prioritization Map',
        dueDate: '2026-02-18',
        status: 'completed',
        subtasks: [
          {
            id: 'subtask-topic-1',
            title: 'Rank top 20 support intents',
            completed: true,
            createdAt: '2026-02-10T09:00:00.000Z'
          }
        ]
      },
      {
        id: 'milestone-guides',
        title: 'Draft Guided Articles',
        dueDate: '2026-03-02',
        status: 'in-progress',
        subtasks: [
          {
            id: 'subtask-guides-1',
            title: 'Draft account setup guide',
            completed: true,
            createdAt: '2026-02-19T09:00:00.000Z'
          },
          {
            id: 'subtask-guides-2',
            title: 'Draft billing troubleshooting',
            completed: false,
            createdAt: '2026-02-21T09:00:00.000Z'
          }
        ]
      },
      {
        id: 'milestone-walkthroughs',
        title: 'Publish In-App Walkthroughs',
        dueDate: '2026-03-19',
        status: 'pending',
        subtasks: []
      }
    ]
  }
]

function App(): ReactElement {
  const vaultApi = (window as unknown as { vaultApi?: RendererVaultApi }).vaultApi
  const {
    vault,
    notes,
    currentNotePath,
    currentNoteContent,
    searchQuery,
    searchResults,
    commandPaletteOpen,
    settings,
    setVault,
    setNotes,
    setCurrentNotePath,
    setCurrentNoteContent,
    setSearchQuery,
    setSearchResults,
    setCommandPaletteOpen,
    setSettings,
    pushToast
  } = useVaultStore()
  const [activePage, setActivePage] = useState<AppPage>('notes')
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toIsoDate(new Date()))
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  // Projects are now derived from settings for persistence
  const projects = settings.projects.length > 0 ? settings.projects : PROJECT_SEED
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    PROJECT_SEED[0]?.id ?? null
  )
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const [isProjectIconPickerOpen, setIsProjectIconPickerOpen] = useState(false)
  const projectIconPickerRef = useRef<HTMLDivElement | null>(null)

  const noteIsOpen = Boolean(currentNotePath)
  const currentNoteName = currentNotePath
    ? (currentNotePath.split('/').pop() ?? currentNotePath).replace(/\.md$/i, '')
    : ''
  const currentNoteTags = useMemo(
    () => listTagsFromMarkdown(currentNoteContent),
    [currentNoteContent]
  )
  const currentNoteBody = useMemo(
    () => splitNoteContent(currentNoteContent).body,
    [currentNoteContent]
  )

  // Word count for current note
  const currentNoteWordCount = useMemo(() => {
    if (!currentNoteBody) return 0
    const words = currentNoteBody.trim().split(/\s+/).filter(Boolean)
    return words.length
  }, [currentNoteBody])

  // Unscheduled tasks (no date assigned)
  const unscheduledTasks = useMemo(() => {
    return settings.calendarTasks.filter((task) => !task.date)
  }, [settings.calendarTasks])

  // Tasks grouped by date for the calendar view
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, CalendarTask[]> = {}

    for (const task of settings.calendarTasks) {
      if (task.date) {
        if (!grouped[task.date]) {
          grouped[task.date] = []
        }
        grouped[task.date].push(task)
      }
    }

    return grouped
  }, [settings.calendarTasks])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const middleHeaderTitle = useMemo(() => {
    if (activePage === 'notes') {
      if (searchQuery.trim()) {
        return 'Search Results'
      }

      if (!currentNotePath) {
        return 'No Note Selected'
      }

      const fileName = currentNotePath.split('/').pop() ?? currentNotePath
      return fileName.replace(/\.md$/i, '')
    }

    if (activePage === 'projects') {
      return selectedProject?.name ?? 'No Project Selected'
    }

    if (activePage === 'resources') {
      return 'Resource Library'
    }

    if (activePage === 'calendar') {
      return `Tasks for ${formatCalendarDateLabel(selectedCalendarDate)}`
    }

    return 'App Settings'
  }, [activePage, searchQuery, currentNotePath, selectedCalendarDate, selectedProject])

  useEffect(() => {
    if (!vaultApi) {
      return
    }

    void vaultApi.settings
      .get()
      .then((nextSettings) => {
        setSettings(nextSettings)
      })
      .catch((error: unknown) => {
        pushToast('error', String(error))
      })
  }, [vaultApi, setSettings, pushToast])

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-family', settings.fontFamily)
  }, [settings.fontFamily])

  useEffect(() => {
    if (!vaultApi) {
      return
    }

    void (async () => {
      try {
        const restored = await vaultApi.vault.restoreLast()
        if (!restored) {
          return
        }
        setVault(restored.info)
        setNotes(restored.notes)
        pushToast('info', `Restored vault ${restored.info.rootPath}`)
      } catch (error) {
        pushToast('error', String(error))
      }
    })()
  }, [vaultApi, setNotes, setVault, pushToast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const isPalette = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p'
      if (isPalette) {
        event.preventDefault()
        setCommandPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setCommandPaletteOpen])

  useEffect(() => {
    if (activePage !== 'projects' || !selectedProject) {
      setIsProjectIconPickerOpen(false)
    }
  }, [activePage, selectedProject])

  useEffect(() => {
    if (!isProjectIconPickerOpen) {
      return
    }

    const handleOutsideClick = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (!projectIconPickerRef.current?.contains(target)) {
        setIsProjectIconPickerOpen(false)
      }
    }

    window.addEventListener('mousedown', handleOutsideClick)
    return () => window.removeEventListener('mousedown', handleOutsideClick)
  }, [isProjectIconPickerOpen])

  useEffect(() => {
    if (!vaultApi) {
      return
    }

    if (!noteIsOpen || !currentNotePath) {
      return
    }
    const timer = setTimeout(() => {
      void vaultApi.files
        .writeNote(currentNotePath, currentNoteContent)
        .then(() => vaultApi.files.listNotes())
        .then((nextNotes) => setNotes(nextNotes))
        .catch((error: unknown) => pushToast('error', String(error)))
    }, 400)

    return () => clearTimeout(timer)
  }, [vaultApi, currentNoteContent, currentNotePath, noteIsOpen, setNotes, pushToast])

  const updateFontFamily = async (fontFamily: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({ fontFamily })
      setSettings(nextSettings)
      pushToast('success', 'Font updated')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const persistCalendarTasks = async (calendarTasks: CalendarTask[]): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({ calendarTasks })
      setSettings(nextSettings)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const persistProjects = async (nextProjects: Project[]): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const nextSettings = await vaultApi.settings.update({ projects: nextProjects })
      setSettings(nextSettings)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const persistProjectData = async (
    nextProjects: Project[],
    nextProjectIcons: Record<string, ProjectIconStyle>
  ): Promise<boolean> => {
    if (!vaultApi) {
      return false
    }

    try {
      const nextSettings = await vaultApi.settings.update({
        projects: nextProjects,
        projectIcons: nextProjectIcons
      })
      setSettings(nextSettings)
      return true
    } catch (error) {
      pushToast('error', String(error))
      return false
    }
  }

  const addCalendarTask = async (): Promise<void> => {
    const title = window.prompt('Task title')?.trim()
    if (!title) {
      return
    }

    const nextTask: CalendarTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      date: selectedCalendarDate,
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'medium',
      reminders: []
    }

    await persistCalendarTasks([...settings.calendarTasks, nextTask])
    pushToast('success', 'Task added')
  }

  // Create an unscheduled task (no date)
  const createUnscheduledTask = async (title: string): Promise<void> => {
    const trimmed = title.trim()
    if (!trimmed) return

    const nextTask: CalendarTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'medium',
      reminders: []
    }

    await persistCalendarTasks([...settings.calendarTasks, nextTask])
  }

  const toggleCalendarTask = async (taskId: string): Promise<void> => {
    const nextTasks = settings.calendarTasks.map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    )
    await persistCalendarTasks(nextTasks)
  }

  const removeCalendarTask = async (taskId: string): Promise<void> => {
    const nextTasks = settings.calendarTasks.filter((task) => task.id !== taskId)
    await persistCalendarTasks(nextTasks)
  }

  const renameCalendarTask = async (taskId: string, newTitle: string): Promise<void> => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    const nextTasks = settings.calendarTasks.map((task) =>
      task.id === taskId ? { ...task, title: trimmed } : task
    )
    await persistCalendarTasks(nextTasks)
  }

  const updateCalendarTaskPriority = async (
    taskId: string,
    priority: TaskPriority
  ): Promise<void> => {
    const nextTasks = settings.calendarTasks.map((task) =>
      task.id === taskId ? { ...task, priority } : task
    )
    await persistCalendarTasks(nextTasks)
  }

  const rescheduleCalendarTask = async (
    taskId: string,
    newDate: string | undefined
  ): Promise<void> => {
    const nextTasks = settings.calendarTasks.map((task) =>
      task.id === taskId ? { ...task, date: newDate } : task
    )
    await persistCalendarTasks(nextTasks)
    // If scheduling to a date, switch to that date
    if (newDate) {
      setSelectedCalendarDate(newDate)
    }
  }

  const goToPrevMonth = (): void => {
    const current = parseIsoDate(selectedCalendarDate)
    current.setMonth(current.getMonth() - 1)
    setSelectedCalendarDate(toIsoDate(current))
  }

  const goToNextMonth = (): void => {
    const current = parseIsoDate(selectedCalendarDate)
    current.setMonth(current.getMonth() + 1)
    setSelectedCalendarDate(toIsoDate(current))
  }

  const goToToday = (): void => {
    setSelectedCalendarDate(toIsoDate(new Date()))
  }

  const openVault = async (mode: 'open' | 'create'): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Vault actions are only available inside the Electron app')
      return
    }

    try {
      const result = mode === 'open' ? await vaultApi.vault.open() : await vaultApi.vault.create()
      if (!result) {
        return
      }
      setVault(result.info)
      setNotes(result.notes)
      setCurrentNotePath(null)
      setCurrentNoteContent('')
      pushToast('success', `Vault ready at ${result.info.rootPath}`)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const openNote = async (relPath: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const content = await vaultApi.files.readNote(relPath)
      setCurrentNotePath(relPath)
      setCurrentNoteContent(content)
      setIsPreviewMode(false) // Reset to edit mode when opening a new note
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const createNote = async (): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Create note is only available inside the Electron app')
      return
    }

    if (!vault) {
      pushToast('error', 'Select a vault in Settings before creating notes')
      setActivePage('settings')
      return
    }

    try {
      const relPath = await createNoteWithFallbackName()
      const nextNotes = await vaultApi.files.listNotes()
      setNotes(nextNotes)
      setSearchQuery('')
      setSearchResults([])
      setActivePage('notes')
      await openNote(relPath)
      pushToast('success', 'Note created')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const createProjectNote = async (projectName: string): Promise<void> => {
    if (!vaultApi) {
      pushToast('error', 'Create note is only available inside the Electron app')
      return
    }

    if (!vault) {
      pushToast('error', 'Select a vault in Settings before creating notes')
      setActivePage('settings')
      return
    }

    try {
      const projectTag = generateProjectTag(projectName)
      const relPath = await vaultApi.files.createNoteWithTags(buildDefaultNoteName(), [projectTag])
      const nextNotes = await vaultApi.files.listNotes()
      setNotes(nextNotes)
      setActivePage('notes')
      await openNote(relPath)
      pushToast('success', 'Project note created')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const runSearch = async (query: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      const results = await vaultApi.search.query(query)
      setSearchResults(results)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const promptAndRunSearch = (): void => {
    const query = window.prompt('Search notes by title, body, or tag', searchQuery)
    if (query === null) {
      return
    }

    void runSearch(query)
  }

  const promptAndRunProjectSearch = (): void => {
    const query = window.prompt('Search projects by name or details', projectSearchQuery)
    if (query === null) {
      return
    }

    setProjectSearchQuery(query)
  }

  const importAttachment = async (sourcePath: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    if (!currentNotePath) {
      pushToast('error', 'Open a note before importing attachments')
      return
    }

    try {
      const vaultRelative = await vaultApi.attachments.import(sourcePath)
      const fromDir = currentNotePath.includes('/')
        ? currentNotePath.slice(0, currentNotePath.lastIndexOf('/'))
        : ''
      const prefix = fromDir.length === 0 ? '../' : `${'../'.repeat(fromDir.split('/').length + 1)}`
      const markdownLink = `${prefix}${vaultRelative}`
      setCurrentNoteContent(`${currentNoteContent}\n\n![](${markdownLink})\n`)
      pushToast('success', 'Attachment imported')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const importImageFromBlob = async (
    imageBlob: Blob,
    fileExtension: string
  ): Promise<string | null> => {
    if (!vaultApi) {
      return null
    }

    if (!currentNotePath) {
      return null
    }

    if (!vault) {
      return null
    }

    try {
      // Convert Blob to Uint8Array
      const arrayBuffer = await imageBlob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // Import the attachment - returns vault-relative path like "attachments/123456-pasted.png"
      const vaultRelative = await vaultApi.attachments.importFromBuffer(uint8Array, fileExtension)

      // Return vault-file:// URL for BlockNote to display
      // Convert vault path + relative path to absolute path, then use custom protocol
      const absolutePath = `${vault.rootPath}/${vaultRelative}`
      return `vault-file://${absolutePath}`
    } catch (error) {
      console.error('Failed to import image from clipboard:', error)
      return null
    }
  }

  const addTagToCurrentNote = (rawTag: string): void => {
    if (!currentNotePath) {
      return
    }

    const normalized = normalizeTag(rawTag)
    if (!normalized) {
      pushToast('error', 'Tag can use letters, numbers, dash, underscore')
      return
    }

    if (currentNoteTags.includes(normalized)) {
      pushToast('info', `Tag #${normalized} already exists`)
      return
    }

    setCurrentNoteContent(
      upsertTagsInMarkdown(currentNoteContent, [...currentNoteTags, normalized])
    )
  }

  const removeTagFromCurrentNote = (tag: string): void => {
    if (!currentNotePath) {
      return
    }

    const next = currentNoteTags.filter((item) => item !== tag)
    setCurrentNoteContent(upsertTagsInMarkdown(currentNoteContent, next))
  }

  const addTagToNote = async (relPath: string, rawTag: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    const normalized = normalizeTag(rawTag)
    if (!normalized) {
      pushToast('error', 'Tag can use letters, numbers, dash, underscore, and colons')
      return
    }

    try {
      const content = await vaultApi.files.readNote(relPath)
      const existingTags = listTagsFromMarkdown(content)
      if (existingTags.includes(normalized)) {
        pushToast('info', `Tag #${normalized} already exists on this note`)
        return
      }
      const updatedContent = upsertTagsInMarkdown(content, [...existingTags, normalized])
      await vaultApi.files.writeNote(relPath, updatedContent)
      const nextNotes = await vaultApi.files.listNotes()
      setNotes(nextNotes)
      pushToast('success', `Added tag #${normalized}`)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const removeTagFromNote = async (relPath: string, tag: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    try {
      const content = await vaultApi.files.readNote(relPath)
      const existingTags = listTagsFromMarkdown(content)
      const updatedTags = existingTags.filter((t) => t !== tag)
      const updatedContent = upsertTagsInMarkdown(content, updatedTags)
      await vaultApi.files.writeNote(relPath, updatedContent)
      const nextNotes = await vaultApi.files.listNotes()
      setNotes(nextNotes)
      pushToast('success', `Removed tag #${tag}`)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const findByTag = (tag: string): void => {
    void runSearch(tag)
  }

  const updateCurrentNoteBody = (nextBody: string): void => {
    setCurrentNoteContent(replaceNoteBody(currentNoteContent, nextBody))
  }

  const updateProjectIcon = (projectId: string, nextIcon: ProjectIconStyle): void => {
    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? { ...project, icon: nextIcon, updatedAt: new Date().toISOString() }
        : project
    )
    const nextProjectIcons = { ...settings.projectIcons, [projectId]: nextIcon }
    void persistProjectData(nextProjects, nextProjectIcons)
  }

  const randomizeProjectIcon = (projectId: string): void => {
    const seed = `${projectId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    updateProjectIcon(projectId, createRandomProjectIcon(seed))
  }

  const resolveMentionTarget = (target: string): string | null => {
    const normalizedTarget = normalizeMentionTarget(target)
    if (!normalizedTarget) {
      return null
    }

    const byRelPath = notes.find(
      (note) => normalizeMentionTarget(note.relPath) === normalizedTarget
    )
    if (byRelPath) {
      return byRelPath.relPath
    }

    const byName = notes.filter((note) => normalizeMentionTarget(note.name) === normalizedTarget)
    if (byName.length === 1) {
      return byName[0].relPath
    }

    return null
  }

  const openMentionTarget = async (target: string): Promise<void> => {
    const relPath = resolveMentionTarget(target)
    if (!relPath) {
      const normalizedTarget = normalizeMentionTarget(target)
      const byNameMatches = notes.filter(
        (note) => normalizeMentionTarget(note.name) === normalizedTarget
      )
      if (normalizedTarget && byNameMatches.length > 1) {
        pushToast('error', `Multiple notes match [[${target}]]. Use folder/name format.`)
        return
      }
      pushToast('error', `Note mention not found: [[${target}]]`)
      return
    }

    await openNote(relPath)
  }

  const renameCurrentNote = async (newName: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    if (!currentNotePath) {
      return
    }

    try {
      const dir = currentNotePath.includes('/')
        ? currentNotePath.slice(0, currentNotePath.lastIndexOf('/'))
        : ''
      const newPath = dir ? `${dir}/${newName}.md` : `${newName}.md`

      await vaultApi.files.rename(currentNotePath, newPath)
      const nextNotes = await vaultApi.files.listNotes()
      setNotes(nextNotes)
      setCurrentNotePath(newPath)
      pushToast('success', 'Note renamed')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const deleteNoteByPath = async (relPath: string): Promise<void> => {
    if (!vaultApi) {
      return
    }

    const fileName = relPath.split('/').pop() ?? relPath
    const confirmed = window.confirm(`Delete note "${fileName}"? This cannot be undone.`)
    if (!confirmed) {
      return
    }

    try {
      await vaultApi.files.delete(relPath)
      const nextNotes = await vaultApi.files.listNotes()
      setNotes(nextNotes)
      if (currentNotePath === relPath) {
        setCurrentNotePath(null)
        setCurrentNoteContent('')
      }
      pushToast('success', 'Note deleted')
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const deleteCurrentNote = async (): Promise<void> => {
    if (!currentNotePath) {
      return
    }

    await deleteNoteByPath(currentNotePath)
  }

  const exportCurrentNote = async (): Promise<void> => {
    if (!vaultApi || !currentNotePath) {
      return
    }

    try {
      const exportedPath = await vaultApi.files.exportNote(currentNotePath, currentNoteContent)
      if (!exportedPath) {
        return
      }
      pushToast('success', `Note exported to ${exportedPath}`)
    } catch (error) {
      pushToast('error', String(error))
    }
  }

  const notifyUnavailableTool = (label: string): void => {
    pushToast('info', `${label} is coming soon`)
  }

  const deriveMilestoneStatus = (milestone: ProjectMilestone): ProjectMilestone['status'] => {
    const subtasks = milestone.subtasks
    if (subtasks.length === 0) {
      return 'pending'
    }

    const completedCount = subtasks.filter((subtask) => subtask.completed).length
    if (completedCount === subtasks.length) {
      return 'completed'
    }

    if (completedCount > 0) {
      return 'in-progress'
    }

    return 'pending'
  }

  const computeProjectProgress = (milestones: ProjectMilestone[]): number => {
    if (milestones.length === 0) {
      return 0
    }

    const total = milestones.reduce((sum, milestone) => {
      if (milestone.status === 'completed') {
        return sum + 1
      }

      if (milestone.status === 'in-progress') {
        return sum + 0.5
      }

      return sum
    }, 0)

    return Math.round((total / milestones.length) * 100)
  }

  const withComputedProjectState = (project: Project): Project => {
    const milestones = project.milestones.map((milestone) => ({
      ...milestone,
      subtasks: milestone.subtasks ?? [],
      status: deriveMilestoneStatus(milestone)
    }))

    return {
      ...project,
      milestones,
      progress: computeProjectProgress(milestones)
    }
  }

  const createProject = (): void => {
    const baseName = 'Untitled Project'
    const existingNames = new Set(projects.map((project) => project.name.toLowerCase()))

    let nextName = baseName
    let suffix = 2
    while (existingNames.has(nextName.toLowerCase())) {
      nextName = `${baseName} ${suffix}`
      suffix += 1
    }

    const nextProject: Project = {
      id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: nextName,
      summary: 'Add project details here.',
      status: 'on-track',
      icon: createRandomProjectIcon(nextName),
      updatedAt: new Date().toISOString(),
      progress: 0,
      milestones: []
    }

    const nextProjects = [withComputedProjectState(nextProject), ...projects]
    const nextProjectIcons = { ...settings.projectIcons, [nextProject.id]: nextProject.icon }
    void persistProjectData(nextProjects, nextProjectIcons)
    setSelectedProjectId(nextProject.id)
    setProjectSearchQuery('')
    pushToast('success', 'Project created')
  }

  const renameProject = (projectId: string, nextName: string): void => {
    const normalizedName = nextName.trim()
    if (!normalizedName) {
      return
    }

    const existing = projects.find((project) => project.id === projectId)
    if (!existing || existing.name === normalizedName) {
      return
    }

    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? { ...project, name: normalizedName, updatedAt: new Date().toISOString() }
        : project
    )
    void persistProjects(nextProjects)
  }

  const updateProjectSummary = (projectId: string, nextSummary: string): void => {
    const normalizedSummary = nextSummary.trim()

    const existing = projects.find((project) => project.id === projectId)
    if (!existing || existing.summary === normalizedSummary) {
      return
    }

    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? { ...project, summary: normalizedSummary, updatedAt: new Date().toISOString() }
        : project
    )
    void persistProjects(nextProjects)
  }

  const addMilestoneToProject = (projectId: string, title: string, dueDate: string): void => {
    const normalizedTitle = title.trim()
    const normalizedDueDate = dueDate.trim()
    if (!normalizedTitle || !normalizedDueDate) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestone: ProjectMilestone = {
        id: `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: normalizedTitle,
        dueDate: normalizedDueDate,
        status: 'pending',
        subtasks: []
      }

      return withComputedProjectState({
        ...project,
        milestones: [...project.milestones, nextMilestone],
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const renameProjectMilestone = (
    projectId: string,
    milestoneId: string,
    nextTitle: string
  ): void => {
    const normalizedTitle = nextTitle.trim()
    if (!normalizedTitle) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, title: normalizedTitle } : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const updateProjectMilestoneDueDate = (
    projectId: string,
    milestoneId: string,
    nextDueDate: string
  ): void => {
    const normalizedDueDate = nextDueDate.trim()
    if (!normalizedDueDate) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, dueDate: normalizedDueDate } : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const removeProjectMilestone = (projectId: string, milestoneId: string): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.filter((milestone) => milestone.id !== milestoneId)

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const moveProjectMilestone = (
    projectId: string,
    milestoneId: string,
    direction: 'up' | 'down'
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const currentIndex = project.milestones.findIndex((milestone) => milestone.id === milestoneId)
      if (currentIndex < 0) {
        return project
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= project.milestones.length) {
        return project
      }

      const nextMilestones = [...project.milestones]
      const [movingMilestone] = nextMilestones.splice(currentIndex, 1)
      nextMilestones.splice(targetIndex, 0, movingMilestone)

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const addSubtaskToMilestone = (projectId: string, milestoneId: string, title: string): void => {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: [
                ...milestone.subtasks,
                {
                  id: `subtask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  title: normalizedTitle,
                  completed: false,
                  createdAt: new Date().toISOString(),
                  dueDate: milestone.dueDate
                } satisfies ProjectSubtask
              ]
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const updateMilestoneSubtaskDueDate = (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    nextDueDate: string
  ): void => {
    const normalizedDueDate = nextDueDate.trim()
    if (!normalizedDueDate) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, dueDate: normalizedDueDate } : subtask
              )
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const toggleMilestoneSubtask = (
    projectId: string,
    milestoneId: string,
    subtaskId: string
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
              )
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const renameMilestoneSubtask = (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    nextTitle: string
  ): void => {
    const normalizedTitle = nextTitle.trim()
    if (!normalizedTitle) {
      return
    }

    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, title: normalizedTitle } : subtask
              )
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const moveMilestoneSubtask = (
    projectId: string,
    milestoneId: string,
    subtaskId: string,
    direction: 'up' | 'down'
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) => {
        if (milestone.id !== milestoneId) {
          return milestone
        }

        const currentIndex = milestone.subtasks.findIndex((subtask) => subtask.id === subtaskId)
        if (currentIndex < 0) {
          return milestone
        }

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
        if (targetIndex < 0 || targetIndex >= milestone.subtasks.length) {
          return milestone
        }

        const nextSubtasks = [...milestone.subtasks]
        const [movingSubtask] = nextSubtasks.splice(currentIndex, 1)
        nextSubtasks.splice(targetIndex, 0, movingSubtask)

        return {
          ...milestone,
          subtasks: nextSubtasks
        }
      })

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const removeMilestoneSubtask = (
    projectId: string,
    milestoneId: string,
    subtaskId: string
  ): void => {
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }

      const nextMilestones = project.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              subtasks: milestone.subtasks.filter((subtask) => subtask.id !== subtaskId)
            }
          : milestone
      )

      return withComputedProjectState({
        ...project,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString()
      })
    })
    void persistProjects(nextProjects)
  }

  const removeSelectedProject = async (): Promise<void> => {
    if (!selectedProject) {
      return
    }

    const confirmed = window.confirm(
      `Remove project "${selectedProject.name}" from this workspace? This cannot be undone.`
    )
    if (!confirmed) {
      return
    }

    const nextProjects = projects.filter((project) => project.id !== selectedProject.id)
    const nextSelectedProject =
      nextProjects.find((project) => project.id === selectedProjectId) ?? nextProjects[0] ?? null
    const nextProjectIcons = { ...settings.projectIcons }
    delete nextProjectIcons[selectedProject.id]
    const saved = await persistProjectData(nextProjects, nextProjectIcons)
    if (!saved) {
      return
    }
    setSelectedProjectId(nextSelectedProject?.id ?? null)
    pushToast('success', 'Project removed')
  }

  const createNoteWithFallbackName = async (): Promise<string> => {
    if (!vaultApi) {
      throw new Error('Vault API unavailable')
    }

    const base = buildDefaultNoteName()
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${attempt + 1}`
      const candidate = `${base}${suffix}`
      try {
        return await vaultApi.files.createNote(candidate)
      } catch (error) {
        if (!String(error).includes('EEXIST')) {
          throw error
        }
      }
    }

    throw new Error('Could not create a unique note name')
  }

  const headerCellClass =
    'flex min-h-0 min-w-0 items-center justify-between gap-2.5 bg-[var(--panel)] p-3'
  const bodyCellClass = 'min-h-0 min-w-0 border-b border-[var(--line)] bg-[var(--panel)]'

  return (
    <div className="flex h-screen flex-col">
      {/* Top Bar spans full width - above sidebar and content */}
      <TopBar
        activePage={activePage}
        currentNoteName={currentNotePath ? currentNoteName : null}
        currentProjectName={selectedProject?.name ?? null}
        onNavigateHome={() => setActivePage('notes')}
      />
      <SidebarProvider className="flex-1 min-h-0">
        <AppSidebar activePage={activePage} onChange={setActivePage} notesCount={notes.length} />
        <SidebarInset className="text-[var(--text)] antialiased [font-family:var(--app-font-family)] [background:radial-gradient(circle_at_7%_20%,var(--bg-radial-a)_0%,transparent_42%),radial-gradient(circle_at_95%_82%,var(--bg-radial-b)_0%,transparent_38%),var(--bg)]">
          <div className="flex h-full flex-col">
            {/* Header Row */}
            <div className="app-drag-region flex h-[74px] shrink-0 border-b border-[var(--line)]">
              {/* Middle panel header */}
              <header className={`${headerCellClass} w-[320px] shrink-0 border-r`}>
                <div className="app-no-drag flex items-center gap-2">
                  <SidebarTrigger className="-ml-1" />
                </div>
                {activePage === 'notes' ? (
                  <div className="app-no-drag flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]"
                      onClick={promptAndRunSearch}
                      aria-label="Search notes"
                      title="Search notes"
                    >
                      <Search size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]"
                      onClick={() => {
                        void createNote()
                      }}
                      aria-label="Add new note"
                      title="Add new note"
                    >
                      <Plus size={18} aria-hidden="true" />
                    </button>
                  </div>
                ) : activePage === 'projects' ? (
                  <div className="app-no-drag flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]"
                      onClick={promptAndRunProjectSearch}
                      aria-label="Search projects"
                      title="Search projects"
                    >
                      <Search size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]"
                      onClick={createProject}
                      aria-label="Add new project"
                      title="Add new project"
                    >
                      <Plus size={18} aria-hidden="true" />
                    </button>
                  </div>
                ) : activePage === 'resources' ? (
                  <div className="app-no-drag flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 hover:border-[var(--accent)]"
                      onClick={() => notifyUnavailableTool('Add resource link')}
                    >
                      Add Link
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 hover:border-[var(--accent)]"
                      onClick={() => notifyUnavailableTool('Upload resource file')}
                    >
                      Upload
                    </button>
                  </div>
                ) : activePage === 'calendar' ? (
                  <div className="app-no-drag flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]"
                      onClick={() => {
                        void addCalendarTask()
                      }}
                      aria-label="Add new task"
                      title="Add new task"
                    >
                      <Plus size={18} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="app-no-drag flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 hover:border-[var(--accent)]"
                      onClick={() => {
                        void updateFontFamily(FONT_OPTIONS[0].value)
                      }}
                    >
                      Reset Font
                    </button>
                  </div>
                )}
              </header>

              {/* Main content header */}
              <header className={`${headerCellClass} flex-1`}>
                {noteIsOpen && activePage === 'notes' && !searchQuery.trim() ? (
                  <div className="flex min-w-0 w-full items-center gap-2">
                    {/* Metadata strip */}
                    <div className="flex min-w-0 items-center gap-3 text-sm text-[var(--muted)]">
                      <span>{currentNoteWordCount.toLocaleString()} words</span>
                      {currentNoteTags.length > 0 && (
                        <>
                          <span className="text-[var(--line-strong)]">·</span>
                          <span className="flex items-center gap-1.5 truncate">
                            {currentNoteTags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded bg-[var(--tag-neutral-bg)] px-1.5 py-0.5 text-xs text-[var(--tag-neutral-text)]"
                              >
                                #{tag}
                              </span>
                            ))}
                            {currentNoteTags.length > 3 && (
                              <span className="text-xs">+{currentNoteTags.length - 3}</span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="app-no-drag ml-auto flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPreviewMode(!isPreviewMode)}
                        className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)]"
                        title={isPreviewMode ? 'Switch to Edit Mode' : 'Switch to Preview Mode'}
                      >
                        {isPreviewMode ? <Eye size={18} /> : <Pencil size={18} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void exportCurrentNote()
                        }}
                        className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)]"
                        title="Export Note"
                      >
                        <Share2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => pushToast('info', 'Favorites feature coming soon')}
                        className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)]"
                        title="Add to Favorites"
                      >
                        <Heart size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void deleteCurrentNote()
                        }}
                        className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)]"
                        title="Delete Note"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ) : activePage === 'projects' && selectedProject ? (
                  <div className="app-no-drag flex min-w-0 w-full items-center gap-2">
                    {/* Metadata strip with icon picker */}
                    <div
                      ref={projectIconPickerRef}
                      className="relative flex min-w-0 items-center gap-3 text-sm text-[var(--muted)]"
                    >
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center justify-center p-0 hover:opacity-80"
                        onClick={() => setIsProjectIconPickerOpen((current) => !current)}
                        title="Customize project icon"
                      >
                        <NoteShapeIcon icon={selectedProject.icon} size={16} className="shrink-0" />
                      </button>
                      <span>{selectedProject.milestones.length} milestones</span>
                      <span className="text-[var(--line-strong)]">·</span>
                      <span>{selectedProject.progress}% complete</span>
                      {isProjectIconPickerOpen ? (
                        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-xl">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                            Shape
                          </div>
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {PROJECT_ICON_SHAPES.map((shape) => {
                              const isActive = selectedProject.icon.shape === shape
                              return (
                                <button
                                  key={shape}
                                  type="button"
                                  className={`inline-flex items-center justify-center rounded-md border p-1.5 ${
                                    isActive
                                      ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                                      : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]'
                                  }`}
                                  onClick={() =>
                                    updateProjectIcon(selectedProject.id, {
                                      ...selectedProject.icon,
                                      shape
                                    })
                                  }
                                  title={shape}
                                >
                                  <NoteShapeIcon
                                    icon={{ ...selectedProject.icon, shape }}
                                    size={15}
                                  />
                                </button>
                              )
                            })}
                          </div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                            Style
                          </div>
                          <div className="mb-3 flex gap-1.5">
                            {PROJECT_ICON_VARIANTS.map((variant) => {
                              const isActive = selectedProject.icon.variant === variant
                              return (
                                <button
                                  key={variant}
                                  type="button"
                                  className={`rounded-md border px-2 py-1 text-xs font-medium ${
                                    isActive
                                      ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
                                      : 'border-[var(--line)] bg-[var(--panel-2)] text-[var(--muted)] hover:border-[var(--accent)]'
                                  }`}
                                  onClick={() =>
                                    updateProjectIcon(selectedProject.id, {
                                      ...selectedProject.icon,
                                      variant
                                    })
                                  }
                                >
                                  {variant}
                                </button>
                              )
                            })}
                          </div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                            Color
                          </div>
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {PROJECT_ICON_COLORS.map((color) => {
                              const isActive = selectedProject.icon.color === color
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  className={`h-6 w-6 rounded-full border-2 ${
                                    isActive
                                      ? 'border-[var(--text)] ring-1 ring-[var(--line)]'
                                      : 'border-transparent'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  onClick={() =>
                                    updateProjectIcon(selectedProject.id, {
                                      ...selectedProject.icon,
                                      color
                                    })
                                  }
                                  title={color}
                                />
                              )
                            })}
                          </div>
                          <button
                            type="button"
                            className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-1.5 text-xs font-medium hover:border-[var(--accent)]"
                            onClick={() => randomizeProjectIcon(selectedProject.id)}
                          >
                            Randomize icon
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => pushToast('info', 'Share project feature coming soon')}
                        className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)]"
                        title="Share Project"
                      >
                        <Share2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => pushToast('info', 'Project favorites feature coming soon')}
                        className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)]"
                        title="Add Project to Favorites"
                      >
                        <Heart size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void removeSelectedProject()
                        }}
                        className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)]"
                        title="Remove Project"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ) : activePage === 'calendar' ? (
                  <div className="flex min-w-0 w-full items-center gap-2">
                    {/* Metadata strip */}
                    <div className="flex min-w-0 items-center gap-3 text-sm text-[var(--muted)]">
                      <span>{tasksByDate[selectedCalendarDate]?.length ?? 0} tasks scheduled</span>
                      <span className="text-[var(--line-strong)]">·</span>
                      <span>{unscheduledTasks.length} unscheduled</span>
                    </div>
                    <div className="app-no-drag ml-auto flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={goToPrevMonth}
                        className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)]"
                        title="Previous month"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={goToToday}
                        className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)]"
                        title="Go to today"
                      >
                        <CalendarDays size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={goToNextMonth}
                        className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)]"
                        title="Next month"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="truncate text-base font-semibold text-[var(--text)]">
                    {middleHeaderTitle}
                  </div>
                )}
              </header>
            </div>

            {/* Body Row */}
            <div className="flex flex-1 min-h-0">
              {/* Middle panel - hidden on calendar page */}
              {activePage !== 'calendar' && (
                <section className={`${bodyCellClass} w-[320px] shrink-0 border-r`}>
                  {activePage === 'notes' ? (
                    <NotePreviewList
                      notes={notes}
                      selectedPath={currentNotePath}
                      filter={searchQuery}
                      onOpen={(relPath) => {
                        setSearchQuery('')
                        setSearchResults([])
                        void openNote(relPath)
                      }}
                      onDelete={(relPath) => {
                        void deleteNoteByPath(relPath)
                      }}
                    />
                  ) : activePage === 'projects' ? (
                    <ProjectPreviewList
                      projects={projects}
                      selectedProjectId={selectedProjectId}
                      filter={projectSearchQuery}
                      onSelect={setSelectedProjectId}
                    />
                  ) : activePage === 'resources' ? (
                    <div className="grid h-full grid-rows-3 gap-3 p-3">
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5 text-lg text-[var(--muted)]">
                        Reference Links
                      </div>
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5 text-lg text-[var(--muted)]">
                        Attachments
                      </div>
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5 text-lg text-[var(--muted)]">
                        Templates
                      </div>
                    </div>
                  ) : (
                    <div className="grid h-full grid-rows-3 gap-3 p-3">
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5 text-lg text-[var(--muted)]">
                        Appearance
                      </div>
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5 text-lg text-[var(--muted)]">
                        Editor Defaults
                      </div>
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5 text-lg text-[var(--muted)]">
                        Shortcuts
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Main content */}
              <section className={`${bodyCellClass} flex-1 overflow-hidden`}>
                {activePage === 'notes' ? (
                  searchQuery.trim() ? (
                    <SearchPage
                      results={searchResults}
                      onOpen={(relPath) => {
                        void openNote(relPath)
                        setSearchQuery('')
                        setSearchResults([])
                      }}
                    />
                  ) : noteIsOpen && currentNotePath ? (
                    <EditorPage
                      notePath={currentNotePath}
                      content={currentNoteBody}
                      tags={currentNoteTags}
                      notes={notes}
                      onChange={updateCurrentNoteBody}
                      onDropFile={(sourcePath) => importAttachment(sourcePath)}
                      onPasteImage={importImageFromBlob}
                      onAddTag={addTagToCurrentNote}
                      onRemoveTag={removeTagFromCurrentNote}
                      onFindByTag={findByTag}
                      onRename={renameCurrentNote}
                      onOpenMention={(target) => {
                        void openMentionTarget(target)
                      }}
                      vaultRootPath={vault?.rootPath}
                      isPreviewMode={isPreviewMode}
                    />
                  ) : (
                    <div className="p-5 text-sm text-[var(--muted)]">
                      Pick a note from the middle column to open details
                    </div>
                  )
                ) : activePage === 'projects' ? (
                  selectedProject ? (
                    <ProjectDetailsPage
                      project={selectedProject}
                      notes={notes}
                      onRename={(nextName) => renameProject(selectedProject.id, nextName)}
                      onUpdateSummary={(nextSummary) =>
                        updateProjectSummary(selectedProject.id, nextSummary)
                      }
                      onAddMilestone={(title, dueDate) =>
                        addMilestoneToProject(selectedProject.id, title, dueDate)
                      }
                      onRenameMilestone={(milestoneId, nextTitle) =>
                        renameProjectMilestone(selectedProject.id, milestoneId, nextTitle)
                      }
                      onUpdateMilestoneDueDate={(milestoneId, nextDueDate) =>
                        updateProjectMilestoneDueDate(selectedProject.id, milestoneId, nextDueDate)
                      }
                      onMoveMilestone={(milestoneId, direction) =>
                        moveProjectMilestone(selectedProject.id, milestoneId, direction)
                      }
                      onRemoveMilestone={(milestoneId) =>
                        removeProjectMilestone(selectedProject.id, milestoneId)
                      }
                      onAddSubtask={(milestoneId, title) =>
                        addSubtaskToMilestone(selectedProject.id, milestoneId, title)
                      }
                      onToggleSubtask={(milestoneId, subtaskId) =>
                        toggleMilestoneSubtask(selectedProject.id, milestoneId, subtaskId)
                      }
                      onRenameSubtask={(milestoneId, subtaskId, nextTitle) =>
                        renameMilestoneSubtask(
                          selectedProject.id,
                          milestoneId,
                          subtaskId,
                          nextTitle
                        )
                      }
                      onUpdateSubtaskDueDate={(milestoneId, subtaskId, nextDueDate) =>
                        updateMilestoneSubtaskDueDate(
                          selectedProject.id,
                          milestoneId,
                          subtaskId,
                          nextDueDate
                        )
                      }
                      onMoveSubtask={(milestoneId, subtaskId, direction) =>
                        moveMilestoneSubtask(selectedProject.id, milestoneId, subtaskId, direction)
                      }
                      onRemoveSubtask={(milestoneId, subtaskId) =>
                        removeMilestoneSubtask(selectedProject.id, milestoneId, subtaskId)
                      }
                      onCreateProjectNote={() => {
                        void createProjectNote(selectedProject.name)
                      }}
                      onOpenNote={(relPath) => {
                        setActivePage('notes')
                        void openNote(relPath)
                      }}
                      onAddTagToNote={(relPath, tag) => {
                        void addTagToNote(relPath, tag)
                      }}
                      onRemoveTagFromNote={(relPath, tag) => {
                        void removeTagFromNote(relPath, tag)
                      }}
                    />
                  ) : (
                    <div className="p-5 text-sm text-[var(--muted)]">
                      Pick a project from the middle column to open details
                    </div>
                  )
                ) : activePage === 'calendar' ? (
                  <div className="flex h-full">
                    <div className="flex-1 overflow-hidden">
                      <CalendarMonthView
                        selectedDate={selectedCalendarDate}
                        tasksByDate={tasksByDate}
                        onSelectDate={setSelectedCalendarDate}
                        onRescheduleTask={(taskId, newDate) => {
                          void rescheduleCalendarTask(taskId, newDate)
                        }}
                        onToggleTask={(taskId) => {
                          void toggleCalendarTask(taskId)
                        }}
                      />
                    </div>
                    <div className="w-80 shrink-0 border-l border-[var(--line)]">
                      <UnscheduledTaskList
                        tasks={unscheduledTasks}
                        onToggle={(taskId) => {
                          void toggleCalendarTask(taskId)
                        }}
                        onDelete={(taskId) => {
                          void removeCalendarTask(taskId)
                        }}
                        onRename={(taskId, newTitle) => {
                          void renameCalendarTask(taskId, newTitle)
                        }}
                        onUpdatePriority={(taskId, priority) => {
                          void updateCalendarTaskPriority(taskId, priority)
                        }}
                        onCreate={(title) => {
                          void createUnscheduledTask(title)
                        }}
                      />
                    </div>
                  </div>
                ) : activePage === 'settings' ? (
                  <SettingsPage
                    fontOptions={FONT_OPTIONS}
                    selectedFontFamily={settings.fontFamily}
                    vaultLocation={vault?.rootPath ?? settings.lastVaultPath}
                    onSelectFont={(fontFamily) => {
                      void updateFontFamily(fontFamily)
                    }}
                    onChangeVaultLocation={() => {
                      void openVault('open')
                    }}
                  />
                ) : (
                  <div className="p-5 text-sm text-[var(--muted)]">
                    {activePage} workspace ready. Notes remain fully functional.
                  </div>
                )}
              </section>
            </div>
          </div>

          <CommandPalette
            open={commandPaletteOpen}
            notes={notes}
            onClose={() => setCommandPaletteOpen(false)}
            onCreate={() => {
              void createNote()
            }}
            onSearch={promptAndRunSearch}
            onOpenNote={(relPath) => {
              setSearchQuery('')
              setSearchResults([])
              void openNote(relPath)
            }}
          />
          <SonnerBridge />
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

export default App

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(iso: string): Date {
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date()
  }
  return parsed
}

function formatCalendarDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function buildDefaultNoteName(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `note-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}
