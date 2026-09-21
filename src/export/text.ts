import type { Project } from '../types'
import { ELEMENT_LABELS } from '../utils/detect'
import { downloadBlob } from './pdf'

const INDENT: Record<string, number> = {
  SCENE_HEADING: 0,
  ACTION: 0,
  SHOT: 0,
  CHARACTER: 26,
  DIALOGUE: 17,
  PARENTHETICAL: 14,
  TRANSITION: 45,
}

export function exportText(project: Project): void {
  const lines: string[] = []

  if (project.title.trim()) {
    lines.push(project.title.trim().toUpperCase(), '')
    lines.push('written by', '')
    lines.push(project.author.trim().toUpperCase(), '')
    lines.push(''.padEnd(60, '-'), '', '')
  }

  for (const el of project.elements) {
    if (!el.text.trim()) {
      lines.push('')
      continue
    }
    const indent = INDENT[el.type] ?? 0
    const pad = ' '.repeat(indent)
    lines.push(
      el.text
        .split('\n')
        .map((l) => (l.trim() ? pad + l : ''))
        .join('\n'),
    )
    lines.push('')
  }

  downloadBlob(
    new TextEncoder().encode(lines.join('\n')),
    `${project.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'screenplay'}.txt`,
    'text/plain',
  )
}

export function exportFountain(project: Project): void {
  const lines: string[] = []
  if (project.title.trim()) {
    lines.push(`Title: ${project.title.trim()}`, '')
    if (project.author.trim()) lines.push(`Author: ${project.author.trim()}`, '')
    if (project.description.trim()) lines.push(`Credit: ${project.description.trim()}`, '')
    lines.push('')
  }
  for (const el of project.elements) {
    const text = el.text.trim()
    if (!text) {
      lines.push('')
      continue
    }
    switch (el.type) {
      case 'SCENE_HEADING':
        lines.push(text)
        break
      case 'CHARACTER':
        lines.push(text)
        break
      case 'DIALOGUE':
        lines.push(text)
        break
      case 'PARENTHETICAL':
        lines.push(`(${text.replace(/^\(|\)$/g, '')})`)
        break
      case 'TRANSITION':
        lines.push(text)
        break
      default:
        lines.push(text)
    }
    lines.push('')
  }
  downloadBlob(
    new TextEncoder().encode(lines.join('\n')),
    `${project.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'screenplay'}.fountain`,
    'text/plain',
  )
}

export { ELEMENT_LABELS }
