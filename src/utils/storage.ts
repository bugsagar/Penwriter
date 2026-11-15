import type { Project } from '../types'

const KEY = 'reel.projects.v1'
const THEME_KEY = 'reel.theme'
const SESSION_KEY = 'reel.session'
const CANVAS_KEY = 'reel.canvas'

export type CanvasStyle = 'paper' | 'typewriter'

export function loadCanvasStyle(): CanvasStyle {
  try {
    return localStorage.getItem(CANVAS_KEY) === 'typewriter' ? 'typewriter' : 'paper'
  } catch {
    return 'paper'
  }
}

export function saveCanvasStyle(style: CanvasStyle): void {
  try {
    localStorage.setItem(CANVAS_KEY, style)
  } catch {
    /* storage unavailable */
  }
}

export interface Session {
  view: 'home' | 'dashboard' | 'editor'
  activeProjectId: string | null
}

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // One-time move back to Courier Prime for scripts that were switched to
    // Times when it was briefly the default.
    const FONT_MIGRATION = 'reel.font.courier.v1'
    let migrate = false
    try {
      migrate = !localStorage.getItem(FONT_MIGRATION)
      if (migrate) localStorage.setItem(FONT_MIGRATION, '1')
    } catch {
      /* storage unavailable */
    }
    const result = (parsed as Project[]).map((p) => {
      const settings: Project['settings'] = {
        theme: 'light',
        showSceneNumbers: true,
        autoDetectElements: true,
        fontFamily: 'courier-prime',
        fontSizePt: 12,
        ...((p.settings ?? {}) as Partial<Project['settings']>),
      }
      if (migrate && settings.fontFamily === 'serif') settings.fontFamily = 'courier-prime'
      return { ...p, settings }
    })
    if (migrate) {
      try {
        localStorage.setItem(KEY, JSON.stringify(result)) // keep the switch even without an edit
      } catch {
        /* storage unavailable */
      }
    }
    return result
  } catch {
    return []
  }
}

export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(projects))
  } catch (err) {
    console.error('Failed to save projects', err)
  }
}

export function loadTheme(): 'light' | 'dark' {
  return (localStorage.getItem(THEME_KEY) as 'light' | 'dark') || 'light'
}

export function saveTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem(THEME_KEY, theme)
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
}
