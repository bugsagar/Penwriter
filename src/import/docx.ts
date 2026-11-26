import { unzipSync, strFromU8 } from 'fflate'
import type { ElementType } from '../types'
import { BLANK, rebaseIndents, type RawLine } from './classify'
import { ImportError } from './formats'

/*
 * Word (.docx) reader. A .docx is a zip of XML; the text is in
 * word/document.xml. Each paragraph becomes a line with its indent and
 * alignment (from the paragraph or its style). Styles named like screenplay
 * elements ("Character", "Scene Heading"… as Final Draft and others export)
 * decide the type outright. Two-column tables ("Name | speech") are read as
 * character + dialogue.
 */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const TWIPS_PER_INCH = 1440

const kids = (el: Element, name: string) => Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1 && (n as Element).localName === name)
const kid = (el: Element | null | undefined, name: string) => (el ? kids(el, name)[0] : undefined)
const attr = (el: Element | null | undefined, name: string) => el?.getAttributeNS(W, name) ?? el?.getAttribute(`w:${name}`) ?? null

interface Layout {
  left?: number // twips
  firstLine?: number
  align?: RawLine['align']
  caps?: boolean
  spaceBefore?: number
}

function readLayout(pPr: Element | undefined): Layout {
  const out: Layout = {}
  if (!pPr) return out
  const ind = kid(pPr, 'ind')
  const left = attr(ind, 'left') ?? attr(ind, 'start')
  if (left != null) out.left = Number(left) || 0
  const first = attr(ind, 'firstLine')
  const hanging = attr(ind, 'hanging')
  if (first != null) out.firstLine = Number(first) || 0
  else if (hanging != null) out.firstLine = -(Number(hanging) || 0)
  const jc = attr(kid(pPr, 'jc'), 'val')
  if (jc === 'center') out.align = 'center'
  else if (jc === 'right' || jc === 'end') out.align = 'right'
  else if (jc) out.align = 'left'
  const before = attr(kid(pPr, 'spacing'), 'before')
  if (before != null) out.spaceBefore = Number(before) || 0
  const rPr = kid(pPr, 'rPr')
  if (kid(rPr, 'caps')) out.caps = attr(kid(rPr, 'caps'), 'val') !== '0' && attr(kid(rPr, 'caps'), 'val') !== 'false'
  return out
}

const STYLE_TYPES: [RegExp, ElementType][] = [
  [/scene ?heading|slug ?line|^heading$/i, 'SCENE_HEADING'],
  [/^character|char(acter)? ?name|^speaker/i, 'CHARACTER'],
  [/parenthetical|wryly/i, 'PARENTHETICAL'],
  [/^dialog(ue)?$/i, 'DIALOGUE'],
  [/^transition/i, 'TRANSITION'],
  [/^shot$/i, 'SHOT'],
  [/^action$|^description$|^general$/i, 'ACTION'],
]

interface Style {
  type?: ElementType
  layout: Layout
  basedOn?: string
}

function readStyles(xml: string | undefined): Map<string, Style> {
  const map = new Map<string, Style>()
  if (!xml) return map
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  for (const s of Array.from(doc.getElementsByTagNameNS(W, 'style'))) {
    if (attr(s, 'type') !== 'paragraph') continue
    const id = attr(s, 'styleId')
    if (!id) continue
    const name = attr(kid(s, 'name'), 'val') ?? id
    const type = STYLE_TYPES.find(([re]) => re.test(name.trim()))?.[1]
    map.set(id, { type, layout: readLayout(kid(s, 'pPr')), basedOn: attr(kid(s, 'basedOn'), 'val') ?? undefined })
  }
  return map
}

/** A style's layout with what it inherits (closest wins). */
function styleLayout(styles: Map<string, Style>, id: string | null): { type?: ElementType; layout: Layout } {
  const chain: Style[] = []
  for (let cur = id, n = 0; cur && n < 10; n++) {
    const s = styles.get(cur)
    if (!s) break
    chain.push(s)
    cur = s.basedOn ?? null
  }
  const layout: Layout = {}
  for (const s of chain.reverse()) Object.assign(layout, Object.fromEntries(Object.entries(s.layout).filter(([, v]) => v !== undefined)))
  return { type: chain.reverse().find((s) => s.type)?.type, layout }
}

