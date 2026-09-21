import { create } from 'zustand'
import type { Character, FolderInfo, Project, ProjectType, SaveStatus, ScreenplayElement } from '../types'
import { loadProjects, loadTheme, loadSession, saveTheme, saveSession } from '../utils/storage'
import { normalizeElements } from '../utils/scenes'
import { emptyProject, sampleProject } from '../utils/sample'
import { uid } from '../utils/id'

interface CreateInput {
  title: string
  author: string
  description: string
  type: ProjectType
}

interface HistoryEntry {
  elements: ScreenplayElement[]
  sceneNotes: Record<string, string>
}

interface AppStore {
  projects: Project[]
  activeProjectId: string | null
  view: 'home' | 'dashboard' | 'editor'
  saveStatus: SaveStatus
  theme: 'light' | 'dark'
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  saveFolder: FolderInfo

  openHome: () => void
  openDashboard: () => void
  openEditor: (id: string) => void
  createProject: (input: CreateInput) => string
  createSample: () => string
  deleteProject: (id: string) => void
  duplicateProject: (id: string) => string

  updateActive: (patch: Partial<Project>) => void
  updateElement: (id: string, patch: Partial<ScreenplayElement>) => void
  insertElements: (index: number, els: ScreenplayElement[]) => void
  removeElement: (id: string) => void
  removeElements: (ids: string[]) => void
  setElements: (els: ScreenplayElement[]) => void
  setSceneNote: (sceneId: string, note: string) => void
  setSavedOnComputer: (id: string, value: boolean) => void
  upsertCharacter: (name: string, notes?: string) => void
  updateCharacter: (id: string, patch: Partial<Character>) => void
  removeCharacter: (id: string) => void
  setProjectSettings: (patch: Partial<Project['settings']>) => void
  setSaveFolder: (path: string | null, name: string | null) => void
  undo: () => void
  redo: () => void
  markSaved: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

function touch(project: Project): Project {
  return { ...project, updatedAt: Date.now() }
}

function snapshot(state: AppStore): HistoryEntry | null {
  const id = state.activeProjectId
  const project = state.projects.find((p) => p.id === id)
  if (!project) return null
  return { elements: project.elements, sceneNotes: project.sceneNotes }
}

function mutate(
  state: AppStore,
  fn: (project: Project) => Project,
  recordHistory = true,
): Partial<AppStore> {
  const id = state.activeProjectId
  if (!id) return {}
  const prev = snapshot(state)
  const undoStack = recordHistory && prev ? [...state.undoStack.slice(-199), prev] : state.undoStack
  return {
    saveStatus: 'unsaved',
    undoStack,
    redoStack: [],
    projects: state.projects.map((p) => (p.id === id ? fn(p) : p)),
  }
}

export const useApp = create<AppStore>((set, get) => {
  const projects = loadProjects()
  const session = loadSession()
  const canRestore =
    session?.view === 'editor' &&
    session.activeProjectId &&
    projects.some((p) => p.id === session.activeProjectId)

  return {
    projects,
    activeProjectId: canRestore ? session!.activeProjectId : null,
    view: canRestore ? 'editor' : 'home',
    saveStatus: 'saved',
    theme: loadTheme(),
    undoStack: [],
    redoStack: [],
    saveFolder: { path: null, name: null },

    openHome: () => {
      saveSession({ view: 'home', activeProjectId: null })
      set({ view: 'home', activeProjectId: null })
    },

    openDashboard: () => {
      saveSession({ view: 'dashboard', activeProjectId: null })
      set({ view: 'dashboard', activeProjectId: null })
    },

    openEditor: (id) => {
      saveSession({ view: 'editor', activeProjectId: id })
      set({ view: 'editor', activeProjectId: id, undoStack: [], redoStack: [] })
    },

  createProject: (input) => {
    const project = emptyProject()
    project.title = input.title.trim() || 'Untitled Screenplay'
    project.author = input.author.trim()
    project.description = input.description.trim()
    project.type = input.type
    set((s) => ({ projects: [project, ...s.projects] }))
    return project.id
  },

  createSample: () => {
    const project = sampleProject()
    set((s) => ({ projects: [project, ...s.projects] }))
    return project.id
  },

  deleteProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    })),

