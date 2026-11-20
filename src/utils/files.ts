import type { ElementType, Project } from '../types'
import { emptyProject } from './sample'

declare global {
  interface SaveFilePickerOptions {
    suggestedName?: string
    types?: { description?: string; accept: Record<string, string[]> }[]
  }
  interface OpenFilePickerOptions {
    multiple?: boolean
    excludeAcceptAllOption?: boolean
    types?: { description?: string; accept: Record<string, string[]> }[]
  }
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>
  }
}

/** Live File System Access handles, kept in memory for autosave writes. */
const handles = new Map<string, FileSystemFileHandle>()

export function supportsFilePicker(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}

export function hasFileHandle(id: string): boolean {
  return handles.has(id)
}

/** Marker written into every file so we only ever open our own format. */
export const FILE_FORMAT = 'reel-screenplay'
export const FILE_FORMAT_VERSION = 1
export const FILE_EXT = '.reel.json'

const FILE_TYPES = [
  { description: 'Ezuth screenplay', accept: { 'application/json': [FILE_EXT] } },
]

function serialize(project: Project): string {
  return JSON.stringify(
    { format: FILE_FORMAT, formatVersion: FILE_FORMAT_VERSION, ...project },
    null,
    2,
  )
}

const ELEMENT_TYPES = new Set<string>([
  'SCENE_HEADING',
  'ACTION',
  'CHARACTER',
  'DIALOGUE',
  'PARENTHETICAL',
  'TRANSITION',
  'SHOT',
] satisfies ElementType[])

export class FileFormatError extends Error {}

const NOT_OURS = `This isn't an Ezuth screenplay. Only ${FILE_EXT} files saved from Ezuth can be opened.`

/**
 * Parse and validate a screenplay file. Accepts files carrying our format
 * marker, plus older .reel.json files saved before the marker existed.
 */
export function parseProjectFile(text: string, fileName: string): Project {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new FileFormatError(NOT_OURS)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new FileFormatError(NOT_OURS)
  const d = data as Record<string, unknown>

  const marked = d.format === FILE_FORMAT
  const legacy = d.format === undefined && fileName.toLowerCase().endsWith(FILE_EXT)
  if (!marked && !legacy) throw new FileFormatError(NOT_OURS)
  if (marked && typeof d.formatVersion === 'number' && d.formatVersion > FILE_FORMAT_VERSION) {
    throw new FileFormatError('This screenplay was saved by a newer version of Ezuth.')
  }

  const els = d.elements
  const validEls =
    Array.isArray(els) &&
    els.every((e) => {
      const r = e as Record<string, unknown> | null
      return (
        !!r &&
        typeof r === 'object' &&
        typeof r.id === 'string' &&
        typeof r.text === 'string' &&
        ELEMENT_TYPES.has(r.type as string)
      )
    })
  if (typeof d.id !== 'string' || typeof d.title !== 'string' || !validEls) {
    throw new FileFormatError('This screenplay file is damaged and could not be opened.')
  }

  const base = emptyProject()
  const rest = { ...d }
  delete rest.format
  delete rest.formatVersion
  const p = rest as Partial<Project>
  const elements = p.elements as Project['elements']
  return {
    ...base,
    ...p,
    elements: elements.length ? elements : base.elements,
    sceneNotes: p.sceneNotes && typeof p.sceneNotes === 'object' ? p.sceneNotes : {},
    characters: Array.isArray(p.characters) ? p.characters : [],
    settings: { ...base.settings, ...(p.settings ?? {}) },
    type: p.type === 'feature' || p.type === 'tv' || p.type === 'short' ? p.type : 'short',
    savedOnComputer: true,
  }
}

/**
 * Let the writer pick a screenplay file with the File System Access API (so
 * autosave keeps writing to that same file). Returns 'unsupported' when the
 * browser needs the <input type=file> fallback, and null when cancelled.
 */
export async function pickOpenFile(): Promise<Project | null | 'unsupported'> {
  const picker = window.showOpenFilePicker
  if (!picker) return 'unsupported'
  let handle: FileSystemFileHandle
  try {
    ;[handle] = await picker({ multiple: false, types: FILE_TYPES, excludeAcceptAllOption: true })
  } catch {
    return null // cancelled
  }
  const file = await handle.getFile()
  const project = parseProjectFile(await file.text(), file.name)
  handles.set(project.id, handle)
  return project
}

/** Fallback path: read a File from an <input type="file">. */
export async function readProjectFile(file: File): Promise<Project> {
  return parseProjectFile(await file.text(), file.name)
}

function fileNameFor(project: Project): string {
  const base =
    project.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'screenplay'
  return `${base}${FILE_EXT}`
}

/** Ask the user where to keep the file, then write the project to it. */
export async function pickSaveFile(project: Project): Promise<boolean> {
  try {
    const picker = window.showSaveFilePicker
    if (!picker) return false
    const handle = await picker({
      suggestedName: fileNameFor(project),
      types: FILE_TYPES,
    })
    handles.set(project.id, handle)
    return await writeProjectFile(project)
  } catch {
    return false // cancelled or denied — project stays in the browser
  }
}

/** Overwrite the previously picked file with the latest project JSON. */
export async function writeProjectFile(project: Project): Promise<boolean> {
  const handle = handles.get(project.id)
  if (!handle) return false
  try {
    const writable = await handle.createWritable()
    await writable.write(serialize(project))
    await writable.close()
    return true
  } catch {
    handles.delete(project.id)
    return false
  }
}

/** Fallback for browsers without the File System Access API. */
export function downloadProjectFile(project: Project): void {
  const blob = new Blob([serialize(project)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileNameFor(project)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
