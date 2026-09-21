import type { Project, Scene, ScreenplayElement } from '../types'
import { uid } from './id'

/**
 * Derive scenes from the flat element list. A SCENE_HEADING element opens a
 * new scene; every element until the next heading belongs to it. The project
 * is normalized so the first element is always a SCENE_HEADING.
 */
export function deriveScenes(project: Project): Scene[] {
  const scenes: Scene[] = []
  let current: Scene | null = null

  for (const el of project.elements) {
    if (el.type === 'SCENE_HEADING') {
      current = {
        id: el.id,
        headingElementId: el.id,
        heading: el.text,
        number: scenes.length + 1,
        elementIds: [],
        notes: project.sceneNotes[el.id] ?? '',
      }
      scenes.push(current)
    } else if (current) {
      current.elementIds.push(el.id)
    }
  }

  return scenes
}

/** Ensure the element list always starts with a scene heading. */
export function normalizeElements(elements: ScreenplayElement[]): ScreenplayElement[] {
  if (elements.length === 0) {
    return [{ id: uid('el'), type: 'SCENE_HEADING', text: '' }]
  }
  if (elements[0].type !== 'SCENE_HEADING') {
    return [{ id: uid('el'), type: 'SCENE_HEADING', text: '' }, ...elements]
  }
  return elements
}

export function headingForScene(scene: Scene): string {
  return scene.heading.trim() ? scene.heading : `Untitled Scene ${scene.number}`
}

export function findSceneIndex(elements: ScreenplayElement[], elementId: string): number {
  let headingIndex = -1
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].type === 'SCENE_HEADING') {
      headingIndex = i
    }
    if (elements[i].id === elementId) {
      return headingIndex
    }
  }
  return -1
}

export function sceneChunks(elements: ScreenplayElement[]): ScreenplayElement[][] {
  const chunks: ScreenplayElement[][] = []
  let cur: ScreenplayElement[] = []
  for (const el of elements) {
    if (el.type === 'SCENE_HEADING') {
      if (cur.length) chunks.push(cur)
      cur = [el]
    } else {
      cur.push(el)
    }
  }
  if (cur.length) chunks.push(cur)
  return chunks
}

/** Move a scene (identified by its heading element id) to a new 0-based position. */
export function moveScene(
  elements: ScreenplayElement[],
  headingId: string,
  targetIndex: number,
): ScreenplayElement[] {
  const chunks = sceneChunks(elements)
  const srcIdx = chunks.findIndex((c) => c[0]?.id === headingId)
  if (srcIdx === -1) return elements
  const [moved] = chunks.splice(srcIdx, 1)
  let insertAt = targetIndex
  if (srcIdx < targetIndex) insertAt = targetIndex - 1
  insertAt = Math.max(0, Math.min(insertAt, chunks.length))
  chunks.splice(insertAt, 0, moved)
  return chunks.flat()
}

/** Duplicate a scene, returning the new element list and the new heading id. */
export function duplicateScene(
  elements: ScreenplayElement[],
  headingId: string,
): { elements: ScreenplayElement[]; newHeadingId: string } {
  const chunks = sceneChunks(elements)
  const idx = chunks.findIndex((c) => c[0]?.id === headingId)
  if (idx === -1) return { elements, newHeadingId: headingId }
  const copy = chunks[idx].map((el) => ({ ...el, id: uid('el') }))
  const newHeadingId = copy[0].id
  chunks.splice(idx + 1, 0, copy)
  return { elements: chunks.flat(), newHeadingId }
}

/** Remove a whole scene and all its elements. */
export function removeSceneElements(
  elements: ScreenplayElement[],
  headingId: string,
): ScreenplayElement[] {
  const chunks = sceneChunks(elements)
  const idx = chunks.findIndex((c) => c[0]?.id === headingId)
  if (idx === -1) return elements
  chunks.splice(idx, 1)
  return normalizeElements(chunks.flat())
}
