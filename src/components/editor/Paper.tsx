import { useCallback, useRef, useEffect, useLayoutEffect, useState, useMemo } from 'react'
import { flushSync } from 'react-dom'
import type { ScreenplayElement } from '../../types'
import type { CSSProperties } from 'react'
import { useApp } from '../../store/useApp'
import { fontStackFor, FONT_SIZE_DEFAULT } from '../../utils/fonts'
import { sceneChunks } from '../../utils/scenes'
import { ElementBlock } from './ElementBlock'
import { setCaret } from '../../utils/focus'
import { uid } from '../../utils/id'
import { nextTypeAfterEnter } from '../../utils/detect'

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
  /** Phone layout: render only this page (scene). */
  pageIndex?: number
}

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
    const c = sceneChunks(elements)
    return c.length ? c : ([[]] as ScreenplayElement[][])
  }, [elements])
  const indexOf = useMemo(() => new Map(elements.map((el, i) => [el.id, i])), [elements])

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
      const pool = pi >= 0 ? (pages[pi] ?? []) : elements

      e.preventDefault()
      if (pool.length === 0) {
        newLineAfter(undefined, elements.length)
        return
      }

      const last = pool[pool.length - 1]
      const lastNode = refs.current.get(last.id)
      if (lastNode && e.clientY > lastNode.getBoundingClientRect().bottom) {
        newLineAfter(last, (indexOf.get(last.id) ?? elements.length - 1) + 1)
        return
      }

      // Nearest line by vertical distance.
      let best: HTMLElement | null = null
      let bestD = Infinity
      for (const el of pool) {
        const node = refs.current.get(el.id)
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
                ? 'pb-6 text-ink-900'
                : typewriter
                  ? 'min-h-[11in] bg-paper px-[1.5in] pb-[1in] pt-[1in] text-ink-900 shadow-paper dark:bg-[#fdfdfc]'
                  : 'paper-card min-h-[11in] px-[1.5in] pb-[1in] pt-[1in]'
            }
          >
            {pg.map((el) => {
              const i = indexOf.get(el.id) ?? 0
              return (
                <div key={el.id}>
                  <ElementBlock
                    element={el}
                    index={i}
                    total={elements.length}
                    isActive={el.id === selectedId}
                    readOnly={readOnly}
                    autoDetect={autoDetect}
                    query={query}
                    registerRef={registerRef}
                    onSelect={onSelect}
                    onChangeType={(id, type) => updateElement(id, { type })}
                    onUpdate={(id, text, type) =>
                      type ? updateElement(id, { text, type }) : updateElement(id, { text })
                    }
                    onInsert={(index, els) => insertElements(index, els)}
                    onRemove={handleRemove}
                    onFocusNeighbor={handleFocusNeighbor}
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
