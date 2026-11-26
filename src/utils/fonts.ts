import type { DocFontFamily, MalayalamFont } from '../types'

/*
 * A script has two fonts: the screenplay font for English (Courier…) and a
 * Malayalam font. The Malayalam one sits right after the English fonts in the
 * CSS font stack, so English letters use Courier and Malayalam letters use the
 * chosen Malayalam font, on every device alike. All fonts are served from
 * Ezuth itself (Google Fonts via @fontsource), downloaded only when used.
 */

export interface DocFont {
  id: DocFontFamily
  label: string
  /** named fonts, without the generic family */
  families: string
  generic: string
}

export const DOC_FONTS: DocFont[] = [
  { id: 'courier-prime', label: 'Courier Prime', families: "'Courier Prime', 'Courier New'", generic: 'monospace' },
  { id: 'courier-new', label: 'Courier New', families: "'Courier New', Courier", generic: 'monospace' },
  { id: 'system-mono', label: 'System Mono', families: 'ui-monospace, Menlo, Consolas', generic: 'monospace' },
  { id: 'serif', label: 'Times (Serif)', families: "'Times New Roman', Times, Tinos, 'Liberation Serif'", generic: 'serif' },
]

export interface MlFont {
  id: MalayalamFont
  label: string
  family: string
}

export const MALAYALAM_FONTS: MlFont[] = [
  { id: 'noto-sans', label: 'Noto Sans Malayalam', family: 'Noto Sans Malayalam' },
  { id: 'noto-serif', label: 'Noto Serif Malayalam', family: 'Noto Serif Malayalam' },
  { id: 'manjari', label: 'Manjari', family: 'Manjari' },
  { id: 'gayathri', label: 'Gayathri', family: 'Gayathri' },
  { id: 'anek', label: 'Anek Malayalam', family: 'Anek Malayalam' },
  { id: 'baloo-chettan', label: 'Baloo Chettan 2', family: 'Baloo Chettan 2' },
  { id: 'chilanka', label: 'Chilanka (handwritten)', family: 'Chilanka' },
]

export const MALAYALAM_FONT_DEFAULT: MalayalamFont = 'noto-sans'

export const FONT_SIZE_MIN = 10
export const FONT_SIZE_MAX = 14
export const FONT_SIZE_DEFAULT = 12

export function malayalamFamily(id: MalayalamFont | undefined): string {
  return (MALAYALAM_FONTS.find((f) => f.id === id) ?? MALAYALAM_FONTS[0]).family
}

export function isMalayalamFont(id: unknown): id is MalayalamFont {
  return MALAYALAM_FONTS.some((f) => f.id === id)
}

/** The CSS font stack: English font, then the Malayalam font, then the generic. */
export function fontStackFor(id: DocFontFamily | undefined, ml?: MalayalamFont): string {
  const f = DOC_FONTS.find((d) => d.id === id) ?? DOC_FONTS[0]
  return `${f.families}, '${malayalamFamily(ml)}', ${f.generic}`
}

/** Ask the browser to download a Malayalam font now (canvas drawing doesn't). */
export async function loadMalayalamFont(ml: MalayalamFont | undefined): Promise<void> {
  try {
    const fam = malayalamFamily(ml)
    await Promise.all([document.fonts.load(`16px '${fam}'`, 'മല'), document.fonts.load(`700 16px '${fam}'`, 'മല')])
  } catch {
    /* falls back to the system font */
  }
}
