import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../store/useApp'
import { backspace, bell, carriageReturn, keyStrike, spaceBar } from '../../utils/typewriterSound'

/*
 * Typewriter canvas (desktop).
 *
 * The whole canvas becomes the machine: the page stands on a paper rest and
 * feeds over a platen roller. The line you're typing is held at the print
 * line and the page scrolls up as you write. The carriage (page, roller and
 * scale) slides sideways so the print point stays in the middle; keys on the
 * machine press as you type, with key, bell and carriage-return sounds.
 *
 * Look and feel inspired by Platen, a thermal typewriter by Saleh Kayyali
 * (https://github.com/mskayyali/platenwriter, MIT), redrawn in Ezuth's theme.
 * No code from Platen is used.
 */

const COLS = 85 // 8.5" page at 10 characters per inch (Courier, 12pt)
const BELL_COL = 70 // five spaces before the 7.5" right margin
const CURL_H = 44 // paper bending toward the roller, above the platen
const PLATEN_H = 46
const SCALE_TOP = PLATEN_H + 6
const SCALE_H = 30
const BODY_TOP = SCALE_TOP + SCALE_H + 4
const STRIP_H = 46
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function usePref(key: string, initial: boolean) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key)
      return s === null ? initial : s === '1'
    } catch {
      return initial
    }
  })
  const set = (next: boolean) => {
    setV(next)
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  }
  return [v, set] as const
}