/** A paragraph's text; soft line breaks split it into several lines. */
function paragraphText(p: Element, caps: boolean): string[] {
  const parts: string[] = ['']
  const walk = (node: Element, runCaps: boolean) => {
    for (const c of Array.from(node.childNodes)) {
      if (c.nodeType !== 1) continue
      const e = c as Element
      switch (e.localName) {
        case 'r': {
          const rPr = kid(e, 'rPr')
          const capsEl = kid(rPr, 'caps')
          const rc = capsEl ? attr(capsEl, 'val') !== '0' && attr(capsEl, 'val') !== 'false' : runCaps
          walk(e, rc)
          break
        }
        case 't':
          parts[parts.length - 1] += runCaps ? (e.textContent ?? '').toUpperCase() : (e.textContent ?? '')
          break
        case 'tab':
          parts[parts.length - 1] += '\t'
          break
        case 'br':
        case 'cr':
          parts.push('')
          break
        case 'pPr':
        case 'rPr':
        case 'del': // tracked deletion
        case 'instrText':
          break
        default:
          walk(e, runCaps) // hyperlinks, smart tags, insertions…
      }
    }
  }
  walk(p, caps)
  return parts
}

/** Leading tabs/spaces typed to indent, as inches (Word's default tab: 0.5in; 12pt Courier: 10 chars/in). */
function typedIndent(s: string): number {
  const m = /^[\t ]*/.exec(s)?.[0] ?? ''
  let inches = 0
  for (const ch of m) inches += ch === '\t' ? 0.5 : 0.1
  return inches
}

export async function readDocx(buf: ArrayBuffer): Promise<RawLine[]> {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(buf), {
      filter: (f) => f.name === 'word/document.xml' || f.name === 'word/styles.xml',
    })
  } catch {
    throw new ImportError('This Word file could not be read. If it’s an old .doc file, open it in Word or Google Docs and save it as .docx.')
  }
  const docXml = files['word/document.xml']
  if (!docXml) throw new ImportError('This doesn’t look like a Word document.')
  const styles = readStyles(files['word/styles.xml'] ? strFromU8(files['word/styles.xml']) : undefined)
  const doc = new DOMParser().parseFromString(strFromU8(docXml), 'application/xml')
  const body = doc.getElementsByTagNameNS(W, 'body')[0]
  if (!body) throw new ImportError('This Word document is empty.')

  const lines: RawLine[] = []

  const paragraph = (p: Element) => {
    const pPr = kid(p, 'pPr')
    const fromStyle = styleLayout(styles, attr(kid(pPr, 'pStyle'), 'val') ?? 'Normal')
    const own = readLayout(pPr)
    const layout: Layout = { ...fromStyle.layout, ...Object.fromEntries(Object.entries(own).filter(([, v]) => v !== undefined)) }
    const texts = paragraphText(p, !!layout.caps)
    if ((layout.spaceBefore ?? 0) >= 200 && lines.length && lines[lines.length - 1].text) lines.push(BLANK)
    texts.forEach((raw, i) => {
      const first = i === 0 ? (layout.firstLine ?? 0) : 0
      const indent = Math.max(0, ((layout.left ?? 0) + first) / TWIPS_PER_INCH) + typedIndent(raw)
      lines.push({ text: raw, indent, align: layout.align, styleType: fromStyle.type })
    })
  }

  const table = (tbl: Element) => {
    for (const tr of kids(tbl, 'tr')) {
      const cells = kids(tr, 'tc').map((tc) =>
        kids(tc, 'p')
          .flatMap((p) => paragraphText(p, false))
          .map((s) => s.trim())
          .filter(Boolean)
          .join('\n'),
      )
      const filled = cells.filter(Boolean)
      if (filled.length === 2 && filled[0].length <= 30 && !filled[0].includes('\n')) {
        // Name | speech
        lines.push({ text: filled[0], styleType: 'CHARACTER' })
        for (const s of filled[1].split('\n')) lines.push({ text: s, styleType: /^\(.*\)$/.test(s) ? 'PARENTHETICAL' : 'DIALOGUE' })
        lines.push(BLANK)
      } else {
        for (const c of filled) {
          for (const s of c.split('\n')) lines.push({ text: s })
          lines.push(BLANK)
        }
      }
    }
  }

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== 1) continue
    const e = node as Element
    if (e.localName === 'p') paragraph(e)
    else if (e.localName === 'tbl') table(e)
    else if (e.localName === 'sdt') {
      const content = kid(e, 'sdtContent')
      for (const p of content ? kids(content, 'p') : []) paragraph(p)
    }
  }

  return rebaseIndents(lines)
}
