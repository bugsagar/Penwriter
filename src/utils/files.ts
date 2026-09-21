import type { Project } from '../types'

declare global {
  interface SaveFilePickerOptions {
    suggestedName?: string
    types?: { description?: string; accept: Record<string, string[]> }[]
  }
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
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

function fileNameFor(project: Project): string {
  const base =
    project.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'screenplay'
  return `${base}.reel.json`
}

/** Ask the user where to keep the file, then write the project to it. */
export async function pickSaveFile(project: Project): Promise<boolean> {
  try {
    const picker = window.showSaveFilePicker
    if (!picker) return false
    const handle = await picker({
      suggestedName: fileNameFor(project),
      types: [
        {
          description: 'Reel screenplay',
          accept: { 'application/json': ['.reel.json', '.json'] },
        },
      ],
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
    await writable.write(JSON.stringify(project, null, 2))
    await writable.close()
    return true
  } catch {
    handles.delete(project.id)
    return false
  }
}

/** Fallback for browsers without the File System Access API. */
export function downloadProjectFile(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
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
