import type { ElementType } from '../types'
import { isCharacterLine, isTransition } from '../utils/detect'

/*
 * Turns the lines of an imported document (Word, PDF, text) into screenplay
 * elements. Readers describe each paragraph with what they know about its
 * layout (indent, alignment, the Word style name); this decides what it is.
 *
 * Works for screenplay-formatted files (indents, ALL CAPS names) and for
 * plain documents, as Malayalam scripts often are: names on their own line or
 * as "Name: speech", recognised because they repeat.
 */

export interface RawLine {
  text: string
  /** inches from the page's main left margin, when known */
  indent?: number
  align?: 'left' | 'center' | 'right'
  /** the element type a Word style named outright (Final Draft, Highland…) */
  styleType?: ElementType
  /** a forced Fountain element */
  forced?: ElementType
}

/**
 * Measure indents from the text's main left edge: the leftmost indent that a
 * good share (10%) of lines start at. (Not the most common one: in a
 * dialogue-heavy script that is the dialogue indent.)
 */
export function rebaseIndents(lines: RawLine[]): RawLine[] {
  const counts = new Map<number, number>()
  let total = 0
  for (const l of lines) {
    if (!l.text.trim() || l.indent === undefined || l.align === 'center' || l.align === 'right') continue
    const k = Math.round(l.indent * 10)
    counts.set(k, (counts.get(k) ?? 0) + 1)
    total++
  }
  const keys = [...counts.keys()].sort((a, b) => a - b)
  const base = (keys.find((k) => counts.get(k)! >= total * 0.1) ?? keys[0] ?? 0) / 10
  return lines.map((l) => (l.indent === undefined ? l : { ...l, indent: Math.max(0, l.indent - base) }))
}

/** A blank line: separates blocks. */
export const BLANK: RawLine = { text: '' }

export interface Classified {
  type: ElementType
  text: string
}

// INT./EXT. (also numbered "12 INT." / "12. INT."), SCENE 4, SC 4,
// and the Malayalam words for scene.
const HEADING_RE =
  /^(?:\d+[A-Z]?[.)]?\s+)?(?:INT|EXT|INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\/E|EST)\b[.\s/-]/i
