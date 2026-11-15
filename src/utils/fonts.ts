import type { DocFontFamily } from '../types'

export interface DocFont {
  id: DocFontFamily
  label: string
  stack: string
}

export const DOC_FONTS: DocFont[] = [
  { id: 'courier-prime', label: 'Courier Prime', stack: "'Courier Prime', 'Courier New', monospace" },
  { id: 'courier-new', label: 'Courier New', stack: "'Courier New', Courier, monospace" },
  { id: 'system-mono', label: 'System Mono', stack: "ui-monospace, Menlo, Consolas, monospace" },
  { id: 'serif', label: 'Times (Serif)', stack: "'Times New Roman', Times, Tinos, 'Liberation Serif', serif" },
]

export const FONT_SIZE_MIN = 10
export const FONT_SIZE_MAX = 14
export const FONT_SIZE_DEFAULT = 12

export function fontStackFor(id: DocFontFamily | undefined): string {
  return DOC_FONTS.find((f) => f.id === id)?.stack ?? DOC_FONTS[0].stack
}
