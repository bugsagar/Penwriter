import type { ElementType, ScreenplayElement } from '../types'

export const PAGE_W = 612
export const PAGE_H = 792
export const MARGIN_L = 108
export const MARGIN_R = 72
export const MARGIN_T = 72
export const MARGIN_B = 72
export const FONT_SIZE = 12
export const LINE_H = 12
export const BLOCK_SPACING = 12
export const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R
export const CONTENT_H = PAGE_H - MARGIN_T - MARGIN_B
/** Line spacing, as a multiple of the font size — the same as the editor's
 *  pages (CSS line-height 1.35), so pages fill exactly as far as they show. */
export const LEADING = 1.35
export const LINES_PER_PAGE = Math.floor(CONTENT_H / (LINE_H * LEADING))

/** Every element type renders at the base size (as in the editor). */
export function scaleFor(_type: ElementType): number {
  return 1
}

export function sizeFor(type: ElementType): number {
  return FONT_SIZE * scaleFor(type)
}

export interface ElementLayout {
  x: number
  width: number
  align: 'left' | 'right'
  indent: number
}

export function layoutFor(type: ElementType): ElementLayout {
  switch (type) {
    case 'CHARACTER':
      return { x: MARGIN_L, width: CONTENT_W, align: 'left', indent: 2.5 }
    case 'DIALOGUE': {
      const width = 3.5 * 72
      return { x: MARGIN_L + (CONTENT_W - width) / 2, width, align: 'left', indent: 2.5 }
    }
    case 'PARENTHETICAL':
      return { x: MARGIN_L + 2.35 * 72, width: 2.5 * 72, align: 'left', indent: 2.35 }
    case 'TRANSITION':
      return { x: MARGIN_L + 2 * 72, width: 2.5 * 72, align: 'right', indent: 2 }
    case 'SCENE_HEADING':
    case 'ACTION':
    case 'SHOT':
    default:
      return { x: MARGIN_L, width: CONTENT_W, align: 'left', indent: 1.5 }
  }
}

const ctxCache = new Map<number, CanvasRenderingContext2D | null>()
let mlFamily = 'Noto Sans Malayalam'

/**
 * Measure Malayalam in the script's Malayalam font (line wrapping and page
 * breaks follow it). Call again once that font has downloaded.
 */
export function setLayoutMalayalamFont(family: string, force = false): void {
  if (family === mlFamily && !force) return
  mlFamily = family
  ctxCache.clear()
}

function measureCtx(sizePt: number): CanvasRenderingContext2D {
  let ctx = ctxCache.get(sizePt)
  if (ctx === undefined) {
    const canvas = document.createElement('canvas')
    ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.font = `${sizePt * (4 / 3)}px "Courier Prime", "Courier New", "${mlFamily}", monospace`
    }
    ctxCache.set(sizePt, ctx)
  }
  return ctx as CanvasRenderingContext2D
}

export function textWidth(text: string, sizePt: number = FONT_SIZE): number {
  return measureCtx(sizePt).measureText(text).width * (3 / 4)
}

export interface WrappedLine {
  text: string
  /** where the line starts and ends in the original text */
  start: number
  end: number
}

/** Word-wrap like wrapText, keeping each line's position in the original text. */
export function wrapLines(text: string, maxWidthPt: number, sizePt: number = FONT_SIZE): WrappedLine[] {
  if (!text.trim()) return [{ text: '', start: 0, end: text.length }]
  // Respect explicit line breaks (e.g. multi-line dialogue via Enter).
  const lines: WrappedLine[] = []
  let paraStart = 0
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      lines.push({ text: '', start: paraStart, end: paraStart + para.length })
    } else {
      let line = ''
      let lineStart = 0
      let lineEnd = 0
      for (const m of para.matchAll(/\S+/g)) {
        const word = m[0]
        const ws = paraStart + (m.index ?? 0)
        const trial = line ? `${line} ${word}` : word
        if (!line || textWidth(trial, sizePt) <= maxWidthPt) {
          if (!line) lineStart = ws
          line = trial
        } else {
          lines.push({ text: line, start: lineStart, end: lineEnd })
          line = word
          lineStart = ws
        }
        lineEnd = ws + word.length
      }
      if (line) lines.push({ text: line, start: lineStart, end: lineEnd })
    }
    paraStart += para.length + 1
  }
  return lines.length ? lines : [{ text: '', start: 0, end: text.length }]
}

export function wrapText(text: string, maxWidthPt: number, sizePt: number = FONT_SIZE): string[] {
  return wrapLines(text, maxWidthPt, sizePt).map((l) => l.text)
}

export interface PagedItem {
  element: ScreenplayElement
  lines: string[]
  /** The part of the element's text on this page (a long paragraph can
   *  continue onto the next page). */
  start: number
  end: number
}

export interface Page {
  items: PagedItem[]
  usedPt: number
}

/** The height of one line of text at this size. */
export function lineH(sizePt: number): number {
  return sizePt * LEADING
}

function elementPt(lines: number, sizePt: number): number {
  return Math.max(lines, 1) * lineH(sizePt) + BLOCK_SPACING
}

