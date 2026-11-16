import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { VoiceTyping } from '../../hooks/useVoiceTyping'

/* ══ Voice note ═══════════════════════════════════════════
   Adapted from the "Voice note" component by Bencho
   (bencho.dev, MIT — bencho.dev/licence).

   Hold to record. The pill opens into a bar and the level
   rises in it as bars, newest on the right. Slide left while
   holding and it is thrown away — the bars collapse and the
   pill closes back to where it started.

   ── IN PEN: DICTATION, NOT A RECORDER ───────────────────
   Pen turns speech into script text, so there is no clip to
   play back: letting go puts the words in at the cursor, and
   the original's clip/playhead phase is left out. A quick tap
   (shorter than MIN_MS) latches it on instead, for hands-free
   dictation; tap the pill, or ✓, to finish.

   ── THE LEVEL ───────────────────────────────────────────
   On device, the bars are the microphone's real level. The
   browser's online recogniser gives no level at all, so there
   the bars fall back to Bencho's stand-in, shaped like speech —
   syllables inside phrases, with pauses — and only while words
   are actually arriving, so they still mean "it hears you". */

/* 56 tall and 17px type, the Slide to confirm pill's size, so the
   pills on the wall read as one family */
const H = 56
/* one bar per sample while recording */
const SAMPLE = 70
/* pointer travel, in px, that throws the recording away */
const CANCEL = 90
/* shorter than this is a tap, not a recording */
const MIN_MS = 350

type Phase = 'idle' | 'rec' | 'cancel'

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/* speech, roughly: syllables inside phrases, and gaps between */
function standIn(t: number) {
  const syll = Math.abs(Math.sin(t * 6.1) * Math.sin(t * 1.9 + 0.7))
  const phrase = Math.sin(t * 0.9 + 0.4) > -0.55 ? 1 : 0.1
  return Math.min(1, 0.06 + syll * phrase * (0.5 + Math.random() * 0.5))
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* the capsule filled, the stand drawn: solid like the play
   mark it becomes a clip beside, rather than lucide's outline */
function MicMark() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <rect x="8.5" y="2" width="7" height="12.5" rx="3.5" fill="currentColor" stroke="none" />
      <path d="M5 11.5a7 7 0 0 0 14 0" />
      <path d="M12 18.5V22" />
    </svg>
  )
}