export function TypewriterDeck() {
  const deckRef = useRef<HTMLDivElement>(null)
  const setCanvasStyle = useApp((s) => s.setCanvasStyle)

  const [sound, setSound] = usePref('reel.tw.sound', true)
  const [carriage, setCarriage] = usePref('reel.tw.carriage', true)
  const soundRef = useRef(sound)
  const carriageRef = useRef(carriage)
  useEffect(() => {
    soundRef.current = sound
    carriageRef.current = carriage
  })

  // Page position at rest (no carriage shift), relative to the deck.
  const [geo, setGeo] = useState({ left: 0, width: 816, ext: 58, tall: true })
  const [shift, setShift] = useState(0)
  const [col, setCol] = useState<number | null>(null)
  const [pressed, setPressed] = useState<Set<string>>(() => new Set())

  /* ---------- carriage, print line, column, bell ---------- */
  useEffect(() => {
    const deck = deckRef.current
    const main = deck?.closest('main')
    const frame = main?.querySelector<HTMLElement>('[data-tw-frame]')
    if (!deck || !main || !frame) return
    let raf = 0
    let lastLine = ''
    let lastCol = -1
    let curShift = 0

    const sheet = () => main.querySelector<HTMLElement>('[data-sheet]')

    const measure = () => {
      const s = sheet()
      if (!s) return null
      const sr = s.getBoundingClientRect()
      const fr = frame.getBoundingClientRect()
      const dr = deck.getBoundingClientRect()
      const width = sr.width
      const left = fr.left + (fr.width - width) / 2 - dr.left
      const ext = clamp(Math.min(left, dr.width - left - width) - 6, 10, 58)
      const tall = main.clientHeight >= 620
      const solidH = deck.offsetHeight - CURL_H

      // Room above the page so its first line can reach the print line,
      // like a fresh sheet just fed into the machine.
      const first = s.querySelector('[data-elid]')
      const firstOff = first ? first.getBoundingClientRect().bottom - sr.top : width / 8.5
      const printFromTop = main.clientHeight - deck.offsetHeight + CURL_H - 4
      main.style.setProperty('--tw-top', `${Math.max(32, Math.round(printFromTop - firstOff))}px`)

      // Paper rest behind the page, painted on the canvas background.
      const restPad = ext * 0.6
      main.style.setProperty('--tw-rest-x', `${Math.round(left - restPad)}px`)
      main.style.setProperty('--tw-rest-w', `${Math.round(width + restPad * 2)}px`)
      main.style.setProperty('--tw-rest-y', '28px')
      main.style.setProperty('--tw-rest-h', `${Math.max(0, Math.round(main.clientHeight - solidH - 28 + 6))}px`)

      setGeo((g) =>
        Math.abs(g.left - left) < 0.5 && Math.abs(g.width - width) < 0.5 && Math.abs(g.ext - ext) < 0.5 && g.tall === tall
          ? g
          : { left, width, ext, tall },
      )
      return { sr, dr, left, width }
    }

    // Caret position, if it's inside a screenplay line on this canvas.
    const caret = (): { rect: DOMRect; line: string } | null => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return null
      const n = sel.focusNode
      const host = (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('[data-elid]')
      if (!host || !main.contains(host)) return null
      const range = sel.getRangeAt(0).cloneRange()
      range.collapse(false)
      const r = range.getClientRects()[0]
      const line = host.dataset.elid ?? ''
      if (r && r.height > 0) return { rect: r, line }
      const hr = host.getBoundingClientRect() // empty line: no caret box
      return { rect: new DOMRect(hr.left, hr.top, 0, hr.height), line }
    }

    const printY = () => deck.getBoundingClientRect().top + CURL_H - 4

    const setCarriageShift = (px: number) => {
      curShift = px
      main.style.setProperty('--tw-shift', `${px}px`)
      setShift(px)
    }

    const sync = (scroll: boolean, resume = false) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const m = measure()
        const c = caret()
        if (!m || !c) {
          setCol(null)
          lastCol = -1
          if (resume) {
            // Opening the canvas: pick up where the script ends.
            const lines = main.querySelectorAll('[data-elid]')
            const last = lines[lines.length - 1]
            if (last) main.scrollTop += last.getBoundingClientRect().bottom - printY()
          }
          return
        }
        const perCol = m.width / COLS
        // Undo the (possibly mid-animation) carriage shift to get the caret's
        // position on the page itself.
        const liveShift = m.sr.left - m.dr.left - m.left
        const caretX = c.rect.left - m.dr.left - liveShift
        const column = clamp(Math.floor((caretX - m.left) / perCol), 0, COLS - 1)
        setCol(column)

        if (soundRef.current && scroll && c.line === lastLine && lastCol < BELL_COL && column === lastCol + 1 && column >= BELL_COL) {
          bell()
        }
        lastLine = c.line
        lastCol = column

        const target = carriageRef.current ? clamp(m.left + m.width / 2 - caretX, -m.width / 2, m.width / 2) : 0
        if (Math.abs(target - curShift) > 0.5) setCarriageShift(target)

        if (scroll) {
          // Hold the typing line at the print line, just above the roller.
          const delta = c.rect.bottom - printY()
          if (Math.abs(delta) > 1) main.scrollBy({ top: delta, behavior: 'smooth' })
        }
      })
    }

    const onSel = () => sync(true)
    document.addEventListener('selectionchange', onSel)
    main.addEventListener('input', onSel)
    const ro = new ResizeObserver(() => sync(false))
    ro.observe(main)
    ro.observe(deck)
    sync(true, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('selectionchange', onSel)
      main.removeEventListener('input', onSel)
      ro.disconnect()
      for (const v of ['--tw-top', '--tw-shift', '--tw-rest-x', '--tw-rest-w', '--tw-rest-y', '--tw-rest-h']) {
        main.style.removeProperty(v)
      }
      setShift(0)
    }
  }, [carriage]) // turning the carriage on/off re-centres right away

  /* ---------- keys on the machine + sounds ---------- */
  useEffect(() => {
    const main = deckRef.current?.closest('main')
    if (!main) return
    const timers = new Map<string, number>()
    const press = (k: string) => {
      setPressed((p) => new Set(p).add(k))
      window.clearTimeout(timers.get(k))
      timers.set(
        k,
        window.setTimeout(() => {
          setPressed((p) => {
            const n = new Set(p)
            n.delete(k)
            return n
          })
        }, 140),
      )
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (!t?.closest?.('[data-elid]') || !main.contains(t)) return
      const play = soundRef.current
      if (e.key === 'Enter') {
        press('RETURN')
        if (play) carriageReturn()
      } else if (e.key === 'Backspace') {
        press('BACK')
        if (play) backspace()
      } else if (e.key === ' ') {
        press('SPACE')
        if (play) spaceBar()
      } else if (e.key.length === 1) {
        press(e.key.toUpperCase())
        if (play) keyStrike()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  /* ---------- layout ---------- */
  const { left, width, ext, tall } = geo
  const knobW = Math.min(24, ext * 0.42)
  const perCol = width / COLS
  const machineL = left - ext
  const machineW = width + ext * 2
  const roomy = machineW >= 600

  const k = clamp(Math.floor((machineW - 110) / 12.4), 20, 32) // key size
  const gap = Math.max(4, Math.round(k * 0.2))
  const spaceH = Math.round(k * 0.55)
  const kbH = tall ? 3 * k + 3 * gap + spaceH : 0
  const bodyH = STRIP_H + (tall ? kbH + 14 : 0)
  const solidH = BODY_TOP + bodyH + 30
  const deckH = CURL_H + solidH

  // Where the type strikes: fixed mid-page with the carriage, else at the caret.
  const guideX = col === null ? null : carriage ? left + width / 2 : left + (col + 0.5) * perCol

  const keep = (e: React.MouseEvent) => e.preventDefault() // don't steal the caret

  return (
    <div
      ref={deckRef}
      data-typewriter-deck
      className="pointer-events-none sticky bottom-0 z-10 select-none"
      style={{ height: deckH }}
    >
      {/* Desk below the print line hides the rest of the page */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0" style={{ top: CURL_H, background: 'var(--tw-desk)' }} />

      {/* ---- Carriage: paper curl, roller, scale — slides as you type ---- */}
      <div
        className="absolute inset-x-0 top-0"
        style={{ transform: `translateX(${shift}px)`, transition: 'transform 110ms ease-out' }}
      >
        <div
          className="absolute"
          style={{
            left,
            width,
            top: 0,
            height: CURL_H,
            background: 'linear-gradient(180deg, rgba(40,32,24,0) 0%, rgba(40,32,24,0.035) 55%, rgba(40,32,24,0.08) 100%)',
          }}
        />

        <div className="absolute" style={{ top: CURL_H, left: left - ext, width: width + ext * 2, height: PLATEN_H }}>
          <div
            className="absolute rounded-full"
            style={{
              left: knobW - 2,
              right: knobW - 2,
              top: 3,
              bottom: 3,
              background: 'linear-gradient(180deg, #4a4642 0%, #24211f 22%, #141312 55%, #0b0a0a 78%, #2b2826 100%)',
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
          {/* paper wrapping over the front of the roller */}
          <div
            className="absolute"
            style={{
              left: ext,
              width,
              top: 0,
              height: PLATEN_H,
              background: 'linear-gradient(180deg, #fbfaf8 0%, #f1eee9 40%, #dedad3 80%, #cfcac2 100%)',
            }}
          />
        </div>

        {/* carriage scale */}
        <div
          className="absolute overflow-hidden rounded-md bg-ink-950 dark:bg-black"
          style={{ top: CURL_H + SCALE_TOP, left: left - 14, width: width + 28, height: SCALE_H }}
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
          {col !== null && (
            <span
              className="absolute top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-[#e8734e]"
              style={{ left: 14 + (col + 0.5) * perCol - 5 }}
            />
          )}
        </div>
      </div>

      {/* ---- Fixed machine parts ---- */}
      {/* type guide: where the letter strikes */}
      {guideX !== null && (
        <div
          className="absolute"
          style={{ top: CURL_H, left: guideX - 6, transition: carriage ? undefined : 'left 75ms ease-out' }}
        >
          <div className="h-[7px] w-[12px] rounded-b-[3px] bg-[#b08d4f] shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
        </div>
      )}

      {/* machine front */}
      <div
        className="absolute rounded-b-[22px] rounded-t-[8px] border border-[#d9d1c5] bg-[linear-gradient(180deg,#f3eee6_0%,#e4ddd1_100%)] shadow-[0_14px_30px_rgba(40,32,24,0.16)] dark:border-ink-700 dark:bg-[linear-gradient(180deg,#2a2b2f_0%,#1b1c1f_100%)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.45)]"
        style={{ top: CURL_H + BODY_TOP, left: machineL, width: machineW, height: bodyH }}
      >
        <div className="flex items-center justify-between gap-3 whitespace-nowrap px-5" style={{ height: STRIP_H }}>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-serif text-[20px] leading-none text-ink-900 dark:text-ink-50">Ezuth</span>
            {roomy && (
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-ink-500 dark:text-ink-400">
                Typewriter
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch label="Sound" on={sound} onChange={setSound} onMouseDown={keep} />
            <Switch label="Carriage" on={carriage} onChange={setCarriage} onMouseDown={keep} />
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-ink-950 px-2 py-1 font-mono text-[11px] tabular-nums text-[#e9c48a] dark:bg-black">
              COL {col === null ? '--' : String(col + 1).padStart(2, '0')}
            </span>
            {roomy && (
              <button
                type="button"
                onMouseDown={keep}
                onClick={() => setCanvasStyle('paper')}
                className="pointer-events-auto rounded-full border border-ink-300 bg-white/70 px-3 py-1 text-[11.5px] font-medium text-ink-700 transition-colors hover:bg-white hover:text-ink-950 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200 dark:hover:text-ink-50"
              >
                Paper view
              </button>
            )}
          </div>
        </div>

        {tall && (
          <div
            className="mx-4 flex flex-col items-center rounded-[14px] bg-black/[0.035] pb-2 pt-2 dark:bg-black/25"
            style={{ gap, height: kbH + 14 - 6 }}
            aria-hidden
          >
            {ROWS.map((row, ri) => (
              <div key={row} className="flex" style={{ gap, paddingLeft: ri * k * 0.5 }}>
                {row.split('').map((ch) => (
                  <Key key={ch} size={k} label={ch} down={pressed.has(ch)} />
                ))}
                {ri === 0 && <Key size={k} wide={1.5} label="⌫" down={pressed.has('BACK')} />}
                {ri === 1 && <Key size={k} wide={1.7} label="⏎" down={pressed.has('RETURN')} />}
              </div>
            ))}
            <div
              className={`rounded-full border transition-transform duration-75 ${
                pressed.has('SPACE')
                  ? 'translate-y-[2px] border-[#b9ad98] bg-[#efe2c8] shadow-none dark:border-ink-500 dark:bg-ink-600'
                  : 'border-[#cfc6b8] bg-[#fbf8f3] shadow-[0_2px_0_#c4b9aa] dark:border-ink-600 dark:bg-ink-700 dark:shadow-[0_2px_0_#0e0f11]'
              }`}
              style={{ width: k * 6.5, height: spaceH, marginLeft: k }}
            />
          </div>
        )}
      </div>

      {/* credit */}
      <p
        className="absolute text-right text-[10.5px] text-ink-400 dark:text-ink-500"
        style={{ top: CURL_H + BODY_TOP + bodyH + 8, left: machineL, width: machineW }}
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
  )
}

function Key({ size, label, down, wide = 1 }: { size: number; label: string; down: boolean; wide?: number }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 font-semibold transition-transform duration-75 ${
        down
          ? 'translate-y-[2px] border-[#a39684] bg-[#efe2c8] text-ink-950 shadow-none dark:border-ink-400 dark:bg-ink-500 dark:text-white'
          : 'border-[#b5ab9c] bg-[#fbf8f3] text-ink-700 shadow-[0_2px_0_#c4b9aa] dark:border-ink-500 dark:bg-ink-700 dark:text-ink-100 dark:shadow-[0_2px_0_#0e0f11]'
      }`}
      style={{ width: size * wide, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {label}
    </div>
  )
}

function Switch({
  label,
  on,
  onChange,
  onMouseDown,
}: {
  label: string
  on: boolean
  onChange: (v: boolean) => void
  onMouseDown: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onMouseDown={onMouseDown}
      onClick={() => onChange(!on)}
      className="pointer-events-auto flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400"
    >
      <span
        className={`relative h-[16px] w-[28px] rounded-full transition-colors ${
          on ? 'bg-[#e8734e]' : 'bg-ink-300 dark:bg-ink-600'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[12px] w-[12px] rounded-full bg-white shadow transition-[left] ${
            on ? 'left-[14px]' : 'left-[2px]'
          }`}
        />
      </span>
      {label}
    </button>
  )
}
