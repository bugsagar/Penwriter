import { useEffect } from 'react'
import { useApp } from '../store/useApp'
import { saveProjects } from '../utils/storage'
import { hasFileHandle, writeProjectFile } from '../utils/files'

/** Debounced autosave + flush on unload. */
export function useAutosave() {
  const projects = useApp((s) => s.projects)
  const saveStatus = useApp((s) => s.saveStatus)
  const markSaved = useApp((s) => s.markSaved)

  useEffect(() => {
    if (saveStatus !== 'unsaved') return
    const t = setTimeout(() => {
      saveProjects(projects)
      for (const p of projects) {
        if (p.savedOnComputer && hasFileHandle(p.id)) void writeProjectFile(p)
      }
      markSaved()
    }, 700)
    return () => clearTimeout(t)
  }, [projects, saveStatus, markSaved])

  useEffect(() => {
    const flush = () => {
      saveProjects(useApp.getState().projects)
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
