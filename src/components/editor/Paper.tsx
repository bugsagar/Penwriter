import { useCallback, useRef, useEffect, useLayoutEffect, useState, useMemo } from 'react'
import { flushSync } from 'react-dom'
import type { ScreenplayElement } from '../../types'
import type { CSSProperties } from 'react'
import { useApp } from '../../store/useApp'
import { fontStackFor, FONT_SIZE_DEFAULT } from '../../utils/fonts'
import { ElementBlock } from './ElementBlock'
import { setCaret } from '../../utils/focus'
import { uid } from '../../utils/id'
import { nextTypeAfterEnter } from '../../utils/detect'
import { sheetsOf, type SheetPart } from '../../utils/layout'

interface PaperProps {
  elements: ScreenplayElement[]
  selectedId: string | null
  readOnly: boolean
  query: string
  matches: { id: string }[]
  activeMatch: number
  onSelect: (id: string) => void
  scrollToId: (id: string) => void
  /** Phone layout: fluid page, no zoom, proportional indents. */
  compact?: boolean
  /** Phone layout: render only this page. */
  pageIndex?: number
  /** Phone layout: the caret moved onto another page (text flowed there). */
  onFollowPage?: (page: number) => void
  /** Open page notes per page, shown as a marker on the page. */
  noteCounts?: Record<number, number>
  onOpenNotes?: (page: number) => void
}

function NoteMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
      <path d="M15 3v4a2 2 0 0 0 2 2h4" />
    </svg>
  )
}

/** A split paragraph's first piece is registered under the element id (so
 *  focusing "the line" lands at its start); later pieces get their own key. */
const partKey = (p: { el: { id: string }; start: number }) => (p.start === 0 ? p.el.id : `${p.el.id}@${p.start}`)