const SCENE_WORD_RE = /^(?:SCENE|SC|രംഗം|സീൻ|സീന്‍|ദൃശ്യം)\s*(?:NO\.?\s*)?[-:.]?\s*\d+/i
const PAREN_RE = /^\(.*\)$/s
const SENTENCE_END_RE = /[.!?।,;]$/
const PAGE_NOISE_RE = /^(?:\d+\.?|page \d+( of \d+)?|\(MORE\)|\(CONT['’]D\)|CONTINUED:?|\(CONTINUED\))$/i
const CONTD_RE = /\s*\((?:CONT['’]?D|CONTINUED|cont['’]d)\)\s*$/i

const clean = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length
const nameKey = (s: string) => clean(s).replace(CONTD_RE, '').replace(/[:：]$/, '').toLowerCase()

export function isHeadingText(t: string): boolean {
  return HEADING_RE.test(t) || SCENE_WORD_RE.test(t)
}

/** Strip scene numbers printed around a heading: "12 INT. HOUSE - DAY 12" (but keep "SCENE 12") */
function cleanHeading(t: string): string {
  if (SCENE_WORD_RE.test(t)) return t.trim()
  return t
    .replace(/^\d+[A-Z]?[.)]?\s+(?=INT|EXT|I\/E|EST)/i, '')
    .replace(/\s+\d+[A-Z]?\.?$/, '')
    .trim()
}

/** Could this short line be a character's name (in any script)? */
function nameShaped(t: string): boolean {
  const s = t.replace(/[:：]$/, '').replace(CONTD_RE, '').trim()
  return (
    s.length >= 1 &&
    s.length <= 30 &&
    wordCount(s) <= 4 &&
    !SENTENCE_END_RE.test(s) &&
    !/\d/.test(s) &&
    !isHeadingText(s) &&
    !isTransition(s) &&
    !PAREN_RE.test(s)
  )
}

/** "Name: speech" / "Name (softly): speech" */
const INLINE_RE = /^([^:：()]{1,30}?)\s*(\([^)]{1,40}\))?\s*[:：]\s*(\S.*)$/s

export function classify(input: RawLine[]): Classified[] {
  const lines = input.map((l) => ({ ...l, text: clean(l.text) })).filter((l) => !PAGE_NOISE_RE.test(l.text))

  const nonBlank = lines.filter((l) => l.text)
  // Screenplay-formatted file: a fair share of lines sit well to the right.
  const indented = nonBlank.filter((l) => (l.indent ?? 0) >= 0.8 || l.align === 'center')
  const indentMode = nonBlank.length > 0 && indented.length / nonBlank.length >= 0.15

  // Names that repeat are characters: count standalone short lines that are
  // followed straight away by text, and "Name:" prefixes.
  const counts = new Map<string, number>()
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1)
  let inlineLines = 0
  lines.forEach((l, i) => {
    const next = lines[i + 1]
    if (l.text && next?.text && nameShaped(l.text)) bump(nameKey(l.text))
    const m = INLINE_RE.exec(l.text)
    if (m && wordCount(m[1]) <= 3 && !/\d/.test(m[1])) {
      bump(nameKey(m[1]))
      inlineLines++
    }
  })
  const isName = (t: string) => (counts.get(nameKey(t)) ?? 0) >= 2
  // "Name: speech" — the name repeats somewhere, or the file is written as
  // an exchange of such lines (short names only).
  const isInlineName = (t: string) => isName(t) || (inlineLines >= 3 && wordCount(t) <= 2)

  const out: Classified[] = []
  const push = (type: ElementType, text: string) => text && out.push({ type, text })
  let inDialogue = false

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const t = l.text
    if (!t) {
      inDialogue = false
      continue
    }
    const next = lines[i + 1]
    const hasNext = !!next?.text
    const indent = l.indent ?? 0
    const typed = l.forced ?? l.styleType

    if (typed) {
      if (typed === 'SCENE_HEADING') push(typed, cleanHeading(t))
      else if (typed === 'CHARACTER') push(typed, t.replace(CONTD_RE, '').replace(/[:：]$/, ''))
      else push(typed, t)
      inDialogue = typed === 'CHARACTER' || typed === 'DIALOGUE' || typed === 'PARENTHETICAL'
      continue
    }

    if (isHeadingText(t)) {
      push('SCENE_HEADING', cleanHeading(t))
      inDialogue = false
      continue
    }

    if (isTransition(t) || (l.align === 'right' && /:$/.test(t) && t.length <= 30)) {
      push('TRANSITION', t)
      inDialogue = false
      continue
    }

    if (PAREN_RE.test(t) && t.length <= 80 && (inDialogue || (indentMode && indent >= 1.1))) {
      push('PARENTHETICAL', t)
      inDialogue = true
      continue
    }

    // Name: speech
    const m = INLINE_RE.exec(t)
    if (m && isInlineName(m[1]) && !inDialogue) {
      push('CHARACTER', m[1].trim())
      if (m[2]) push('PARENTHETICAL', m[2])
      push('DIALOGUE', m[3].trim())
      inDialogue = false // the next "Name:" line starts a new speaker
      continue
    }

    // A name on its own line, with the speech right below it
    const cueByLayout = indentMode && (indent >= 1.8 || l.align === 'center') && t.length <= 40
    const cueByText = isCharacterLine(t.replace(/[:：]$/, '').replace(CONTD_RE, '')) || (nameShaped(t) && (isName(t) || /[:：]$/.test(t)))
    if (hasNext && !isHeadingText(next.text) && (cueByLayout || (!inDialogue && cueByText))) {
      push('CHARACTER', t.replace(CONTD_RE, '').replace(/[:：]$/, '').trim())
      inDialogue = true
      continue
    }

    if (inDialogue) {
      // Screenplay layout: a line back at the left margin is action again.
      if (indentMode && indent < 0.5 && l.align !== 'center') {
        push('ACTION', t)
        inDialogue = false
      } else {
        push('DIALOGUE', t)
      }
      continue
    }

    push('ACTION', t)
  }
  return out
}
