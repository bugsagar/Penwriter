import { useEffect } from 'react'
import { useApp } from '../store/useApp'
import { saveProjects } from '../utils/storage'
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
    void syncNow()
  }
}

/**
 * Debounced autosave of files on the computer ("Save on computer"), and — only
 * when cloud saving isn't set up — of the browser copy. Cloud saving itself
 * lives in useCloud.
 */
export function useAutosave() {
  const projects = useApp((s) => s.projects)
  const saveStatus = useApp((s) => s.saveStatus)
  const markSaved = useApp((s) => s.markSaved)
  const authStatus = useApp((s) => s.authStatus)

  useEffect(() => {
    if (saveStatus !== 'unsaved') return
    const t = setTimeout(() => {
      for (const p of projects) {
        if (p.savedOnComputer && hasFileHandle(p.id)) void writeProjectFile(p)
      }
      if (authStatus === 'local') {
        saveProjects(projects)
        markSaved()
      }
    }, 700)
    return () => clearTimeout(t)
  }, [projects, saveStatus, markSaved, authStatus])

  useEffect(() => {
    const flush = () => {
      if (useApp.getState().authStatus === 'local') saveProjects(useApp.getState().projects)
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
