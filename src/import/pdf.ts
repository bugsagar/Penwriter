import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { BLANK, rebaseIndents, type RawLine } from './classify'
import { ImportError } from './formats'

/*
 * PDF reader (pdf.js, loaded only when a PDF is imported). A PDF has no
 * paragraphs, only positioned text, so lines are rebuilt from positions:
 * - pieces at the same height form a line;
 * - a bigger vertical gap is a blank line;
 * - lines that wrap (same left edge, the line before ran to the margin) are
 *   joined into one paragraph;
 * - the left edge gives the indent: screenplay PDFs put names, dialogue and
 *   parentheticals at set indents.
 * Running headers/footers and page numbers are dropped, and a title page
 * gives the title.
 */

GlobalWorkerOptions.workerSrc = workerUrl

interface PLine {
  text: string
  x: number
  right: number
  y: number
  size: number
}

export interface PdfResult {
  lines: RawLine[]
  title?: string
  author?: string
  /** letters the PDF draws without saying which letters they are */
  unreadable: number
}

/*
 * Malayalam in PDFs: the vowel signs െ േ ൈ are drawn before their consonant,
 * and many PDFs list them in that drawn order ("േകരള" for "കേരള"). If the
 * file does (a sign at the start of a word gives it away), put them back
 * after their consonant, joining the two-part vowels (െ…ാ = ൊ).
 */
const ML_C = '[\\u0D15-\\u0D39\\uFFFD]'
const ML_VISUAL_RE = new RegExp(`([\\u0D46\\u0D47\\u0D48])(${ML_C}(?:\\u0D4D${ML_C})*)([\\u0D3E\\u0D57])?`, 'g')
const TWO_PART: Record<string, string> = { '\u0D46\u0D3E': '\u0D4A', '\u0D47\u0D3E': '\u0D4B', '\u0D46\u0D57': '\u0D4C' }

function fixMalayalamOrder(t: string): string {
  return t.replace(ML_VISUAL_RE, (_, sign: string, cons: string, after?: string) => {
    if (after && TWO_PART[sign + after]) return cons + TWO_PART[sign + after]
    return cons + sign + (after ?? '')
  })
}

const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

function buildLines(items: TextItem[]): PLine[] {
  const pieces = items
    .filter((it) => it.str.length > 0)
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height || 10 }))
    .sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: { y: number; h: number; parts: typeof pieces }[] = []
  for (const p of pieces) {
    const line = lines.find((l) => Math.abs(l.y - p.y) <= Math.max(2, Math.min(l.h, p.h) * 0.35))
    if (line) line.parts.push(p)
    else lines.push({ y: p.y, h: p.h, parts: [p] })
  }
  return lines
    .map((l) => {
      const parts = l.parts.sort((a, b) => a.x - b.x)
      let text = ''
      let end = -Infinity
      for (const p of parts) {
        const gap = p.x - end
        // a real word gap (Indic glyphs are often split into pieces with small gaps)
        if (text && gap > p.h * 0.25 && !/\s$/.test(text) && !/^[\s\p{M}]/u.test(p.str) && !/[\u0D4D\u200C\u200D]$/.test(text)) text += ' '
        text += p.str
        end = Math.max(end, p.x + p.w)
      }
      const first = parts.find((p) => p.str.trim()) ?? parts[0]
      return { text: text.trim(), x: first.x, right: end, y: l.y, size: l.h }
    })
    .filter((l) => l.text)
    .sort((a, b) => b.y - a.y)
}

const HEADING_HINT = /^(?:\d+[A-Z]?[.)]?\s+)?(?:INT|EXT|I\/E)\b|^(?:SCENE|SC|രംഗം|സീൻ)\s*\d/i