  duplicateProject: (id) => {
    const src = get().projects.find((p) => p.id === id)
    if (!src) return id
    const copy: Project = {
      ...src,
      id: uid('proj'),
      title: `${src.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      elements: src.elements.map((el) => ({ ...el, id: uid('el') })),
      sceneNotes: { ...src.sceneNotes },
      characters: src.characters.map((c) => ({ ...c, id: uid('char') })),
    }
    set((s) => ({ projects: [copy, ...s.projects] }))
    return copy.id
  },

  updateActive: (patch) =>
    set((s) => mutate(s, (p) => touch({ ...p, ...patch }))),

  updateElement: (id, patch) =>
    set((s) =>
      mutate(s, (p) => ({
        ...p,
        elements: p.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      })),
    ),

  insertElements: (index, els) =>
    set((s) =>
      mutate(s, (p) => {
        const next = [...p.elements]
        next.splice(index, 0, ...els)
        return { ...p, elements: normalizeElements(next) }
      }),
    ),

  removeElement: (id) =>
    set((s) =>
      mutate(s, (p) => {
        const next = p.elements.filter((el) => el.id !== id)
        return { ...p, elements: normalizeElements(next) }
      }),
    ),

  removeElements: (ids) =>
    set((s) =>
      mutate(s, (p) => {
        const idSet = new Set(ids)
        const next = p.elements.filter((el) => !idSet.has(el.id))
        return { ...p, elements: normalizeElements(next) }
      }),
    ),

  setElements: (els) =>
    set((s) =>
      mutate(s, (p) => ({ ...p, elements: normalizeElements(els) })),
    ),

  setSceneNote: (sceneId, note) =>
    set((s) =>
      mutate(s, (p) => ({
        ...p,
        sceneNotes: { ...p.sceneNotes, [sceneId]: note },
      })),
    ),

  setSavedOnComputer: (id, value) =>
    set((s) => ({
      saveStatus: 'unsaved',
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, savedOnComputer: value, updatedAt: Date.now() } : p,
      ),
    })),

  upsertCharacter: (name, notes) =>
    set((s) =>
      mutate(s, (p) => {
        const clean = name.trim()
        if (!clean) return p
        const existing = p.characters.find(
          (c) => c.name.toLowerCase() === clean.toLowerCase(),
        )
        if (existing) {
          return {
            ...p,
            characters: p.characters.map((c) =>
              c.id === existing.id
                ? { ...c, notes: notes !== undefined ? notes : c.notes }
                : c,
            ),
          }
        }
        return {
          ...p,
          characters: [
            ...p.characters,
            { id: uid('char'), name: clean, notes: notes ?? '', manual: true },
          ],
        }
      }),
    ),

  updateCharacter: (id, patch) =>
    set((s) =>
      mutate(s, (p) => ({
        ...p,
        characters: p.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),
    ),

  removeCharacter: (id) =>
    set((s) =>
      mutate(s, (p) => ({
        ...p,
        characters: p.characters.filter((c) => c.id !== id),
      })),
    ),

  setProjectSettings: (patch) =>
    set((s) =>
      mutate(s, (p) => ({ ...p, settings: { ...p.settings, ...patch } })),
    ),

  setSaveFolder: (path, name) => set({ saveFolder: { path, name } }),

  markSaved: () => set({ saveStatus: 'saved' }),

  undo: () =>
    set((s) => {
      const id = s.activeProjectId
      if (!id || s.undoStack.length === 0) return {}
      const prev = s.undoStack[s.undoStack.length - 1]
      const project = s.projects.find((p) => p.id === id)
      if (!project) return {}
      return {
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [
          ...s.redoStack.slice(-199),
          { elements: project.elements, sceneNotes: project.sceneNotes },
        ],
        saveStatus: 'unsaved',
        projects: s.projects.map((p) =>
          p.id === id
            ? touch({ ...p, elements: prev.elements, sceneNotes: prev.sceneNotes })
            : p,
        ),
      }
    }),

  redo: () =>
    set((s) => {
      const id = s.activeProjectId
      if (!id || s.redoStack.length === 0) return {}
      const next = s.redoStack[s.redoStack.length - 1]
      const project = s.projects.find((p) => p.id === id)
      if (!project) return {}
      return {
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [
          ...s.undoStack.slice(-199),
          { elements: project.elements, sceneNotes: project.sceneNotes },
        ],
        saveStatus: 'unsaved',
        projects: s.projects.map((p) =>
          p.id === id
            ? touch({ ...p, elements: next.elements, sceneNotes: next.sceneNotes })
            : p,
        ),
      }
    }),

  setTheme: (theme) => {
    saveTheme(theme)
    set({ theme })
  },
  }
})
