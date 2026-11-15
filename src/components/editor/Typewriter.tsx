import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../store/useApp'

/*
 * Typewriter canvas (desktop).
 *
 * The page feeds over a platen roller like paper in a typewriter: the line
 * you're typing is held at the print line just above the roller, and the page
 * scrolls up as you write. Below the roller a carriage scale shows the column.
 *
 * Look and feel inspired by Platen, a thermal typewriter by Saleh Kayyali
 * (https://github.com/mskayyali/platenwriter, MIT), redrawn in Pen's theme:
 * just the machine and the paper, no desk.
 */

const COLS = 85 // 8.5" page at 10 characters per inch (Courier, 12pt)
const CURL_H = 44 // paper bending toward the roller, above the platen
const PLATEN_H = 46
const SCALE_H = 30
const BODY_H = 56
const SOLID_H = PLATEN_H + 6 + SCALE_H + BODY_H + 26
export const TYPEWRITER_DECK_H = CURL_H + SOLID_H

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function TypewriterDeck() {
  const deckRef = useRef<HTMLDivElement>(null)
  const setCanvasStyle = useApp((s) => s.setCanvasStyle)
  // Paper position relative to the deck, and room either side for the knobs.
  const [geo, setGeo] = useState({ left: 0, width: 816, ext: 58 })
  const [col, setCol] = useState<number | null>(null)

  useEffect(() => {
    const deck = deckRef.current
    const main = deck?.closest('main')
    if (!deck || !main) return
    let raf = 0

    const sheet = () => main.querySelector<HTMLElement>('[data-sheet]')

    const measure = () => {
      const s = sheet()
      if (!s) return
      const sr = s.getBoundingClientRect()
      const dr = deck.getBoundingClientRect()
      const left = sr.left - dr.left
      const ext = clamp(Math.min(left, dr.width - left - sr.width) - 6, 10, 58)
      // Room above the page so its first line can sit at the print line,
      // like a fresh sheet just fed into the machine.
      const first = s.querySelector('[data-elid]')
      const firstOff = first ? first.getBoundingClientRect().bottom - sr.top : sr.width / 8.5
      const printFromTop = main.clientHeight - TYPEWRITER_DECK_H + CURL_H - 4
      main.style.setProperty('--tw-top', `${Math.max(32, Math.round(printFromTop - firstOff))}px`)
      setGeo((g) =>
        Math.abs(g.left - left) < 0.5 && Math.abs(g.width - sr.width) < 0.5 && Math.abs(g.ext - ext) < 0.5
          ? g
          : { left, width: sr.width, ext },
      )
    }

    // Where the caret is, if it's inside a screenplay line on this canvas.
    const caretRect = (): DOMRect | null => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return null
      const n = sel.focusNode
      const host = (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('[data-elid]')
      if (!host || !main.contains(host)) return null
      const range = sel.getRangeAt(0).cloneRange()
      range.collapse(false)
      const r = range.getClientRects()[0]
      if (r && r.height > 0) return r
      // Empty line: collapsed ranges have no box, use the line itself.
      const hr = host.getBoundingClientRect()
      return new DOMRect(hr.left, hr.top, 0, hr.height)
    }

    const printY = () => deck.getBoundingClientRect().top + CURL_H - 4

    const sync = (scroll: boolean, resume = false) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        measure()
        const rect = caretRect()
        const s = sheet()
        if (!rect || !s) {
          setCol(null)
          // Opening the canvas: pick up where the script ends.
          if (resume) {
            const lines = main.querySelectorAll('[data-elid]')
            const last = lines[lines.length - 1]
            if (last) main.scrollTop += last.getBoundingClientRect().bottom - printY()
          }
          return
        }
        const sr = s.getBoundingClientRect()
        setCol(clamp(Math.floor((rect.left - sr.left) / (sr.width / COLS)), 0, COLS - 1))
        if (scroll) {
          // Hold the typing line at the print line, just above the roller.
          const delta = rect.bottom - printY()
          if (Math.abs(delta) > 1) main.scrollBy({ top: delta, behavior: 'smooth' })
        }
      })
    }

    const onSel = () => sync(true)
    document.addEventListener('selectionchange', onSel)
    const ro = new ResizeObserver(() => sync(false))
    ro.observe(main)
    sync(true, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('selectionchange', onSel)
      ro.disconnect()
      main.style.removeProperty('--tw-top')
    }
  }, [])

  const { left, width, ext } = geo
  const knobW = Math.min(24, ext * 0.42)
  const perCol = width / COLS
  const machineW = width + ext * 2
  const roomy = machineW >= 680
  const markerX = col === null ? null : left + (col + 0.5) * perCol

  return (
    <div
      ref={deckRef}
      data-typewriter-deck
      className="pointer-events-none sticky bottom-0 z-10 select-none"
      style={{ height: TYPEWRITER_DECK_H }}
    >
      {/* Paper bending toward the roller */}
      <div
        className="absolute"
        style={{
          left,
          width,
          top: 0,
          height: CURL_H,
          background:
            'linear-gradient(180deg, rgba(40,32,24,0) 0%, rgba(40,32,24,0.035) 55%, rgba(40,32,24,0.08) 100%)',
        }}
      />

      {/* Everything below the print line hides the page */}
      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 bg-white dark:bg-ink-900"
        style={{ top: CURL_H }}
      >
        {/* Platen roller with knobs */}
        <div className="absolute" style={{ top: 0, left: left - ext, width: width + ext * 2, height: PLATEN_H }}>
          <div
            className="absolute rounded-full"
            style={{
              left: knobW - 2,
              right: knobW - 2,
              top: 3,
              bottom: 3,
              background:
                'linear-gradient(180deg, #4a4642 0%, #24211f 22%, #141312 55%, #0b0a0a 78%, #2b2826 100%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(255,255,255,0.06), 0 6px 14px rgba(20,18,16,0.25)',
            }}
          />
          {[0, 1].map((side) => (
            <div
              key={side}
              className="absolute top-0 rounded-[9px]"
              style={{
                [side ? 'right' : 'left']: 0,
                width: knobW,
                height: PLATEN_H,
                background:
                  'repeating-linear-gradient(90deg, #2d2a27 0 2px, #191716 2px 4px), linear-gradient(180deg, #3a3633, #0f0e0d)',
                backgroundBlendMode: 'overlay',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -2px 3px rgba(0,0,0,0.5)',
              }}
            />
          ))}
          {/* Paper wrapping over the front of the roller */}
          <div
            className="absolute"
            style={{
              left: ext,
              width,
              top: 0,
              height: PLATEN_H,
              background: 'linear-gradient(180deg, #fbfaf8 0%, #f1eee9 40%, #dedad3 80%, #cfcac2 100%)',
              boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
            }}
          />
          {/* Type guide at the carriage position */}
          {markerX !== null && (
            <div
              className="absolute top-0 transition-[left] duration-75 ease-out"
              style={{ left: markerX - (left - ext) - 6, width: 12 }}
            >
              <div className="mx-auto h-[7px] w-[12px] rounded-b-[3px] bg-[#b08d4f] shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
            </div>
          )}
        </div>

        {/* Carriage scale */}
        <div
          className="absolute overflow-hidden rounded-md bg-ink-950 dark:bg-black"
          style={{ top: PLATEN_H + 6, left: left - 14, width: width + 28, height: SCALE_H }}
        >
          <svg
            className="absolute top-0"
            style={{ left: 14, width, height: 11 }}
            viewBox={`0 0 ${COLS} 11`}
            preserveAspectRatio="none"
          >
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <line
                key={i}
                x1={i}
                x2={i}
                y1={0}
                y2={i % 10 === 0 ? 10 : i % 5 === 0 ? 7 : 4}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={0.12}
              />
            ))}
          </svg>
          {Array.from({ length: Math.floor(COLS / 10) + 1 }, (_, i) => (
            <span
              key={i}
              className="absolute bottom-[3px] -translate-x-1/2 font-mono text-[10px] tabular-nums text-white/55"
              style={{ left: 14 + i * 10 * perCol }}
            >
              {i * 10}
            </span>
          ))}
          {markerX !== null && (
            <span
              className="absolute top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-[#e8734e] transition-[left] duration-75 ease-out"
              style={{ left: markerX - left + 14 - 5 }}
            />
          )}
        </div>

        {/* Machine front */}
        <div
          className="absolute flex items-center justify-between gap-4 whitespace-nowrap rounded-b-[20px] rounded-t-[6px] border border-[#d9d1c5] bg-[linear-gradient(180deg,#f3eee6_0%,#e6dfd4_100%)] px-5 shadow-[0_10px_24px_rgba(40,32,24,0.12)] dark:border-ink-700 dark:bg-[linear-gradient(180deg,#2a2b2f_0%,#1c1d20_100%)]"
          style={{ top: PLATEN_H + 6 + SCALE_H + 4, left: left - ext, width: width + ext * 2, height: BODY_H }}
        >
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-serif text-[20px] leading-none text-ink-900 dark:text-ink-50">Pen</span>
            {machineW >= 520 && (
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-ink-500 dark:text-ink-400">
                Typewriter
              </span>
            )}
          </div>
          {roomy && (
          <div className="flex items-center gap-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            <span>
              <kbd className="mr-1.5 rounded border border-ink-300 bg-white/70 px-1.5 py-0.5 font-sans text-[10px] text-ink-700 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200">
                Return
              </kbd>
              New line
            </span>
            <span>
              <kbd className="mr-1.5 rounded border border-ink-300 bg-white/70 px-1.5 py-0.5 font-sans text-[10px] text-ink-700 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200">
                Tab
              </kbd>
              Element
            </span>
          </div>
          )}
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-ink-950 px-2 py-1 font-mono text-[11px] tabular-nums text-[#e9c48a] dark:bg-black">
              COL {col === null ? '--' : String(col + 1).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() => setCanvasStyle('paper')}
              className="pointer-events-auto rounded-full border border-ink-300 bg-white/70 px-3 py-1 text-[11.5px] font-medium text-ink-700 transition-colors hover:bg-white hover:text-ink-950 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200 dark:hover:text-ink-50"
            >
              Paper view
            </button>
          </div>
        </div>

        {/* Credit */}
        <p
          className="absolute text-right text-[10.5px] text-ink-400 dark:text-ink-500"
          style={{ top: PLATEN_H + 6 + SCALE_H + 4 + BODY_H + 6, left: left - ext, width: width + ext * 2 }}
        >
          Inspired by{' '}
          <a
            href="https://github.com/mskayyali/platenwriter"
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto underline decoration-ink-300 underline-offset-2 hover:text-ink-700 dark:decoration-ink-600 dark:hover:text-ink-200"
          >
            Platen
          </a>{' '}
          by{' '}
          <a
            href="https://x.com/mskayyali"
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto underline decoration-ink-300 underline-offset-2 hover:text-ink-700 dark:decoration-ink-600 dark:hover:text-ink-200"
          >
            Saleh Kayyali
          </a>
        </p>
      </div>
    </div>
  )
}
