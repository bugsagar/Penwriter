export type ElementType =
  | 'SCENE_HEADING'
  | 'ACTION'
  | 'CHARACTER'
  | 'DIALOGUE'
  | 'PARENTHETICAL'
  | 'TRANSITION'
  | 'SHOT'

export type ProjectType = 'feature' | 'short' | 'tv'

export interface ScreenplayElement {
  id: string
  type: ElementType
  text: string
  /** Inline style overrides. All optional so older saved projects keep working. */
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: TextAlign
  /** Hex text color, e.g. '#1a1a1a'. Undefined = default ink. */
  color?: string
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify'

export type DocFontFamily = 'serif' | 'courier-prime' | 'courier-new' | 'system-mono'

export interface Character {
  id: string
  name: string
  notes: string
  manual: boolean
}

/**
 * The screenplay is stored as an ordered list of typed elements.
 * A SCENE_HEADING element starts a new scene; every element after it
 * (until the next SCENE_HEADING) belongs to that scene. Scene metadata
 * (notes) is keyed by the heading element's id.
 */
export interface Project {
  id: string
  title: string
  author: string
  description: string
  type: ProjectType
  createdAt: number
  updatedAt: number
  elements: ScreenplayElement[]
  sceneNotes: Record<string, string>
  characters: Character[]
  /** True when the writer chose "Save on computer" — a .reel file on disk. */
  savedOnComputer?: boolean
  settings: {
    theme: 'light' | 'dark'
    showSceneNumbers: boolean
    autoDetectElements: boolean
    fontFamily: DocFontFamily
    fontSizePt: number
  }
}

export interface Scene {
  id: string
  headingElementId: string
  heading: string
  number: number
  elementIds: string[]
  notes: string
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

export interface ProjectStats {
  words: number
  pages: number
  minutes: number
}

export interface FolderInfo {
  path: string | null
  name: string | null
}
