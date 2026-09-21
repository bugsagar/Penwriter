import { StandardFonts, PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import type { Project } from '../types'
import { layoutFor, paginate, BLOCK_SPACING, FONT_SIZE, MARGIN_T, PAGE_W, sizeFor } from '../utils/layout'

export function downloadBlob(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const INK = rgb(0.09, 0.09, 0.09)

function hexColor(hex: string | undefined): RGB {
  if (!hex) return INK
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return INK
  const n = parseInt(full, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/** Screenplay convention: everything bolds except dialogue-family blocks. */
function defaultBold(type: string): boolean {
  return type !== 'DIALOGUE' && type !== 'ACTION' && type !== 'PARENTHETICAL'
}

/** Character cues sit centered in their column; everything else follows layout. */
function defaultExportAlign(type: string, layoutAlign: 'left' | 'right'): string {
  if (type === 'CHARACTER') return 'center'
  return layoutAlign
}

function underline(
  pg: PDFPage,
  x: number,
  baselineY: number,
  text: string,
  font: PDFFont,
  color: RGB,
  size: number,
) {
  if (!text) return
  const w = font.widthOfTextAtSize(text, size)
  pg.drawLine({
    start: { x, y: baselineY - size * 0.12 },
    end: { x: x + w, y: baselineY - size * 0.12 },
    thickness: 0.75,
    color,
  })
}

function safeName(title: string): string {
  return title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'screenplay'
}

export async function exportPdf(project: Project): Promise<void> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Courier)
  const bold = await doc.embedFont(StandardFonts.CourierBold)
  const italic = await doc.embedFont(StandardFonts.CourierOblique)
  const boldItalic = await doc.embedFont(StandardFonts.CourierBoldOblique)

  // ---- Title page ----
  const page = doc.addPage([PAGE_W, 792])
  const hasTitle = project.title.trim().length > 0
  const hasAuthor = project.author.trim().length > 0
  if (hasTitle || hasAuthor) {
    const centerX = (text: string, font: PDFFont, size: number) =>
      (PAGE_W - font.widthOfTextAtSize(text, size)) / 2

    if (hasTitle) {
      const t = project.title.trim().toUpperCase()
      const size = t.length > 24 ? 22 : 30
      page.drawText(t, {
        x: centerX(t, bold, size),
        y: 440,
        size,
        font: bold,
        color: INK,
      })
    }
    if (hasTitle && hasAuthor) {
      const written = 'written by'
      page.drawText(written, {
        x: centerX(written, regular, 14),
        y: 400,
        size: 14,
        font: regular,
        color: INK,
      })
    }
    if (hasAuthor) {
      const author = project.author.trim().toUpperCase()
      page.drawText(author, {
        x: centerX(author, regular, 16),
        y: 380,
        size: 16,
        font: regular,
        color: INK,
      })
    }
  }

  // ---- Screenplay pages ----
  const pages = paginate(project.elements)
  let pageIndex = 1

  for (const p of pages) {
    const pg = doc.addPage([PAGE_W, 792])
    let y = 792 - MARGIN_T

    // page number
    pg.drawText(String(pageIndex), {
      x: PAGE_W - 72 - regular.widthOfTextAtSize(String(pageIndex), FONT_SIZE),
      y: 792 - 36,
      size: FONT_SIZE,
      font: regular,
      color: INK,
    })

    for (const item of p.items) {
      const el = item.element
      const layout = layoutFor(el.type)
      const size = sizeFor(el.type)
      const isBold = el.bold ?? defaultBold(el.type)
      const isItalic = !!el.italic
      const font = isBold && isItalic ? boldItalic : isBold ? bold : isItalic ? italic : regular
      const color = hexColor(el.color)
      const lines = item.lines.length ? item.lines : ['']
      for (const line of lines) {
        let x = layout.x
        const align = el.align ?? defaultExportAlign(el.type, layout.align)
        const w = font.widthOfTextAtSize(line, size)
        if (align === 'right') {
          const rightEdge = Math.min(layout.x + layout.width, PAGE_W - 72)
          x = rightEdge - w
        } else if (align === 'center') {
          x = layout.x + Math.max(layout.width - w, 0) / 2
        }
        pg.drawText(line, { x, y, size, font, color })
        if (el.underline) underline(pg, x, y, line, font, color, size)
        y -= size
      }
      y -= BLOCK_SPACING
    }
    pageIndex++
  }

  const bytes = await doc.save()
  downloadBlob(bytes, `${safeName(project.title)}.pdf`, 'application/pdf')
}
