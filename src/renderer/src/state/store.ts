import { create } from 'zustand'
import { AppSettings, NoteListItem, SearchResult, VaultInfo } from '../../../shared/types'

export interface Toast {
  id: string
  kind: 'info' | 'error' | 'success'
  message: string
}

interface VaultState {
  vault: VaultInfo | null
  notes: NoteListItem[]
  currentNotePath: string | null
  currentNoteContent: string
  searchQuery: string
  searchResults: SearchResult[]
  commandPaletteOpen: boolean
  settings: AppSettings
  toasts: Toast[]
  loading: boolean
  setLoading: (loading: boolean) => void
  setVault: (vault: VaultInfo | null) => void
  setNotes: (notes: NoteListItem[]) => void
  setCurrentNotePath: (path: string | null) => void
  setCurrentNoteContent: (content: string | ((current: string) => string)) => void
  setSearchQuery: (query: string) => void
  setSearchResults: (results: SearchResult[]) => void
  setCommandPaletteOpen: (open: boolean) => void
  setSettings: (settings: AppSettings) => void
  pushToast: (kind: Toast['kind'], message: string) => void
  removeToast: (id: string) => void
}

export const useVaultStore = create<VaultState>((set) => ({
  vault: null,
  notes: [],
  currentNotePath: null,
  currentNoteContent: '',
  searchQuery: '',
  searchResults: [],
  commandPaletteOpen: false,
  settings: {
    isSidebarCollapsed: false,
    lastVaultPath: null,
    lastOpenedNotePath: null,
    lastOpenedProjectId: null,
    favoriteNotePaths: [],
    favoriteProjectIds: [],
    profile: {
      name: ''
    },
    ai: {
      mistralApiKey: ''
    },
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    calendarTasks: [],
    projectIcons: {},
    projects: [],
    gridBoard: {
      viewport: {
        x: 0,
        y: 0,
        zoom: 1
      },
      items: []
    }
  },
  toasts: [],
  loading: false,
  setLoading: (loading) => set({ loading }),
  setVault: (vault) => set({ vault }),
  setNotes: (notes) => set({ notes }),
  setCurrentNotePath: (currentNotePath) => set({ currentNotePath }),
  setCurrentNoteContent: (content) =>
    set((state) => ({
      currentNoteContent:
        typeof content === 'function' ? content(state.currentNoteContent) : content
    })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setSettings: (settings) => set({ settings }),
  pushToast: (kind, message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: `${Date.now()}-${Math.random()}`, kind, message }]
    })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}))