export function Paper({
  elements,
  selectedId,
  readOnly,
  query,
  matches,
  activeMatch,
  onSelect,
  scrollToId,
  compact = false,
  pageIndex,
  onFollowPage,
  noteCounts,
  onOpenNotes,
}: PaperProps) {
  const updateElement = useApp((s) => s.updateElement)
  const insertElements = useApp((s) => s.insertElements)
  const removeElement = useApp((s) => s.removeElement)
  const typewriter = useApp((s) => s.canvasStyle === 'typewriter') && !compact
  const settings = useApp((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.settings,
  )

  const refs = useRef(new Map<string, HTMLDivElement>())
  const sheetRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Scale the US-Letter sheet down only when the column is narrower than
  // the page, so content always fits centered with nothing cut off.
  const [fitZoom, setFitZoom] = useState(1)
  useEffect(() => {
    const scroller = wrapRef.current?.closest('main')
    if (!scroller || compact) {
      setFitZoom(1)
      return
    }
    const update = () => {
      const z = Math.min(1, (scroller.clientWidth - 48) / 816)
      setFitZoom((prev) => (Math.abs(prev - z) < 0.001 ? prev : z))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(scroller)
    return () => ro.disconnect()
  }, [compact])

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) refs.current.set(id, el)
    else refs.current.delete(id)
  }, [])

  const focusId = useCallback((id: string, pos: 'start' | 'end' | number = 'start') => {
    const node = refs.current.get(id)
    if (node) setCaret(node, pos)
  }, [])

  const handleFocusNeighbor = useCallback(
    (index: number, dir: -1 | 1, pos: 'start' | 'end') => {
      const target = elements[index + dir]
      if (target) focusId(target.id, pos)
    },
    [elements, focusId],
  )

  const handleRemove = useCallback(
    (id: string, index: number) => {
      removeElement(id)
      const target = index > 0 ? elements[index - 1] : elements[1]
      if (target) {
        requestAnimationFrame(() => focusId(target.id, 'end'))
      }
    },
    [elements, removeElement, focusId],
  )

  useEffect(() => {
    if (!readOnly || matches.length === 0) return
    const m = matches[activeMatch]
    if (m) scrollToId(m.id)
  }, [activeMatch, matches, readOnly, scrollToId])

  const autoDetect = settings?.autoDetectElements ?? true
  // A typewriter types in Courier — its column scale depends on it.
  const docFont = fontStackFor(typewriter ? 'courier-prime' : settings?.fontFamily)
  const docSize = settings?.fontSizePt ?? FONT_SIZE_DEFAULT

  // One sheet per scene ("page"), so every created page is visible as its
  // own layer with a 14px gap to the next — matching the Pages menu.
  const pages = useMemo(() => {
    return sheetsOf(elements)
  }, [elements])
  /*
   * A line that no longer fits moves onto the next sheet, which re-creates it
   * there — and a re-created line has no caret. Remember where the caret was
   * and put it back, so typing carries straight on across the page break.
   */
  const caretMemo = useRef<{ id: string; offset: number; at: number } | null>(null)
  // The caret's position in the whole paragraph (a split paragraph's pieces
  // each know where they start in it).
  const caretNow = (): { id: string; offset: number } | null => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const n = sel.focusNode
    const host = (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('[data-elid]')
    if (!host?.dataset.elid) return null
    const r = document.createRange()
    r.selectNodeContents(host)
    r.setEnd(sel.focusNode!, sel.focusOffset)
    return { id: host.dataset.elid, offset: Number(host.dataset.fragStart ?? 0) + r.toString().length }
  }
  // While a caret is being put back (possibly after a page change on the
  // phone), the browser reports the caret's interim jumps — ignore those.
  const restoring = useRef<{ id: string; offset: number; at: number } | null>(null)
  useEffect(() => {
    const onSel = () => {
      if (restoring.current && performance.now() - restoring.current.at < 800) return
      restoring.current = null
      const c = caretNow()
      if (c) caretMemo.current = { ...c, at: performance.now() }
    }
    document.addEventListener('selectionchange', onSel)
    // input fires before React re-renders, so the caret is current even when
    // this keystroke is the one that pushes the line onto the next page
    document.addEventListener('input', onSel, true)
    document.addEventListener('reel:caret', onSel)
    return () => {
      document.removeEventListener('selectionchange', onSel)
      document.removeEventListener('input', onSel, true)
      document.removeEventListener('reel:caret', onSel)
    }
  }, [])
  // Runs after the lines have synced their text (children's effects run
  // first), so a piece whose text just changed under the caret is fixed too.
  useEffect(() => {
    const m = restoring.current ?? caretMemo.current
    if (!m || performance.now() - m.at > 2000) return
    const now = caretNow()
    const active = document.activeElement as HTMLElement | null
    const inLine = !!active?.closest?.('[data-elid]')
    if (inLine && now && now.id === m.id && now.offset === m.offset) return // caret is fine
    if (inLine && now && now.id !== m.id) return // the user moved elsewhere
    if (inLine && now && active) {
      // The caret's piece still holds where it was: the caret just moved
      // within it (Enter's soft line break, say) faster than selectionchange
      // reports. Keep it — putting back the older spot would undo the move.
      const host = active.closest<HTMLElement>('[data-elid]')!
      const from = Number(host.dataset.fragStart ?? 0)
      const to = from + (host.textContent ?? '').length
      if (m.offset >= from && m.offset <= to) {
        caretMemo.current = { ...now, at: performance.now() }
        return
      }
    }
    // The line got shorter than where the caret was (Enter trimmed it and
    // moved on to a new line): that spot is gone, so leave the caret be.
    const el = pages.flat().find((p) => p.el.id === m.id)?.el
    if (!el || m.offset > el.text.length) {
      caretMemo.current = null
      restoring.current = null
      return
    }
    // the piece of the paragraph that holds the caret now
    let target: { pi: number; part: SheetPart } | null = null
    pages.forEach((pg, pi) =>
      pg.forEach((part) => {
        if (part.el.id === m.id && m.offset >= part.start && (m.offset <= part.end || !target)) {
          if (!target || part.start >= target.part.start) target = { pi, part }
        }
      }),
    )
    if (!target) return
    const { pi, part } = target as { pi: number; part: SheetPart }
    restoring.current = { id: m.id, offset: m.offset, at: performance.now() }
    if (pageIndex !== undefined && pi !== pageIndex) {
      onFollowPage?.(pi) // phone: go to the page it flowed onto; this runs again there
      return
    }
    const node = refs.current.get(partKey(part))
    if (node && node.isConnected) setCaret(node, m.offset - part.start)
    caretMemo.current = { id: m.id, offset: m.offset, at: performance.now() }
    // let the browser's report of this caret move pass, then track normally
    requestAnimationFrame(() => {
      restoring.current = null
    })
  }, [pages, pageIndex, onFollowPage])

  const indexOf = useMemo(() => new Map(elements.map((el, i) => [el.id, i])), [elements])
  const partsOf = (id: string) => pages.flat().filter((p) => p.el.id === id)


  /*
   * Tap/click anywhere on the canvas to write there:
   *  - beside or between lines → caret goes into the nearest line
   *  - below the last line of a page → a new line starts right there
   * Listens on the whole scrolling canvas (<main>), not just the text.
   * The new line is rendered synchronously (flushSync) so focus happens inside
   * the tap itself — phones only open the keyboard for focus in a user gesture.
   */
  const stateRef = useRef({ elements, pages, indexOf, readOnly, pageIndex })
  useLayoutEffect(() => {
    stateRef.current = { elements, pages, indexOf, readOnly, pageIndex }
  })

  useEffect(() => {
    const canvas = wrapRef.current?.closest('main')
    if (!canvas) return

    const newLineAfter = (after: ScreenplayElement | undefined, at: number) => {
      if (after && after.text === '' && after.type !== 'SCENE_HEADING') {
        focusId(after.id, 'end')
        return
      }
      let type = after ? nextTypeAfterEnter(after.type, after.text) : 'ACTION'
      if (after?.type === 'DIALOGUE') type = 'ACTION'
      const el: ScreenplayElement = { id: uid('el'), type, text: '' }
      flushSync(() => insertElements(at, [el]))
      focusId(el.id, 'end')
    }

    const caretAt = (node: HTMLElement, x: number, y: number) => {
      const r = node.getBoundingClientRect()
      const cx = Math.min(Math.max(x, r.left + 1), r.right - 1)
      const cy = Math.min(Math.max(y, r.top + 1), r.bottom - 1)
      const range = document.caretRangeFromPoint?.(cx, cy)
      if (range && node.contains(range.startContainer)) {
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
        node.focus({ preventScroll: true })
      } else {
        setCaret(node, 'end')
      }
    }

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const { elements, pages, indexOf, readOnly, pageIndex } = stateRef.current
      if (readOnly) return
      const target = e.target as HTMLElement
      if (target.closest('[data-elid], [data-typewriter-deck], button, a, input, textarea, select, [role="menu"], [role="listbox"]')) return

      // Which lines are candidates: the page tapped on (or showing), else all.
      const sheet = target.closest<HTMLElement>('[data-sheet]')
      const pi = pageIndex ?? (sheet ? Number(sheet.dataset.sheet) : -1)
      const pool: SheetPart[] = pi >= 0 ? (pages[pi] ?? []) : elements.map((el) => ({ el, start: 0, end: el.text.length }))

      e.preventDefault()
      if (pool.length === 0) {
        newLineAfter(undefined, elements.length)
        return
      }

      const last = pool[pool.length - 1]
      const lastNode = refs.current.get(partKey(last))
      if (lastNode && e.clientY > lastNode.getBoundingClientRect().bottom) {
        newLineAfter(last.el, (indexOf.get(last.el.id) ?? elements.length - 1) + 1)
        return
      }

      // Nearest line by vertical distance.
      let best: HTMLElement | null = null
      let bestD = Infinity
      for (const part of pool) {
        const node = refs.current.get(partKey(part))
        if (!node) continue
        const r = node.getBoundingClientRect()
        const d = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0
        if (d < bestD) {
          bestD = d
          best = node
        }
        if (d === 0) break
      }
      if (best) caretAt(best, e.clientX, e.clientY)
    }

    canvas.addEventListener('mousedown', onDown)
    return () => canvas.removeEventListener('mousedown', onDown)
  }, [focusId, insertElements])

  return (
    <div ref={wrapRef} className="flex h-full flex-col">
      <div
        className={
          compact
            ? 'sp-compact relative w-full'
            : typewriter
              ? 'paper-sheen relative mx-auto my-0 w-[8.5in]'
              : 'paper-doc relative mx-auto my-0 w-[8.5in]'
        }
        style={compact ? undefined : ({ zoom: fitZoom } as CSSProperties)}
      >
        {pages.map((pg, pi) => pageIndex !== undefined && pi !== pageIndex ? null : (
          <div
            key={pi}
            ref={pi === 0 ? sheetRef : undefined}
            data-sheet={pi}
            style={
              {
                '--sp-font': docFont,
                '--sp-size': `${docSize}pt`,
                marginBottom: pi < pages.length - 1 && pageIndex === undefined ? (typewriter ? 14 : 20) : 0,
              } as CSSProperties
            }
            className={
              compact
                ? 'relative pb-6 text-ink-900'
                : typewriter
                  ? 'relative min-h-[11in] bg-paper px-[1.5in] pb-[1in] pt-[1in] text-ink-900 shadow-paper dark:bg-[#fdfdfc]'
                  : 'paper-card relative min-h-[11in] px-[1.5in] pb-[1in] pt-[1in]'
            }
          >
            {!!noteCounts?.[pi] && onOpenNotes && (
              <button
                type="button"
                onClick={() => onOpenNotes(pi)}
                title={`${noteCounts[pi]} note${noteCounts[pi] === 1 ? '' : 's'} on this page`}
                className={
                  compact
                    ? 'absolute -top-1 right-0 z-10 flex items-center gap-1 rounded-full bg-[#fdf3cf] px-2 py-0.5 font-sans text-[11px] font-semibold text-[#6b5208] shadow-sm'
                    : 'absolute right-[0.35in] top-[0.35in] z-10 flex items-center gap-1 rounded-full bg-[#fdf3cf] px-2 py-1 font-sans text-[12px] font-semibold text-[#6b5208] shadow-sm transition-transform hover:scale-105'
                }
              >
                <NoteMark />
                {noteCounts[pi]}
              </button>
            )}
            {pg.map((part) => {
              const el = part.el
              const i = indexOf.get(el.id) ?? 0
              const whole = part.start === 0 && part.end >= el.text.length
              const key = partKey(part)
              // a piece of a paragraph split across pages edits its slice of the text
              const piece = whole ? el : { ...el, text: el.text.slice(part.start, part.end) }
              return (
                <div key={key}>
                  <ElementBlock
                    element={piece}
                    index={i}
                    total={elements.length}
                    isActive={el.id === selectedId}
                    readOnly={readOnly}
                    autoDetect={autoDetect && whole}
                    query={query}
                    registerRef={(_id, node) => registerRef(key, node)}
                    onSelect={onSelect}
                    onChangeType={(id, type) => updateElement(id, { type })}
                    onUpdate={(id, text, type) => {
                      let full = text
                      if (!whole) {
                        const cur = useApp.getState().projects.find((p) => p.id === useApp.getState().activeProjectId)
                          ?.elements.find((x) => x.id === id)?.text ?? el.text
                        full = cur.slice(0, part.start) + text + cur.slice(part.end)
                      }
                      if (type) updateElement(id, { text: full, type })
                      else updateElement(id, { text: full })
                    }}
                    onInsert={(index, els) => insertElements(index, els)}
                    onRemove={handleRemove}
                    onFocusNeighbor={(index, dir, pos) => {
                      // within a split paragraph, step to its other piece first
                      const sib = partsOf(el.id).find((p) => (dir < 0 ? p.end === part.start : p.start === part.end))
                      const node = sib && refs.current.get(partKey(sib))
                      if (node) setCaret(node, dir < 0 ? 'end' : 'start')
                      else handleFocusNeighbor(index, dir, pos)
                    }}
                    fragStart={part.start}
                  />
                </div>
              )
            })}
            {(pi === pages.length - 1 || (compact && pageIndex !== undefined)) && (
              /* continuation area: blank paper where a click keeps writing */
              <div className="cursor-text select-none" style={{ height: compact ? '40vh' : '3in' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
