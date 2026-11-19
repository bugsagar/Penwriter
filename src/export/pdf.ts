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
  const w = widthOf(text, font, size, false, false)
  pg.drawLine({
    start: { x, y: baselineY - size * 0.12 },
    end: { x: x + w, y: baselineY - size * 0.12 },
    thickness: 0.75,
    color,
  })
}

/* ---------- text the PDF's Courier can't draw ----------
   The built-in PDF fonts only cover Latin (WinAnsi). Malayalam and other
   scripts — or emoji — are drawn by the browser, which shapes them
   properly, onto a canvas, and placed in the PDF as an image at the same
   spot. Latin text stays real, selectable PDF text. */
const RASTER_SCALE = 4 // canvas pixels per PDF point (~288 dpi)

function canEncode(font: PDFFont, text: string): boolean {
  try {
    font.encodeText(text)
    return true
  } catch {
    return false
  }
}

function cssFont(size: number, bold: boolean, italic: boolean): string {
  return `${italic ? 'italic ' : ''}${bold ? '700 ' : ''}${size * RASTER_SCALE}px "Courier Prime", "Courier New", "Noto Sans Malayalam", "Manjari", "Kartika", sans-serif`
}

let measureCanvas: CanvasRenderingContext2D | null = null
function rasterWidth(text: string, size: number, bold: boolean, italic: boolean): number {
  measureCanvas ??= document.createElement('canvas').getContext('2d')
  if (!measureCanvas) return text.length * size * 0.6
  measureCanvas.font = cssFont(size, bold, italic)
  return measureCanvas.measureText(text).width / RASTER_SCALE
}

/** Width in points, whichever way the text will be drawn. */
function widthOf(text: string, font: PDFFont, size: number, bold: boolean, italic: boolean): number {
  return canEncode(font, text) ? font.widthOfTextAtSize(text, size) : rasterWidth(text, size, bold, italic)
}

async function drawTextAny(
  doc: PDFDocument,
  pg: PDFPage,
  text: string,
  o: { x: number; y: number; size: number; font: PDFFont; color: RGB; bold: boolean; italic: boolean },
) {
  if (!text) return
  if (canEncode(o.font, text)) {
    pg.drawText(text, { x: o.x, y: o.y, size: o.size, font: o.font, color: o.color })
    return
  }
  const w = rasterWidth(text, o.size, o.bold, o.italic)
  const h = o.size * 1.6
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil((w + 2) * RASTER_SCALE))
  canvas.height = Math.ceil(h * RASTER_SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.font = cssFont(o.size, o.bold, o.italic)
  ctx.fillStyle = `rgb(${Math.round(o.color.red * 255)}, ${Math.round(o.color.green * 255)}, ${Math.round(o.color.blue * 255)})`
  ctx.textBaseline = 'alphabetic'
  const baseline = o.size * 1.2 // from the image's top, in points
  ctx.fillText(text, 0, baseline * RASTER_SCALE)
  const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!png) return
  const img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()))
  // the image's bottom sits below the baseline by the part under it
  pg.drawImage(img, { x: o.x, y: o.y - (h - baseline), width: canvas.width / RASTER_SCALE, height: h })
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
      (PAGE_W - widthOf(text, font, size, font === bold, false)) / 2

    if (hasTitle) {
      const t = project.title.trim().toUpperCase()
      const size = t.length > 24 ? 22 : 30
      await drawTextAny(doc, page, t, { x: centerX(t, bold, size), y: 440, size, font: bold, color: INK, bold: true, italic: false })
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
      await drawTextAny(doc, page, author, { x: centerX(author, regular, 16), y: 380, size: 16, font: regular, color: INK, bold: false, italic: false })
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
        const w = widthOf(line, font, size, isBold, isItalic)
        if (align === 'right') {
          const rightEdge = Math.min(layout.x + layout.width, PAGE_W - 72)
          x = rightEdge - w
        } else if (align === 'center') {
          x = layout.x + Math.max(layout.width - w, 0) / 2
        }
        await drawTextAny(doc, pg, line, { x, y, size, font, color, bold: isBold, italic: isItalic })
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