export function VoiceNote({
  voice,
  /* how many bars the wave is drawn with */
  bars = 28,
  /* how tall a given level draws, 0..100 */
  gain = 60,
  /* how far the pill overshoots as it opens and closes, 0..100 */
  bounce = 40,
  corner = H / 2,
}: {
  voice: VoiceTyping
  bars?: number
  gain?: number
  bounce?: number
  corner?: number
}) {
  const listening = voice.status === 'listening' || voice.status === 'starting'
  const [closing, setClosing] = useState(false)
  const phase: Phase = closing ? 'cancel' : listening ? 'rec' : 'idle'

  const [levels, setLevels] = useState<number[]>([])
  const [ms, setMs] = useState(0)
  const [pull, setPull] = useState(0)
  const [latched, setLatched] = useState(false) // tap mode: listening with the finger up
  const pullRef = useRef(0)
  const holding = useRef(false)
  const raw = useRef<number[]>([])
  const t0 = useRef(0)
  const x0 = useRef(0)
  const later = useRef(0)

  // Live inputs for the sampler, read without re-rendering it.
  const levelRef = useRef(0)
  const lastWords = useRef(0)
  const engineRef = useRef(voice.engine)
  useEffect(() => {
    levelRef.current = voice.level
    engineRef.current = voice.engine
  })
  useEffect(() => {
    if (voice.interim) lastWords.current = performance.now()
  }, [voice.interim])

  const n = Math.round(clamp(bars, 12, 48))
  const g = 0.4 + (clamp(gain, 0, 100) / 100) * 1.2
  const r = clamp(corner, 0, H / 2)

  /* sample the level while listening */
  useEffect(() => {
    if (!listening) return
    raw.current = []
    setLevels([])
    t0.current = performance.now()
    const id = window.setInterval(() => {
      const took = performance.now() - t0.current
      const v =
        engineRef.current === 'offline'
          ? Math.min(1, levelRef.current * 1.4)
          : performance.now() - lastWords.current < 600
            ? standIn(took / 1000)
            : 0.04
      raw.current.push(v)
      setLevels(raw.current.slice(-64))
      setMs(took)
    }, SAMPLE)
    return () => window.clearInterval(id)
  }, [listening])

  useEffect(() => {
    if (!listening) {
      setLatched(false)
      holding.current = false
      pullRef.current = 0
      setPull(0)
    }
  }, [listening])

  useEffect(() => () => window.clearTimeout(later.current), [])

  /* the bars fold to nothing, then the pill closes */
  const fold = () => {
    setClosing(true)
    window.clearTimeout(later.current)
    later.current = window.setTimeout(() => setClosing(false), 360)
  }

  const finish = (cancel: boolean) => {
    holding.current = false
    fold()
    if (cancel) void voice.cancel()
    else void voice.stop()
  }

  /* ── the bars ─────────────────────────────────────────── */
  const bar = (v: number, i: number, key: string | number) => (
    <i key={key} className="vn-bar" style={{ '--l': clamp(v * g, 0, 1).toFixed(3), '--i': i } as React.CSSProperties} />
  )

  /* recording: the last n samples, right-aligned, and the rest
     of the row the resting dot a bar starts from */
  const recBars = () => {
    const start = raw.current.length - levels.length
    const out = []
    for (let j = 0; j < n; j++) {
      const k = levels.length - n + j
      out.push(k >= 0 ? bar(levels[k], j, start + k) : bar(0, j, `e${j}`))
    }
    return out
  }

  const shift = -pull * CANCEL * 0.5
  const armed = pull >= 1
  const showRec = phase === 'rec' || phase === 'cancel'
  const mlLabel = voice.lang === 'ml' ? 'മല' : 'EN'

  return (
    <div className="vn-frame">
      <div
        className="vn"
        data-phase={phase}
        data-latched={latched || undefined}
        role="button"
        tabIndex={0}
        aria-label={
          phase === 'rec'
            ? latched
              ? 'Listening. Tap to finish.'
              : 'Listening. Release to type it, slide left or Escape to discard.'
            : 'Hold to talk, or tap for hands-free voice typing'
        }
        style={
          {
            '--r': `${r}px`,
            '--ov': (1 + (clamp(bounce, 0, 100) / 100) * 0.7).toFixed(3),
            '--pull': pull.toFixed(3),
          } as React.CSSProperties
        }
        onPointerDown={(e) => {
          // keep the caret (and keyboard) where they are
          e.preventDefault()
          if (listening) {
            // latched: a tap on the pill finishes
            if (latched) finish(false)
            return
          }
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* a scripted pointer */
          }
          x0.current = e.clientX
          t0.current = performance.now()
          holding.current = true
          pullRef.current = 0
          setPull(0)
          void voice.start({ hold: true })
        }}
        onPointerMove={(e) => {
          if (!holding.current) return
          const p = clamp((x0.current - e.clientX) / CANCEL, 0, 1)
          /* all the way arms it — a tick as it catches — and
             sliding back disarms; letting go is what decides */
          pullRef.current = p
          setPull(p)
        }}
        onPointerUp={(e) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId)
          } catch {
            /* never captured */
          }
          if (!holding.current) return
          const took = performance.now() - t0.current
          if (took < MIN_MS && pullRef.current < 1) {
            // a tap: stay on, typing as it goes
            holding.current = false
            voice.release()
            setLatched(true)
            return
          }
          finish(pullRef.current >= 1)
        }}
        onPointerCancel={() => {
          if (holding.current) finish(false)
        }}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !listening) {
            e.preventDefault()
            holding.current = true
            t0.current = performance.now()
            void voice.start({ hold: true })
          } else if (e.key === 'Escape' && listening) {
            finish(true)
          }
        }}
        onKeyUp={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && holding.current) {
            e.preventDefault()
            finish(false)
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {phase === 'idle' && (
          <span key="idle" className="vn-in vn-idle">
            <MicMark />
            Hold to talk
            <button
              type="button"
              className="vn-lang"
              aria-label={voice.lang === 'ml' ? 'Language: Malayalam. Switch to English' : 'Language: English. Switch to Malayalam'}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
              }}
              onClick={(e) => {
                e.stopPropagation()
                void voice.setLang(voice.lang === 'ml' ? 'en' : 'ml')
              }}
            >
              {mlLabel}
            </button>
          </span>
        )}

        {showRec && (
          <span key="rec" className="vn-in vn-rec" style={{ translate: `${shift}px 0` }}>
            {latched && (
              <button
                type="button"
                className="vn-x"
                aria-label="Discard"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  finish(true)
                }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            )}
            <span className="vn-dot" />
            <span className="vn-time">{fmt(ms)}</span>
            <span className="vn-wave" style={{ '--n': n } as React.CSSProperties}>
              {recBars()}
            </span>
            {latched && (
              <button
                type="button"
                className="vn-play"
                aria-label="Done"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  finish(false)
                }}
              >
                <Check size={20} strokeWidth={2.4} />
              </button>
            )}
          </span>
        )}

        {/* slid all the way: the cancel mark takes the dot's
            place. It sits on the pill rather than in the sliding
            row, which by now has gone half out of the left edge */}
        {showRec && !latched && (
          <span className="vn-cancel" data-on={armed || undefined} aria-hidden="true">
            <X size={16} strokeWidth={2} />
          </span>
        )}
      </div>
      <span
        className="vn-hint"
        data-on={(phase === 'rec' && !latched) || undefined}
        data-armed={(phase === 'rec' && armed) || undefined}
        style={{ '--pull': pull.toFixed(3) } as React.CSSProperties}
        aria-hidden="true"
      >
        {phase === 'rec' && armed ? 'Release to cancel' : '‹ Slide to cancel'}
      </span>
    </div>
  )
}
