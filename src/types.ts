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
  /** Start a new page before this element (set by "New page"). */
  pageBreak?: boolean
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify'

export type DocFontFamily = 'serif' | 'courier-prime' | 'courier-new' | 'system-mono' | 'malayalam'

export type MalayalamFont = 'noto-sans' | 'noto-serif' | 'manjari' | 'gayathri' | 'anek' | 'baloo-chettan' | 'chilanka' | 'arima' | 'google-sans'

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
/**
 * A note beside a page. Pages reflow as you write, so a note is anchored to
 * a spot in the text (a line, and a position in it) and shows on whichever
 * page that spot is on.
 */
export interface PageNote {
  id: string
  anchorId: string
  anchorOffset: number
  /** the page it was written on, used if its line is deleted */
  pageHint: number
  text: string
  done: boolean
  createdAt: number
}

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
  /** Notes kept beside pages, to check later. Never exported. */
  pageNotes?: PageNote[]
  characters: Character[]
  /** True when the writer chose "Save on computer" — a .reel file on disk. */
  savedOnComputer?: boolean
  settings: {
    theme: 'light' | 'dark'
    showSceneNumbers: boolean
    autoDetectElements: boolean
    fontFamily: DocFontFamily
    /** font for Malayalam letters (English keeps fontFamily); unset = Noto Sans Malayalam */
    malayalamFont?: MalayalamFont
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
