import { useEffect } from 'react'
import { useApp } from '../store/useApp'
import { saveComputerProjects, saveProjects } from '../utils/storage'
import { hasFileHandle, writeProjectFile } from '../utils/files'
import { syncNow } from './useCloud'

/** Save everything now: the cloud (or this browser, without cloud) and any linked files on the computer. */
export function saveNow() {
  const { projects, authStatus, markSaved } = useApp.getState()
  for (const p of projects) {
    if (p.savedOnComputer && hasFileHandle(p.id)) void writeProjectFile(p)
  }
  if (authStatus === 'local') {
    saveProjects(projects)
    markSaved()
  } else if (authStatus === 'signedIn') {
    saveComputerProjects(projects)
    void syncNow()
  }
}

/**
 * Debounced autosave of files on the computer ("Save on computer"), and — only
 * when cloud saving isn't set up — of the browser copy. Cloud saving itself
 * lives in useCloud.
 */
/** Computer files already written with this exact version of the script. */
const written = new Map<string, unknown>()

export function useAutosave() {
  const projects = useApp((s) => s.projects)
  const markSaved = useApp((s) => s.markSaved)
  const authStatus = useApp((s) => s.authStatus)

  // Runs on every change (not only while "unsaved"): the cloud sync can mark
  // things saved first, and computer files must still be written.
  useEffect(() => {
    if (authStatus === 'loading' || authStatus === 'signedOut') return
    const t = setTimeout(() => {
      for (const p of projects) {
        if (p.savedOnComputer && written.get(p.id) !== p && hasFileHandle(p.id)) {
          written.set(p.id, p)
          void writeProjectFile(p)
        }
      }
      if (authStatus === 'local') {
        saveProjects(projects)
        if (useApp.getState().saveStatus === 'unsaved') markSaved()
      } else {
        saveComputerProjects(projects)
      }
    }, 700)
    return () => clearTimeout(t)
  }, [projects, markSaved, authStatus])

  useEffect(() => {
    const flush = () => {
      const { authStatus: a, projects: all } = useApp.getState()
      if (a === 'local') saveProjects(all)
      else if (a === 'signedIn') saveComputerProjects(all)
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])
}

/** Applies the active theme class to the document root. */
export function useTheme() {
  const theme = useApp((s) => s.theme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
}
