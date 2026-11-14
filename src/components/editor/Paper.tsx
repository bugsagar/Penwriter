import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import type { ScreenplayElement } from '../../types'
import type { CSSProperties } from 'react'
import { useApp } from '../../store/useApp'
import { fontStackFor, FONT_SIZE_DEFAULT } from '../../utils/fonts'
import { sceneChunks } from '../../utils/scenes'
import { ElementBlock } from './ElementBlock'
import { setCaret } from '../../utils/focus'
import { uid } from '../../utils/id'

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
  const docFont = fontStackFor(settings?.fontFamily)
  const docSize = settings?.fontSizePt ?? FONT_SIZE_DEFAULT

  // One sheet per scene ("page"), so every created page is visible as its
  // own layer with a 14px gap to the next — matching the Pages menu.
  const pages = useMemo(() => {
    const c = sceneChunks(elements)
    return c.length ? c : ([[]] as ScreenplayElement[][])
  }, [elements])
  const indexOf = useMemo(() => new Map(elements.map((el, i) => [el.id, i])), [elements])

  // Clicking blank paper below the last element should let the writer keep
  // typing. Ensure a trailing empty Action exists and place the caret there.
  const continueWriting = useCallback(() => {
    const last = elements[elements.length - 1]
    const focus = (id: string) =>
      requestAnimationFrame(() => focusId(id, 'end'))
    if (!last) {
      const el: ScreenplayElement = { id: uid('el'), type: 'ACTION', text: '' }
      insertElements(0, [el])
      focus(el.id)
      return
    }
    if (last.text === '' && last.type !== 'SCENE_HEADING') {
      focus(last.id)
      return
    }
    const el: ScreenplayElement = { id: uid('el'), type: 'ACTION', text: '' }
    insertElements(elements.length, [el])
    focus(el.id)
  }, [elements, insertElements, focusId])

  // Only clicks in the end-zone (below the last element) start new writing;
  // clicks on blocks, type tags, or mid-document whitespace are untouched.
  const handleSheetMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-elid]')) return
    if (readOnly) return
    // Phone single-page view: blank space below a middle page keeps writing on that page.
    if (pageIndex !== undefined && pageIndex < pages.length - 1) {
      const pageLast = pages[pageIndex]?.[pages[pageIndex].length - 1]
      if (pageLast) {
        e.preventDefault()
        focusId(pageLast.id, 'end')
      }
      return
    }
    const lastEl = elements[elements.length - 1]
    if (!lastEl) {
      e.preventDefault()
      continueWriting()
      return
    }
    const node = refs.current.get(lastEl.id)
    if (!node) return
    if (e.clientY >= node.getBoundingClientRect().bottom) {
      e.preventDefault()
      continueWriting()
    }
  }

  return (
    <div ref={wrapRef} className="flex h-full flex-col">
      <div
        className={
          compact ? 'sp-compact relative w-full' : 'paper-sheen relative mx-auto my-0 w-[8.5in]'
        }
        style={compact ? undefined : ({ zoom: fitZoom } as CSSProperties)}
      >
        {pages.map((pg, pi) => pageIndex !== undefined && pi !== pageIndex ? null : (
          <div
            key={pi}
            ref={pi === 0 ? sheetRef : undefined}
            onMouseDown={handleSheetMouseDown}
            style={
              {
                '--sp-font': docFont,
                '--sp-size': `${docSize}pt`,
                marginBottom: pi < pages.length - 1 && pageIndex === undefined ? 14 : 0,
              } as CSSProperties
            }
            className={
              compact
                ? 'pb-6 text-ink-900'
                : 'min-h-[11in] bg-paper px-[1.5in] pb-[1in] pt-[1in] text-ink-900 shadow-paper dark:bg-[#fdfdfc]'
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