function unitInfo(
  elements: ScreenplayElement[],
  start: number,
): { end: number; pt: number } {
  const first = elements[start]
  const firstSize = sizeFor(first.type)
  let pt = elementPt(wrapText(first.text, layoutFor(first.type).width, firstSize).length, firstSize)
  let end = start

  if (first.type === 'SCENE_HEADING') {
    const next = elements[start + 1]
    if (next) {
      const nextSize = sizeFor(next.type)
      pt += elementPt(wrapText(next.text, layoutFor(next.type).width, nextSize).length, nextSize)
      end = start + 1
    }
  } else if (first.type === 'CHARACTER') {
    let i = start + 1
    while (i < elements.length) {
      const t = elements[i].type
      if (t === 'PARENTHETICAL' || t === 'DIALOGUE') {
        const s = sizeFor(t)
        pt += elementPt(wrapText(elements[i].text, layoutFor(t).width, s).length, s)
        end = i
        i++
      } else {
        break
      }
    }
  }
  return { end, pt }
}

const SPLITTABLE = new Set<ElementType>(['ACTION', 'DIALOGUE', 'SHOT'])

export function paginate(elements: ScreenplayElement[]): Page[] {
  const pages: Page[] = []
  let page: Page = { items: [], usedPt: 0 }

  const newPage = () => {
    pages.push(page)
    page = { items: [], usedPt: 0 }
  }

  /*
   * Place an element. Paragraphs that don't fit are split at a line: what
   * fits stays on this page and the rest continues on the next, keeping at
   * least two lines on each side (no widows or orphans). Short blocks —
   * headings, character names, transitions — move to the next page whole.
   */
  const place = (el: ScreenplayElement) => {
    const size = sizeFor(el.type)
    const lines = wrapLines(el.text, layoutFor(el.type).width, size)
    const canSplit = SPLITTABLE.has(el.type)
    const push = (a: number, b: number) => {
      page.items.push({
        element: el,
        lines: lines.slice(a, b).map((l) => l.text),
        start: a === 0 ? 0 : lines[a].start,
        end: b >= lines.length ? el.text.length : lines[b].start,
      })
      page.usedPt += elementPt(b - a, size)
    }
    let from = 0
    for (;;) {
      const rest = lines.length - from
      if (page.usedPt + elementPt(rest, size) <= CONTENT_H) {
        push(from, lines.length)
        return
      }
      const empty = page.items.length === 0
      if (canSplit) {
        const room = Math.floor((CONTENT_H - page.usedPt - BLOCK_SPACING) / lineH(size))
        if (empty ? room >= 1 : room >= 2 && rest - room >= 2) {
          push(from, from + room)
          from += room
          newPage()
          continue
        }
      }
      if (empty) {
        push(from, lines.length) // taller than a page and can't split
        return
      }
      newPage()
    }
  }

  let i = 0
  while (i < elements.length) {
    const el = elements[i]
    // "New page": an explicit break before this element
    if (el.pageBreak && page.items.length > 0) newPage()
    const keepWithNext = el.type === 'SCENE_HEADING' || el.type === 'CHARACTER'
    const unit = keepWithNext ? unitInfo(elements, i) : null

    if (unit && unit.end > i) {
      const tail = elements[unit.end]
      const tailSize = sizeFor(tail.type)
      const tailLines = wrapText(tail.text, layoutFor(tail.type).width, tailSize).length
      // a heading or name needs its block to start on the same page; a
      // splittable block only needs its first two lines here
      const minPt = SPLITTABLE.has(tail.type) && tailLines > 2
        ? unit.pt - elementPt(tailLines, tailSize) + elementPt(2, tailSize)
        : unit.pt
      if (minPt <= CONTENT_H && page.usedPt + minPt > CONTENT_H && page.items.length > 0) {
        newPage()
      }
      for (let k = i; k <= unit.end; k++) {
        place(elements[k])
      }
      i = unit.end + 1
      continue
    }

    place(el)
    i++
  }

  if (page.items.length > 0) pages.push(page)
  return pages.length ? pages : [{ items: [], usedPt: 0 }]
}

/** One element's part on one sheet. */
export interface SheetPart {
  el: ScreenplayElement
  start: number
  end: number
}

/**
 * The editor's sheets: the same page breaks as the PDF (a page fills, then
 * continues on the next — a long paragraph splits across the two; "New
 * page" forces a break).
 */
export function sheetsOf(elements: ScreenplayElement[]): SheetPart[][] {
  const pages = paginate(elements).map((p) => p.items.map((it) => ({ el: it.element, start: it.start, end: it.end })))
  return pages.length ? pages : [[]]
}

export function countWords(elements: ScreenplayElement[]): number {
  let n = 0
  for (const el of elements) {
    if (el.type === 'SCENE_HEADING') continue
    n += el.text.trim() ? el.text.trim().split(/\s+/).length : 0
  }
  return n
}

export function pageCount(elements: ScreenplayElement[]): number {
  return paginate(elements).length
}
