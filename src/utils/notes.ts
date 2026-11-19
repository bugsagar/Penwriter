import type { PageNote } from '../types'
import type { SheetPart } from './layout'

/** The page a note is on now: wherever its anchor text has flowed to. */
export function notePage(note: PageNote, sheets: SheetPart[][]): number {
  for (let pi = 0; pi < sheets.length; pi++) {
    for (const part of sheets[pi]) {
      if (part.el.id !== note.anchorId) continue
      const last = part.end >= part.el.text.length
      if (note.anchorOffset >= part.start && (note.anchorOffset < part.end || last)) return pi
    }
  }
  // its line was deleted: keep it on the page it was written for
  return Math.min(Math.max(0, note.pageHint), Math.max(0, sheets.length - 1))
}

/**
 * Where a new note on page `pi` is anchored: the selected line if it is on
 * that page, otherwise the page's first line (or, for a page that is all
 * continuation of a long paragraph, that paragraph at this page's start).
 */
export function anchorForPage(
  sheets: SheetPart[][],
  pi: number,
  selectedId: string | null,
): { anchorId: string; anchorOffset: number } | null {
  const page = sheets[pi] ?? []
  const sel = selectedId ? page.find((p) => p.el.id === selectedId) : undefined
  const part = sel ?? page[0]
  return part ? { anchorId: part.el.id, anchorOffset: part.start } : null
}

/** Open (unticked) notes per page, for the markers on the pages. */
export function openNotesByPage(notes: PageNote[] | undefined, sheets: SheetPart[][]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const n of notes ?? []) {
    if (n.done) continue
    const p = notePage(n, sheets)
    out[p] = (out[p] ?? 0) + 1
  }
  return out
}