export async function readPdf(buf: ArrayBuffer): Promise<PdfResult> {
  let pdf
  try {
    pdf = await getDocument({ data: new Uint8Array(buf), useWasm: false, isOffscreenCanvasSupported: false }).promise
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (/password/i.test(msg)) throw new ImportError('This PDF is password-protected. Remove the password and try again.')
    throw new ImportError('This PDF could not be read.')
  }

  const pages: { lines: PLine[]; width: number; height: number }[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const { width, height } = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    pages.push({ lines: buildLines(content.items.filter((i): i is TextItem => 'str' in i)), width, height })
    page.cleanup()
  }
  void pdf.destroy()

  const chars = pages.reduce((n, p) => n + p.lines.reduce((m, l) => m + l.text.length, 0), 0)
  if (chars < 20) {
    throw new ImportError('No text found in this PDF. It may be a scanned image — Ezuth can only import PDFs that have real text.')
  }

  // Glyphs with no text behind them come out as U+0000.
  let unreadable = 0
  const visualOrder = pages.some((p) => p.lines.some((l) => /(^|\s)[\u0D46-\u0D48]/.test(l.text)))
  for (const p of pages)
    for (const l of p.lines) {
      l.text = l.text
        .replace(/[\u0000\uFFFD]/g, () => (unreadable++, '\uFFFD'))
        // spaces that can't be real: before a vowel sign / anusvara, or
        // (drawn order) right after a sign that goes before its consonant
        .replace(visualOrder ? / +(?=(?![\u0D46-\u0D48])\p{M})/gu : / +(?=\p{M})/gu, '')
      if (visualOrder) l.text = fixMalayalamOrder(l.text.replace(/([\u0D46-\u0D48]) +/g, '$1'))
    }

  // Running headers/footers: the same text at the same height on many pages.
  const repeats = new Map<string, number>()
  const keyOf = (l: PLine) => `${Math.round(l.y / 4)}|${l.text.replace(/\d+/g, '#')}`
  for (const p of pages) for (const k of new Set(p.lines.map(keyOf))) repeats.set(k, (repeats.get(k) ?? 0) + 1)
  const isRunning = (l: PLine) => pages.length >= 3 && (repeats.get(keyOf(l)) ?? 0) >= Math.max(3, pages.length * 0.5)

  // Title page: a first page with no scenes, before the script starts.
  let title: string | undefined
  let author: string | undefined
  let start = 0
  if (pages.length > 1) {
    const first = pages[0].lines.filter((l) => !isRunning(l))
    if (first.length > 0 && first.length <= 25 && !first.some((l) => HEADING_HINT.test(l.text))) {
      start = 1
      const biggest = Math.max(...first.map((l) => l.size))
      title = first.find((l) => l.size === biggest)?.text ?? first[0].text
      const byIdx = first.findIndex((l) => /^(written )?by\b|^(എഴുതിയത്|രചന)/i.test(l.text))
      if (byIdx >= 0) {
        const inline = first[byIdx].text.replace(/^(written )?by\s*:?\s*|^(എഴുതിയത്|രചന)\s*:?\s*/i, '').trim()
        author = inline || first[byIdx + 1]?.text
      }
    }
  }

  const out: RawLine[] = []
  for (let n = start; n < pages.length; n++) {
    const { lines: all, width } = pages[n]
    const lines = all.filter((l) => !isRunning(l))
    const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y).filter((g) => g > 0)
    // one line's height: the usual gap between lines, or (when every line is
    // its own paragraph) what the font size implies
    const lineH = Math.min(median(gaps.filter((g) => g <= median(gaps) * 1.2)) || 12, (median(lines.map((l) => l.size)) || 12) * 1.35)
    // the widest a line gets at each left edge = where text wraps
    const maxRight = new Map<number, number>()
    for (const l of lines) {
      const k = Math.round(l.x / 6)
      maxRight.set(k, Math.max(maxRight.get(k) ?? 0, l.right))
    }

    let prev: PLine | null = null
    for (const l of lines) {
      const align: RawLine['align'] =
        Math.abs((l.x + l.right) / 2 - width / 2) < 14 && l.right - l.x < width * 0.45 && l.x > width * 0.25
          ? 'center'
          : l.x > width * 0.55 && l.right > width - 108
            ? 'right'
            : 'left'
      if (prev) {
        const gap = prev.y - l.y
        const sameEdge = Math.abs(prev.x - l.x) <= 4
        const prevReachedEdge = prev.right >= (maxRight.get(Math.round(prev.x / 6)) ?? prev.right) - 0.3 * Math.max(72, (maxRight.get(Math.round(prev.x / 6)) ?? prev.right) - prev.x)
        const last = out[out.length - 1]
        const wraps =
          gap <= lineH * 1.3 &&
          sameEdge &&
          prevReachedEdge &&
          last?.text &&
          !/[:：]$/.test(last.text) &&
          !HEADING_HINT.test(last.text) &&
          !/^\(.*\)$/.test(last.text)
        if (wraps) {
          last.text += (/[-­]$/.test(last.text) ? '' : ' ') + l.text
          prev = l
          continue
        }
        if (gap > lineH * 1.5) out.push(BLANK)
      }
      // (no blank at a page turn: speeches and paragraphs carry over)
      out.push({ text: l.text, indent: l.x / 72, align })
      prev = l
    }
  }
  return { lines: rebaseIndents(out), title, author, unreadable }
}
