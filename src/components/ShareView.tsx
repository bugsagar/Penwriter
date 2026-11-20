import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, ChevronLeft, ChevronRight, Link2, Lock, Minus, Plus, X } from 'lucide-react'
import logoUrl from '../assets/logo.svg'
import { decodeShare, isProtected, linkFor, takeUnlock, WrongCodeError, type SharedScript } from '../utils/share'
import { paginate } from '../utils/layout'
import { fontStackFor, FONT_SIZE_DEFAULT } from '../utils/fonts'
import { cn } from './ui'

/*
 * The read-only view of a shared script — in the spirit of Figma's
 * prototype share page: a quiet dark canvas, the pages floating on it, and
 * one slim bar for the title, page, zoom and what you can do with it.
 */

const PAGE_PX = 816 // 8.5in at 96px
const ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5]

export function ShareView({ code, fresh, onExit }: { code: string; fresh: boolean; onExit: () => void }) {
  const [script, setScript] = useState<SharedScript | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fit, setFit] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [fitZoom, setFitZoom] = useState(1)
  const [page, setPage] = useState(0)
  const [copied, setCopied] = useState(false)
  const [banner, setBanner] = useState(fresh)
  const canvasRef = useRef<HTMLDivElement>(null)
  // locked links: the reader types the 6-digit code first
  const [needCode, setNeedCode] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [ownCode, setOwnCode] = useState<string | null>(null) // the writer opening their own link

  const open = useCallback(
    async (lock?: string) => {
      try {
        const s = await decodeShare(code, lock)
        setScript(s)
        setNeedCode(false)
        document.title = `${s.title || 'Untitled'} — Ezuth`
      } catch (e) {
        if (e instanceof WrongCodeError) {
          setCodeError(e.message)
          setCodeInput('')
          setNeedCode(true)
        } else setError((e as Error).message || 'This link could not be opened.')
      }
    },
    [code],
  )

  useEffect(() => {
    if (!isProtected(code)) {
      void open()
      return
    }
    const mine = takeUnlock(code)
    if (mine) {
      setOwnCode(mine)
      void open(mine)
    } else {
      document.title = 'Protected script — Ezuth' // nothing about the script before the code
      setNeedCode(true)
    }
  }, [code, open])

  const unlock = async (value: string) => {
    if (value.length !== 6 || unlocking) return
    setUnlocking(true)
    setCodeError(null)
    await open(value)
    setUnlocking(false)
  }

  const pages = useMemo(() => (script ? paginate(script.elements) : []), [script])
  // a title page first, like the PDF: the script's name and who wrote it
  const hasTitlePage = !!script && !!(script.title.trim() || script.author.trim())
  const sheetCount = pages.length + (hasTitlePage ? 1 : 0)
  // what the counter says for sheet i
  const sheetLabel = (i: number, short = false) =>
    hasTitlePage && i === 0
      ? 'Title page'
      : short
        ? `${i + (hasTitlePage ? 0 : 1)} / ${pages.length}`
        : `Page ${i + (hasTitlePage ? 0 : 1)} of ${Math.max(1, pages.length)}`
  const z = fit ? fitZoom : zoom

  // Fit: the page fills the canvas width, never larger than 100%.
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const update = () => setFitZoom(Math.min(1, (el.clientWidth - (el.clientWidth < 640 ? 24 : 96)) / PAGE_PX))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [script])

  // Which page is in view.
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onScroll = () => {
      const mid = el.getBoundingClientRect().top + el.clientHeight * 0.35
      const sheets = [...el.querySelectorAll<HTMLElement>('[data-share-page]')]
      let cur = 0
      sheets.forEach((s, i) => {
        if (s.getBoundingClientRect().top <= mid) cur = i
      })
      setPage(cur)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [pages, z])

  const goTo = useCallback(
    (i: number) => {
      const el = canvasRef.current
      const target = el?.querySelectorAll<HTMLElement>('[data-share-page]')[Math.max(0, Math.min(sheetCount - 1, i))]
      if (el && target) el.scrollTo({ top: el.scrollTop + target.getBoundingClientRect().top - el.getBoundingClientRect().top - 24, behavior: 'smooth' })
    },
    [sheetCount],
  )

  const stepZoom = useCallback(
    (dir: 1 | -1) => {
      const cur = fit ? fitZoom : zoom
      const next = dir > 0 ? ZOOMS.find((v) => v > cur + 0.001) : [...ZOOMS].reverse().find((v) => v < cur - 0.001)
      if (next) {
        setFit(false)
        setZoom(next)
      }
    },
    [fit, fitZoom, zoom],
  )

  // Keyboard: arrows / page keys move by page, +/- zoom, 0 fits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        goTo(page + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goTo(page - 1)
      } else if (e.key === '+' || e.key === '=') stepZoom(1)
      else if (e.key === '-') stepZoom(-1)
      else if (e.key === '0') setFit(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, page, stepZoom])

  // always the clean link (never this tab's "just opened" flag)
  const copyLink = async () => {
    const url = linkFor(code)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  const iconBtn =
    'flex h-8 w-8 items-center justify-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent'

  if (needCode && !script) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-[#1e1e1e] px-6 text-white">
        <div className="w-full max-w-[340px] rounded-[22px] border border-white/[0.08] bg-[#2c2c2c] p-6 text-center shadow-2xl">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#e8734e]/15 text-[#f0a35e]">
            <Lock size={20} />
          </span>
          <h1 className="text-[17px] font-semibold">This script is protected</h1>
          <p className="mt-1 text-[13px] text-white/60">Enter the 6-digit code you were given.</p>
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault()
              void unlock(codeInput)
            }}
          >
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={codeInput}
              aria-label="6-digit code"
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCodeInput(v)
                setCodeError(null)
                if (v.length === 6) void unlock(v)
              }}
              placeholder="••••••"
              className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] py-3 text-center font-mono text-[28px] tracking-[0.45em] text-white outline-none placeholder:text-white/20 focus:border-[#e8734e]"
            />
            {codeError && <p className="mt-2 text-[12.5px] text-[#ff8a7a]">{codeError}</p>}
            <button
              type="submit"
              disabled={codeInput.length !== 6 || unlocking}
              className="mt-4 h-11 w-full rounded-full bg-[#e8734e] text-[14px] font-semibold text-white transition-colors hover:bg-[#d9653f] disabled:opacity-40"
            >
              {unlocking ? 'Unlocking…' : 'Open script'}
            </button>
          </form>
        </div>
        <img src={logoUrl} alt="Ezuth" className="mt-6 h-6 w-auto opacity-50" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-[#1e1e1e] px-6 text-center text-white">
        <img src={logoUrl} alt="Ezuth" className="h-10 w-auto opacity-90" />
        <p className="max-w-sm text-[15px] text-white/80">{error}</p>
        <button type="button" onClick={onExit} className="rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1e1e1e]">
          Open Ezuth
        </button>
      </div>
    )
  }

  const docFont = fontStackFor(script?.fontFamily)
  const docSize = script?.fontSizePt ?? FONT_SIZE_DEFAULT

  return (
    <div className="flex h-dvh flex-col bg-[#1e1e1e] text-white">
      {/* ---- the one bar ---- */}
      <header className="pt-safe flex h-12 shrink-0 items-center gap-2 border-b border-white/[0.08] bg-[#2c2c2c] px-2 sm:px-3">
        <button type="button" onClick={onExit} title="Open Ezuth" className="flex h-8 shrink-0 items-center rounded-md px-1.5 hover:bg-white/10">
          <img src={logoUrl} alt="Ezuth" className="h-6 w-auto" />
        </button>
        <span className="h-5 w-px shrink-0 bg-white/15" />
        <div className="min-w-0 flex-1 sm:flex-none">
          <p className="truncate text-[13px] font-semibold leading-tight">{script?.title || 'Untitled'}</p>
          <p className="truncate text-[11px] leading-tight text-white/50">
            {script?.author ? `by ${script.author} · ` : ''}View only
          </p>
        </div>

        {/* page */}
        <div className="mx-auto hidden items-center gap-1 sm:flex">
          <button type="button" className={iconBtn} aria-label="Previous page" disabled={page <= 0} onClick={() => goTo(page - 1)}>
            <ChevronLeft size={17} />
          </button>
          <span className="min-w-[92px] text-center text-[12.5px] tabular-nums text-white/80">
            {sheetLabel(Math.min(page, sheetCount - 1))}
          </span>
          <button type="button" className={iconBtn} aria-label="Next page" disabled={page >= sheetCount - 1} onClick={() => goTo(page + 1)}>
            <ChevronRight size={17} />
          </button>
        </div>

        {/* zoom + actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          <div className="mr-1 hidden items-center gap-0.5 md:flex">
            <button type="button" className={iconBtn} aria-label="Zoom out" onClick={() => stepZoom(-1)}>
              <Minus size={15} />
            </button>
            <button
              type="button"
              onClick={() => setFit((f) => !f)}
              title={fit ? 'Actual size' : 'Fit to width'}
              className="h-8 min-w-[52px] rounded-md px-1.5 text-[12px] tabular-nums text-white/80 hover:bg-white/10"
            >
              {fit ? 'Fit' : `${Math.round(z * 100)}%`}
            </button>
            <button type="button" className={iconBtn} aria-label="Zoom in" onClick={() => stepZoom(1)}>
              <Plus size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="ml-1 flex h-8 items-center gap-1.5 rounded-md bg-[#e8734e] px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#d9653f]"
          >
            {copied ? <Check size={15} /> : <Link2 size={15} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy link'}</span>
          </button>
        </div>
      </header>

      {/* ---- first open from the editor: what this page is ---- */}
      {banner && (
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] bg-[#252525] px-4 py-2 text-[12.5px] text-white/80">
          <span className="flex-1">
            {ownCode ? (
              <>
                Your locked view-only link. Readers need the code{' '}
                <b className="font-mono tracking-[0.15em] text-white">{ownCode}</b> — send it separately from the link.
              </>
            ) : (
              <>This is your script&apos;s view-only link. Anyone you send it to can read it — they can&apos;t change your copy.</>
            )}
          </span>
          <button type="button" onClick={copyLink} className="shrink-0 font-semibold text-[#f0a35e] hover:text-[#ffbe85]">
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button type="button" aria-label="Dismiss" onClick={() => setBanner(false)} className="shrink-0 rounded p-0.5 text-white/50 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ---- the canvas ---- */}
      <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-auto">
        {!script ? (
          <div className="flex h-full items-center justify-center text-[13px] text-white/50">Opening…</div>
        ) : (
          // w-max: when zoomed wider than the screen, every edge stays scrollable
          <div className="flex w-max min-w-full flex-col items-center gap-6 px-3 py-6 sm:py-10">
            {hasTitlePage && (
              <div
                data-share-page
                className="relative flex shrink-0 flex-col items-center bg-white text-[#1a1a1a] shadow-[0_2px_8px_rgb(0_0_0/0.35),0_18px_50px_-12px_rgb(0_0_0/0.55)]"
                style={{ zoom: z, width: '8.5in', height: '11in', padding: '1in', fontFamily: docFont } as CSSProperties}
              >
                {/* same spots as the PDF's title page */}
                <div className="flex w-full flex-col items-center text-center" style={{ marginTop: '3.9in' }}>
                  <p className="font-bold uppercase" style={{ fontSize: (script?.title.length ?? 0) > 24 ? '22pt' : '30pt', lineHeight: 1.15 }}>
                    {script?.title.trim() || 'Untitled'}
                  </p>
                  {script?.author.trim() && (
                    <>
                      <p className="mt-[0.35in]" style={{ fontSize: '14pt' }}>written by</p>
                      <p className="mt-[0.12in] uppercase" style={{ fontSize: '16pt' }}>{script.author.trim()}</p>
                    </>
                  )}
                </div>
              </div>
            )}
            {pages.map((p, pi) => (
              <div
                key={pi}
                data-share-page
                className="relative shrink-0 bg-white text-[#1a1a1a] shadow-[0_2px_8px_rgb(0_0_0/0.35),0_18px_50px_-12px_rgb(0_0_0/0.55)]"
                style={
                  {
                    zoom: z,
                    width: '8.5in',
                    height: '11in',
                    padding: '1in 1in 1in 1.5in',
                    '--sp-font': docFont,
                    '--sp-size': `${docSize}pt`,
                  } as CSSProperties
                }
              >
                {pi > 0 && (
                  <span className="absolute right-[1in] top-[0.5in] font-mono text-[12pt]" style={{ fontFamily: docFont }}>
                    {pi + 1}.
                  </span>
                )}
                {p.items.map((it, ii) => {
                  const el = it.element
                  return (
                    <div
                      key={ii}
                      className={cn('sp-block', `sp-${el.type.toLowerCase().replace('_', '-')}`)}
                      style={{
                        fontWeight: el.bold === false ? 400 : el.bold ? 700 : undefined,
                        fontStyle: el.italic ? 'italic' : undefined,
                        textDecorationLine: el.underline ? 'underline' : undefined,
                        textAlign: el.align,
                        color: el.color,
                      }}
                    >
                      {el.text.slice(it.start, it.end) || ' '}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* phone: page pill at the bottom */}
        {script && sheetCount > 1 && (
          <div className="pb-safe pointer-events-none sticky bottom-3 flex justify-center sm:hidden">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#2c2c2c]/95 px-1 py-1 shadow-lg backdrop-blur">
              <button type="button" className={cn(iconBtn, 'rounded-full')} aria-label="Previous page" disabled={page <= 0} onClick={() => goTo(page - 1)}>
                <ChevronLeft size={17} />
              </button>
              <span className="min-w-[56px] text-center text-[12.5px] tabular-nums text-white/85">
                {hasTitlePage && page === 0 ? 'Title' : sheetLabel(page, true)}
              </span>
              <button type="button" className={cn(iconBtn, 'rounded-full')} aria-label="Next page" disabled={page >= sheetCount - 1} onClick={() => goTo(page + 1)}>
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* made with */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault()
          onExit()
        }}
        className="pointer-events-auto fixed bottom-4 left-4 hidden rounded-full bg-[#2c2c2c]/90 px-3 py-1.5 text-[11.5px] text-white/60 shadow-lg backdrop-blur hover:text-white sm:block"
      >
        Made with <span className="font-semibold text-white/85">Ezuth</span>
      </a>
    </div>
  )
}
