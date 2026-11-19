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
export const LINES_PER_PAGE = Math.floor(CONTENT_H / LINE_H)

/** Dialogue renders 70% bigger than the base size, everywhere. */
export function scaleFor(type: ElementType): number {
  return type === 'DIALOGUE' ? 1.7 : 1
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

function measureCtx(sizePt: number): CanvasRenderingContext2D {
  let ctx = ctxCache.get(sizePt)
  if (ctx === undefined) {
    const canvas = document.createElement('canvas')
    ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.font = `${sizePt * (4 / 3)}px "Courier Prime", "Courier New", monospace`
    }
    ctxCache.set(sizePt, ctx)
  }
  return ctx as CanvasRenderingContext2D
}

export function textWidth(text: string, sizePt: number = FONT_SIZE): number {
  return measureCtx(sizePt).measureText(text).width * (3 / 4)
}

export function wrapText(text: string, maxWidthPt: number, sizePt: number = FONT_SIZE): string[] {
  if (!text.trim()) return ['']
  // Respect explicit line breaks (e.g. multi-line dialogue via Enter).
  const paragraphs = text.split('\n')
  const lines: string[] = []
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('')
      continue
    }
    const words = para.replace(/[ \t]+/g, ' ').trim().split(' ')
    let line = ''
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word
      if (textWidth(trial, sizePt) <= maxWidthPt) {
        line = trial
      } else {
        if (line) lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
  }
  return lines.length ? lines : ['']
}

export interface PagedItem {
  element: ScreenplayElement
  lines: string[]
}

export interface Page {
  items: PagedItem[]
  usedPt: number
}

function elementPt(lines: number, sizePt: number): number {
  return Math.max(lines, 1) * sizePt + BLOCK_SPACING
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

export function paginate(elements: ScreenplayElement[]): Page[] {
  const pages: Page[] = []
  let page: Page = { items: [], usedPt: 0 }

  const newPage = () => {
    pages.push(page)
    page = { items: [], usedPt: 0 }
  }

  const place = (el: ScreenplayElement) => {
    const size = sizeFor(el.type)
    const lines = wrapText(el.text, layoutFor(el.type).width, size)
    if (page.usedPt + elementPt(lines.length, size) > CONTENT_H && page.items.length > 0) {
      newPage()
    }
    page.items.push({ element: el, lines })
    page.usedPt += elementPt(lines.length, size)
  }

  let i = 0
  while (i < elements.length) {
    const el = elements[i]
    // "New page": an explicit break before this element
    if (el.pageBreak && page.items.length > 0) newPage()
    const keepWithNext = el.type === 'SCENE_HEADING' || el.type === 'CHARACTER'
    const unit = keepWithNext ? unitInfo(elements, i) : null

    if (unit && unit.end > i) {
      if (unit.pt <= CONTENT_H && page.usedPt + unit.pt > CONTENT_H) {
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

/**
 * The editor's sheets: the same page breaks as the PDF (a page fills, then
 * continues on the next; "New page" forces a break), as lists of elements.
 */
export function sheetsOf(elements: ScreenplayElement[]): ScreenplayElement[][] {
  const pages = paginate(elements).map((p) => p.items.map((it) => it.element))
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
