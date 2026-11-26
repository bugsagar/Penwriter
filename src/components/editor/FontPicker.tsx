import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X, XCircle } from 'lucide-react'
import { useApp } from '../../store/useApp'
import { DOC_FONTS, MALAYALAM_FONTS, MALAYALAM_FONT_DEFAULT, fontStackFor, sameFontForEnglish } from '../../utils/fonts'
import type { DocFontFamily, MalayalamFont } from '../../types'
import { cn } from '../ui'

type Choice = { kind: 'ml'; id: MalayalamFont } | { kind: 'doc'; id: DocFontFamily }
type Filter = 'all' | 'ml' | 'doc'

interface Option {
  key: string
  label: string
  stack: string
  on: boolean
  choice: Choice
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All fonts' },
  { id: 'ml', label: 'Google fonts (Malayalam + English)' },
  { id: 'doc', label: 'Classic screenplay fonts' },
]

const PANEL_W = 300
const PANEL_H = 440

/**
 * The script's one font, chosen like in a design tool: a field showing the
 * current font, which opens a "Fonts" panel with search, a filter, and every
 * font's name written in itself.
 *
 * Google's Malayalam fonts write both Malayalam and English; the classic
 * screenplay fonts (Courier…) write English, with Malayalam in Noto Sans.
 */
export function FontPicker() {
  const settings = useApp((s) => s.projects.find((p) => p.id === s.activeProjectId)?.settings)
  const setProjectSettings = useApp((s) => s.setProjectSettings)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const ml = settings?.malayalamFont ?? MALAYALAM_FONT_DEFAULT
  const doc = settings?.fontFamily ?? 'courier-prime'
  const oneFont = sameFontForEnglish(doc)

  const options: Option[] = useMemo(
    () => [
      ...MALAYALAM_FONTS.map((f) => ({
        key: `ml-${f.id}`,
        label: f.label,
        stack: fontStackFor('malayalam', f.id),
        on: oneFont && f.id === ml,
        choice: { kind: 'ml' as const, id: f.id },
      })),
      ...DOC_FONTS.filter((f) => !sameFontForEnglish(f.id)).map((f) => ({
        key: `doc-${f.id}`,
        label: f.label,
        stack: fontStackFor(f.id, oneFont ? MALAYALAM_FONT_DEFAULT : ml),
        on: !oneFont && f.id === doc,
        choice: { kind: 'doc' as const, id: f.id },
      })),
    ],
    [ml, doc, oneFont],
  )
  const cur = options.find((o) => o.on) ?? options[0]

  const q = query.trim().toLowerCase()
  const shown = options
    .filter((o) => filter === 'all' || o.choice.kind === filter)
    .filter((o) => !q || o.label.toLowerCase().includes(q))
    .sort((a, b) => a.label.localeCompare(b.label))

  const pick = (c: Choice) => {
    // a classic font writes Malayalam in Noto Sans
    setProjectSettings(
      c.kind === 'ml' ? { fontFamily: 'malayalam', malayalamFont: c.id } : { fontFamily: c.id, malayalamFont: MALAYALAM_FONT_DEFAULT },
    )
    setOpen(false)
  }

  // Float the panel over everything (the side panel scrolls and would clip
  // it): beside the field on wide screens, under it on phones.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const gap = 8
      if (vw < 640) {
        const top = Math.min(r.bottom + 6, vh - 320)
        setPos({ top, left: 16, width: vw - 32, maxH: vh - top - 16 })
        return
      }
      const width = PANEL_W
      // to the left of the field, like a design tool; else under it
      const left = r.left - width - gap >= gap ? r.left - width - gap : Math.min(r.left, vw - width - gap)
      const below = left === r.left - width - gap ? r.top - 60 : r.bottom + 6
      const top = Math.max(gap, Math.min(below, vh - PANEL_H - gap))
      setPos({ top, left, width, maxH: Math.min(PANEL_H, vh - top - gap) })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    // phones: don't pop the keyboard up over the list
    if (window.innerWidth >= 640) requestAnimationFrame(() => searchRef.current?.focus())
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  // the chosen font in view on opening
  useEffect(() => {
    if (open && pos) panelRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  }, [open, pos])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-lg border bg-white px-2.5 text-left text-[13.5px] text-ink-900 transition-colors dark:bg-ink-950 dark:text-ink-50',
          open ? 'border-brass-400' : 'border-ink-200 hover:border-ink-300 dark:border-ink-700 dark:hover:border-ink-500',
        )}
      >
        <span className="min-w-0 flex-1 truncate" style={{ fontFamily: cur.stack }}>
          {cur.label}
        </span>
        <ChevronDown size={15} className="shrink-0 text-ink-400" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Fonts"
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH }}
            className="animate-fade-slide-in fixed z-[80] flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-lift dark:border-ink-700 dark:bg-ink-900"
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
              <span className="text-[14px] font-semibold text-ink-900 dark:text-ink-50">Fonts</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="-mr-1.5 rounded-md p-1 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-3 pb-2.5">
              <label className="flex h-9 items-center gap-2 rounded-lg bg-ink-100/80 px-2.5 text-ink-500 focus-within:ring-1 focus-within:ring-brass-400 dark:bg-ink-800 dark:text-ink-400">
                <Search size={15} className="shrink-0" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search fonts"
                  aria-label="Search fonts"
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink-900 outline-none placeholder:text-ink-400 dark:text-ink-50"
                />
                {query && (
                  <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="shrink-0 hover:text-ink-900 dark:hover:text-ink-50">
                    <XCircle size={15} />
                  </button>
                )}
              </label>
            </div>

            <div className="border-t border-ink-100 px-3 py-2.5 dark:border-ink-800">
              <div className="relative">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as Filter)}
                  aria-label="Show"
                  className="h-8 w-full appearance-none rounded-lg border border-ink-200 bg-white pl-2.5 pr-8 text-[13px] text-ink-900 outline-none focus:border-brass-400 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-50"
                >
                  {FILTERS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              </div>
            </div>

            <div role="listbox" aria-label="Fonts" className="min-h-0 flex-1 overflow-y-auto pb-2">
              {shown.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-ink-400">No fonts match “{query}”</p>}
              {shown.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  role="option"
                  aria-selected={o.on}
                  onClick={() => pick(o.choice)}
                  className={cn(
                    'flex w-full items-center gap-2 py-2 pl-3 pr-4 text-left text-ink-900 transition-colors dark:text-ink-50',
                    o.on ? 'bg-ink-100 dark:bg-ink-800' : 'hover:bg-ink-50 dark:hover:bg-ink-800/60',
                  )}
                >
                  <span className="flex w-4 shrink-0 justify-center">{o.on && <Check size={15} strokeWidth={2.5} />}</span>
                  <span className="min-w-0 flex-1 truncate text-[18px] leading-tight" style={{ fontFamily: o.stack }}>
                    {o.label.replace(' (handwritten)', '')}
                  </span>
                  <span className="shrink-0 text-[15px] text-ink-400 dark:text-ink-500" style={{ fontFamily: o.stack }}>
                    മലയാളം
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
