import { flushSync } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import type { ElementType, ScreenplayElement } from '../../types'
import { ELEMENT_HINTS, ELEMENT_LABELS, detectTypeWhileTyping, isCharacterLine, isSceneHeading, isTransition } from '../../utils/detect'
import { setCaret, highlightHtml } from '../../utils/focus'
import { uid } from '../../utils/id'
import { cn } from '../ui'

interface Props {
  element: ScreenplayElement
  index: number
  total: number
  isActive: boolean
  readOnly: boolean
  autoDetect: boolean
  query: string
  registerRef: (id: string, el: HTMLDivElement | null) => void
  onSelect: (id: string) => void
  onChangeType: (id: string, type: ElementType) => void
  onUpdate: (id: string, text: string, type?: ElementType) => void
  onInsert: (index: number, els: ScreenplayElement[]) => void
  onRemove: (id: string, index: number) => void
  onFocusNeighbor: (index: number, dir: -1 | 1, pos: 'start' | 'end') => void
  /** When a long paragraph is split across pages: where this piece starts
   *  in the paragraph's text. */
  fragStart?: number
}

function caretTextOffset(div: HTMLDivElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return div.textContent?.length ?? 0
  try {
    const range = sel.getRangeAt(0)
    const pre = range.cloneRange()
    pre.selectNodeContents(div)
    pre.setEnd(range.startContainer, range.startOffset)
    return pre.toString().length
  } catch {
    return div.textContent?.length ?? 0
  }
}
function selectionIsCollapsed(): boolean {
  const sel = window.getSelection()
  return !sel || sel.rangeCount === 0 || sel.isCollapsed
}
function caretAtVeryStart(div: HTMLDivElement): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false
  const range = sel.getRangeAt(0)
  const c = range.startContainer
  if (c === div) return range.startOffset === 0
  if (c === div.firstChild) return range.startOffset === 0
  return false
}

function caretAtVeryEnd(div: HTMLDivElement): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false
  const range = sel.getRangeAt(0)
  const c = range.startContainer
  const len = div.textContent?.length ?? 0
  if (c === div) return range.startOffset >= len
  if (c === div.lastChild) return range.startOffset >= len
  return false
}

const MENU_TYPES: ElementType[] = [
  'SCENE_HEADING',
  'ACTION',
  'CHARACTER',
  'DIALOGUE',
  'PARENTHETICAL',
  'TRANSITION',
  'SHOT',
]

