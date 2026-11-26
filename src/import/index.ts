import type { Project, ScreenplayElement } from '../types'
import { emptyProject } from '../utils/sample'
import { uid } from '../utils/id'
import { classify, rebaseIndents, type RawLine } from './classify'
import { ImportError, isImportable } from './formats'

/*
 * Import a Word, PDF or text/Fountain file as a new screenplay. The file is
 * read on this device; only the resulting script is saved (to the cloud, like
 * any new script).
 */

const MAX_BYTES = 30 * 1024 * 1024
const MAX_ELEMENTS = 20000

/** Plain text / Fountain: blank lines separate blocks; leading spaces are indents. */
function readText(text: string): { lines: RawLine[]; title?: string; author?: string } {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '')
  let rows = src.split('\n')
  let title: string | undefined
  let author: string | undefined
  // Fountain title page: "Title: …" keys up to the first blank line
  if (/^title\s*:/i.test(rows[0] ?? '')) {
    const end = rows.findIndex((r) => !r.trim())
    const head = rows.slice(0, end < 0 ? rows.length : end)
    title = head.find((r) => /^title\s*:/i.test(r))?.replace(/^title\s*:\s*/i, '').trim()
    author = head.find((r) => /^(author|authors|credit)\s*:/i.test(r) && !/^credit/i.test(r))?.replace(/^\w+\s*:\s*/, '').trim()
    rows = rows.slice(end < 0 ? rows.length : end)
  }
  const lines: RawLine[] = rows.map((r) => {
    const t = r.trim()
    if (!t) return { text: '' }
    if (/^\[\[.*\]\]$/.test(t) || /^=+$/.test(t) || /^#/.test(t)) return { text: '' } // notes, page breaks, sections
    if (/^\.[^.]/.test(t)) return { text: t.slice(1), forced: 'SCENE_HEADING' }
    if (/^@/.test(t)) return { text: t.slice(1), forced: 'CHARACTER' }
    if (/^>.*<$/.test(t)) return { text: t.slice(1, -1).trim(), forced: 'ACTION' } // centred text
    if (/^>/.test(t)) return { text: t.slice(1).trim(), forced: 'TRANSITION' }
    if (/^!/.test(t)) return { text: t.slice(1), forced: 'ACTION' }
    const lead = /^[\t ]*/.exec(r)?.[0] ?? ''
    let indent = 0
    for (const ch of lead) indent += ch === '\t' ? 0.5 : 0.1
    return { text: t, indent }
  })
  return { lines: rebaseIndents(lines), title, author }
}

export interface Imported {
  project: Project
  /** letters a PDF drew without saying which letters they are (shown as �) */
  unreadable: number
}

export async function importDocument(file: File): Promise<Imported> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.doc')) {
    throw new ImportError('Old .doc files can’t be imported. Open it in Word or Google Docs and save it as .docx, then import that.')
  }
  if (!isImportable(name)) throw new ImportError('Ezuth can import Word (.docx), PDF and text (.txt, .fountain) files.')
  if (file.size > MAX_BYTES) throw new ImportError('This file is too big to import (over 30 MB).')

  let read: { lines: RawLine[]; title?: string; author?: string; unreadable?: number }
  if (name.endsWith('.docx')) {
    const { readDocx } = await import('./docx')
    read = { lines: await readDocx(await file.arrayBuffer()) }
  } else if (name.endsWith('.pdf')) {
    const { readPdf } = await import('./pdf')
    read = await readPdf(await file.arrayBuffer())
  } else {
    read = readText(await file.text())
  }

  const classified = classify(read.lines).slice(0, MAX_ELEMENTS)
  if (!classified.length) throw new ImportError('No text found in this file.')

  const elements: ScreenplayElement[] = classified.map((c) => ({ id: uid('el'), type: c.type, text: c.text }))
  const project = emptyProject()
  const fromName = file.name.replace(/\.(docx|pdf|txt|fountain)$/i, '').replace(/[_]+/g, ' ').trim()
  project.title = (read.title || fromName || 'Imported Screenplay').slice(0, 120)
  project.author = (read.author ?? '').slice(0, 120)
  project.type = elements.filter((e) => e.type === 'SCENE_HEADING').length > 40 ? 'feature' : 'short'
  project.elements = elements
  return { project, unreadable: read.unreadable ?? 0 }
}