export function ElementBlock({
  element,
  index,
  total,
  isActive,
  readOnly,
  autoDetect,
  query,
  registerRef,
  onSelect,
  onChangeType,
  onUpdate,
  onInsert,
  onRemove,
  onFocusNeighbor,
  fragStart = 0,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null)
  const lastText = useRef(element.text)
  const prevReadOnly = useRef(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // In-page element-type menu, opened with Alt/Option + Tab.
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuSel, setMenuSel] = useState<ElementType>(element.type)
  const [menuFilter, setMenuFilter] = useState('')

  const filteredTypes = MENU_TYPES.filter((t) =>
    ELEMENT_LABELS[t].toLowerCase().includes(menuFilter.trim().toLowerCase()),
  )

  const closeMenu = () => {
    setMenuOpen(false)
    setMenuFilter('')
  }

  const stepMenu = (dir: 1 | -1) => {
    if (filteredTypes.length === 0) return
    const i = filteredTypes.indexOf(menuSel)
    const next = (i === -1 ? (dir === 1 ? -1 : 0) : i) + dir
    setMenuSel(
      filteredTypes[(next + filteredTypes.length) % filteredTypes.length],
    )
  }

  // Dismiss the menu when selection moves to another block or user clicks away.
  useEffect(() => {
    if (!isActive) closeMenu()
  }, [isActive])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (wrapRef.current?.contains(target)) {
        // Clicking back into the text keeps typing: close the menu.
        closeMenu()
        return
      }
      closeMenu()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  // Seed text on mount; never touch textContent afterwards so the caret is
  // never reset by React re-renders.
  const refCb = (node: HTMLDivElement | null) => {
    divRef.current = node
    registerRef(element.id, node)
    if (node && !node.dataset.seeded) {
      node.textContent = element.text
      node.dataset.seeded = '1'
      lastText.current = element.text
    }
  }

  // Sync externally-applied text (undo/redo, replace-all) and restore plain
  // text after leaving read-only highlight mode.
  useEffect(() => {
    const div = divRef.current
    if (!div) return
    if (readOnly) {
      prevReadOnly.current = true
      lastText.current = element.text
      return
    }
    if (prevReadOnly.current || element.text !== lastText.current) {
      div.textContent = element.text
      lastText.current = element.text
    }
    prevReadOnly.current = false
  }, [element.text, readOnly])

  const syncFromDom = () => {
    const div = divRef.current
    if (!div) return
    const text = div.textContent ?? ''
    // Drop the caret-anchor <br> added after a trailing newline once the
    // text no longer ends with one (e.g. Backspace right after Enter).
    if (!text.endsWith('\n')) {
      let last = div.lastChild
      while (last && last.nodeName === 'BR') {
        const prev = last.previousSibling
        last.remove()
        last = prev
      }
    }
    lastText.current = text
    if (autoDetect) {
      const next = detectTypeWhileTyping(element.type, text)
      if (next !== element.type) onUpdate(element.id, text, next)
      else onUpdate(element.id, text)
    } else {
      onUpdate(element.id, text)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const div = divRef.current
    if (!div) return
    const text = (div.textContent ?? '').trim()

    const computeNext = (
      t: string,
    ): { newType: ElementType; upgrade: ElementType | null } => {
      const tt = t.trim()
      switch (element.type) {
        case 'SCENE_HEADING':
          return { newType: 'ACTION', upgrade: null }
        case 'CHARACTER':
          return { newType: 'DIALOGUE', upgrade: null }
        case 'PARENTHETICAL':
          return { newType: 'DIALOGUE', upgrade: null }
        case 'DIALOGUE':
          if (isCharacterLine(tt)) return { newType: 'DIALOGUE', upgrade: 'CHARACTER' }
          return { newType: tt ? 'DIALOGUE' : 'ACTION', upgrade: null }
        case 'TRANSITION':
        case 'SHOT':
          return { newType: 'ACTION', upgrade: null }
        case 'ACTION':
        default:
          if (isSceneHeading(tt)) return { newType: 'ACTION', upgrade: 'SCENE_HEADING' }
          if (isTransition(tt)) return { newType: 'ACTION', upgrade: 'TRANSITION' }
          if (isCharacterLine(tt)) return { newType: 'DIALOGUE', upgrade: 'CHARACTER' }
          return { newType: 'ACTION', upgrade: null }
      }
    }

    const focusNewBlock = (newType: ElementType) => {
      const newEl: ScreenplayElement = { id: uid('el'), type: newType, text: '' }
      // Render the new line now, so the caret goes straight into it — even
      // when it carries its block over to the next page (which re-creates
      // this line there and would otherwise drop the caret mid-keystroke).
      flushSync(() => onInsert(index + 1, [newEl]))
      const find = () => document.querySelector(`[data-elid="${newEl.id}"]`) as HTMLDivElement | null
      const node = find()
      if (node) setCaret(node, 'start')
      else requestAnimationFrame(() => {
        const later = find()
        if (later) setCaret(later, 'start')
      })
    }

    // Leave the current box for a new block on the next line, applying any
    // in-place upgrade (e.g. all-caps ACTION -> CHARACTER).
    const exitToNewBlock = () => {
      const current = div.textContent ?? ''
      if (!current.trim()) {
        focusNewBlock(computeNext('').newType)
        return
      }
      const trimmed = current.replace(/\n+$/, '')
      const { newType, upgrade } = computeNext(trimmed)
      if (trimmed !== current) {
        div.textContent = trimmed
        lastText.current = trimmed
      }
      if (upgrade) onUpdate(element.id, trimmed, upgrade)
      else if (trimmed !== current) onUpdate(element.id, trimmed)
      focusNewBlock(newType)
    }

    // ---- Tab: plain Tab exits to a new block; Alt/Option + Tab is the
    // element-type menu ----
    if (e.key === 'Tab') {
      if (readOnly) return
      e.preventDefault()
      if (menuOpen) {
        stepMenu(e.shiftKey ? -1 : 1)
        return
      }
      if (!e.altKey) {
        exitToNewBlock()
        return
      }
      setMenuSel(element.type)
      setMenuFilter('')
      setMenuOpen(true)
      return
    }

    if (menuOpen) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const t = filteredTypes.includes(menuSel)
          ? menuSel
          : (filteredTypes[0] ?? element.type)
        onChangeType(element.id, t)
        closeMenu()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeMenu()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        stepMenu(e.key === 'ArrowDown' ? 1 : -1)
        return
      }
      if (e.key === 'Backspace' && menuFilter) {
        e.preventDefault()
        setMenuFilter((f) => f.slice(0, -1))
        return
      }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Type to filter the menu instead of inserting text.
        e.preventDefault()
        setMenuFilter((f) => f + e.key)
        return
      }
      if (e.key === 'Backspace' && !menuFilter) {
        closeMenu()
      }
    }

    // Enter stays inside the same box as a soft line break, for every
    // element type. A second Enter on the trailing empty line (or Enter on
    // an empty block) exits to a new block with the usual type flow.
    if (e.key === 'Enter') {
      if (readOnly) return
      e.preventDefault()
      if (menuOpen) closeMenu()
      const current = div.textContent ?? ''
      const offset = caretTextOffset(div)

      // Empty block: Enter exits to a new block (lets writers escape).
      if (!current.trim()) {
        focusNewBlock(computeNext('').newType)
        return
      }

      // Second Enter on a trailing empty line exits to a new block,
      // applying any in-place upgrade (e.g. all-caps ACTION -> CHARACTER).
      if (offset === current.length && current.endsWith('\n')) {
        exitToNewBlock()
        return
      }

      // Otherwise stay inside the same box: soft line break.
      const next = `${current.slice(0, offset)}\n${current.slice(offset)}`
      div.textContent = next
      lastText.current = next
      // A bare trailing \n leaves the caret in an ambiguous position and
      // the next keystroke lands before it ("HelloWorld\n"). A trailing
      // <br> (invisible to textContent) anchors the caret after the break.
      if (next.endsWith('\n')) div.appendChild(document.createElement('br'))
      setCaret(div, offset + 1)
      onUpdate(element.id, next)
      return
    }

    if (e.key === 'Backspace') {
      // Non-collapsed selection (e.g. select-all): let the browser delete it.
      if (!selectionIsCollapsed()) return
      if (!text) {
        e.preventDefault()
        if (total > 1) onRemove(element.id, index)
        return
      }
      if (caretAtVeryStart(div)) {
        e.preventDefault()
        onFocusNeighbor(index, -1, 'end')
      }
      return
    }

    if (e.key === 'ArrowUp' && caretAtVeryStart(div)) {
      e.preventDefault()
      onFocusNeighbor(index, -1, 'end')
      return
    }
    if (e.key === 'ArrowDown' && caretAtVeryEnd(div)) {
      e.preventDefault()
      onFocusNeighbor(index, 1, 'start')
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('reel:undo'))
      return
    }
    if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('reel:redo'))
      return
    }
  }

  return (
    <div ref={wrapRef} className={cn('group relative', isActive && 'el-active')} data-index={index}>
      <div
        data-elid={element.id}
        data-frag-start={fragStart || undefined}
        ref={refCb}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        spellCheck={false}
        onInput={syncFromDom}
        onKeyDown={handleKeyDown}
        onMouseDown={() => onSelect(element.id)}
        onFocus={() => onSelect(element.id)}
        style={{
          fontWeight: element.bold === false ? 400 : element.bold ? 700 : undefined,
          fontStyle: element.italic ? 'italic' : undefined,
          textDecorationLine: element.underline ? 'underline' : undefined,
          textAlign: element.align,
          color: element.color,
        }}
        className={cn(
          'sp-block rounded-[2px] outline-none',
          `sp-${element.type.toLowerCase().replace('_', '-')}`,
        )}
        dangerouslySetInnerHTML={
          readOnly && query.trim() ? { __html: highlightHtml(element.text, query) } : undefined
        }
      />
      {menuOpen && !readOnly && (
        <div
          ref={menuRef}
          data-type-menu
          className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lift dark:border-ink-700 dark:bg-ink-900"
        >
          <div className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500">
            Element type{menuFilter ? ` — “${menuFilter}”` : ''}
          </div>
          {filteredTypes.map((t) => {
            const active = t === menuSel
            return (
              <button
                key={t}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChangeType(element.id, t)
                  closeMenu()
                }}
                onMouseEnter={() => setMenuSel(t)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors',
                  active
                    ? 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-50'
                    : 'text-ink-700 dark:text-ink-300',
                )}
              >
                <span className="flex-1">{ELEMENT_LABELS[t]}</span>
                <span className="text-[11px] text-ink-400 dark:text-ink-500">
                  {ELEMENT_HINTS[t]}
                </span>
                {t === element.type && (
                  <span className="text-[11px] font-medium text-brass-500">current</span>
                )}
              </button>
            )
          })}
          {filteredTypes.length === 0 && (
            <div className="px-3 py-2 text-[12.5px] text-ink-400 dark:text-ink-500">
              No matching element
            </div>
          )}
          <div className="border-t border-ink-100 px-3 py-1.5 text-[11px] text-ink-400 dark:border-ink-800 dark:text-ink-500">
            ⌥Tab move · Enter select · Esc close
          </div>
        </div>
      )}
    </div>
  )
}
