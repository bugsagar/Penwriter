import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, PanelLeftOpen, PanelRightOpen, Plus } from 'lucide-react'
import { useApp } from '../../store/useApp'
import { countWords, pageCount, sheetsOf } from '../../utils/layout'
import { saveNow } from '../../hooks/useAutosave'
import { flushSync } from 'react-dom'
import { TopBar } from './TopBar'
import { uid } from '../../utils/id'
import { Sidebar } from './Sidebar'
import { Inspector, type Focus } from './Inspector'
import { Paper } from './Paper'
import { SearchBar } from './SearchBar'
import { SettingsDialog } from './SettingsDialog'
import { MobileTypeBar } from './MobileTypeBar'
import { TypewriterDeck } from './Typewriter'
import { cn } from '../ui'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useVoiceTyping } from '../../hooks/useVoiceTyping'
import { MicButton, VoicePanel } from './VoiceTyping'
import { VoiceNote } from './VoiceNote'
import { PageNotes } from './PageNotes'
import { openNotesByPage } from '../../utils/notes'
import { StickyNote } from 'lucide-react'

export function Editor() {
  const project = useApp((s) => s.projects.find((p) => p.id === s.activeProjectId))
  const saveStatus = useApp((s) => s.saveStatus)
  const undo = useApp((s) => s.undo)
  const redo = useApp((s) => s.redo)
  const setElements = useApp((s) => s.setElements)
  const goHome = useApp((s) => s.openDashboard)

  const [focus, setFocus] = useState<Focus>({ kind: 'project' })
  const [writingMode, setWritingMode] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeMatch, setActiveMatch] = useState(0)
  const [pagesOpen, setPagesOpen] = useState(false)
  const isMobile = useIsMobile()
  const typewriter = useApp((s) => s.canvasStyle) === 'typewriter'
  const [pageIdx, setPageIdx] = useState(0)
  const insertElements = useApp((s) => s.insertElements)
  const updateElement = useApp((s) => s.updateElement)

  // Voice typing: dictated text goes in at the caret, or onto the end of the
  // selected line, or into a new action line.
  const focusRef = useRef(focus)
  // Phone shows one page at a time: dictation with no line selected must land
  // on the page in view, not at the end of the script.
  const pageEndRef = useRef<string | null>(null)
  const pageIdsRef = useRef<Set<string> | null>(null) // lines on the phone page in view
  useEffect(() => {
    focusRef.current = focus
  })
  const insertDictation = useCallback(
    (text: string) => {
      const active = document.activeElement as HTMLElement | null
      const line = active?.closest?.('[data-elid]') as HTMLElement | null
      const sel = window.getSelection()
      if (line && sel && sel.rangeCount) {
        const caret = sel.getRangeAt(0)
        const before = document.createRange()
        before.selectNodeContents(line)
        before.setEnd(caret.startContainer, caret.startOffset)
        const sep = before.toString() && !/\s$/.test(before.toString()) ? ' ' : ''
        document.execCommand('insertText', false, sep + text)
        return
      }
      const proj = useApp.getState().projects.find((p) => p.id === useApp.getState().activeProjectId)
      if (!proj) return
      const f = focusRef.current
      const onPage = (id: string) => !pageIdsRef.current || pageIdsRef.current.has(id)
      const el = f.kind === 'element' && onPage(f.id) ? proj.elements.find((e) => e.id === f.id) : undefined
      let targetId: string
      if (el) {
        updateElement(el.id, { text: el.text.trim() ? `${el.text.replace(/\s+$/, '')} ${text}` : text })
        targetId = el.id
      } else {
        const after = pageEndRef.current ? proj.elements.findIndex((e) => e.id === pageEndRef.current) : -1
        const end = after >= 0 ? proj.elements[after] : proj.elements[proj.elements.length - 1]
        if (end && !end.text.trim() && end.type !== 'SCENE_HEADING') {
          // reuse an empty line at the end of the page
          updateElement(end.id, { text })
          setFocus({ kind: 'element', id: end.id })
          requestAnimationFrame(() =>
            document.querySelector(`[data-elid="${end.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
          )
          return
        }
        const fresh = { id: uid('el'), type: 'ACTION' as const, text }
        insertElements(after >= 0 ? after + 1 : proj.elements.length, [fresh])
        setFocus({ kind: 'element', id: fresh.id })
        targetId = fresh.id
      }
      // Show where the words went.
      requestAnimationFrame(() =>
        document.querySelector(`[data-elid="${targetId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      )
    },
    [insertElements, updateElement],
  )
  const voice = useVoiceTyping(insertDictation)

  const elements = project?.elements ?? []

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !searchOpen) return []
    const out: { id: string }[] = []
    for (const el of elements) {
      let i = el.text.toLowerCase().indexOf(q)
      while (i !== -1) {
        out.push({ id: el.id })
        i = el.text.toLowerCase().indexOf(q, i + q.length)
      }
    }
    return out
  }, [query, searchOpen, elements])

  const clampedMatch = matches.length ? activeMatch % matches.length : 0

  const scrollToId = useCallback((id: string) => {
    try {
      document
        .querySelector(`[data-elid="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {
      /* ignore */
    }
  }, [])

  const toggleSearch = useCallback(() => {
    setSearchOpen((o) => {
      if (o) setQuery('')
      return !o
    })
  }, [])

  const jumpToElement = useCallback(
    (id: string) => {
      scrollToId(id)
      setFocus({ kind: 'element', id })
    },
    [scrollToId],
  )

  const nextMatch = useCallback(
    () => setActiveMatch((m) => (matches.length ? (m + 1) % matches.length : 0)),
    [matches.length],
  )
  const prevMatch = useCallback(
    () => setActiveMatch((m) => (matches.length ? (m - 1 + matches.length) % matches.length : 0)),
    [matches.length],
  )

  const replaceAll = useCallback(
    (replacement: string) => {
      const q = query.trim()
      if (!q || !project) return
      const ql = q.toLowerCase()
      const next = project.elements.map((el) => {
        if (!el.text.toLowerCase().includes(ql)) return el
        let out = ''
        let i = 0
        let idx = el.text.toLowerCase().indexOf(ql)
        while (idx !== -1) {
          out += el.text.slice(i, idx) + replacement
          i = idx + q.length
          idx = el.text.toLowerCase().indexOf(ql, i)
        }
        out += el.text.slice(i)
        return { ...el, text: out }
      })
      setElements(next)
      setQuery('')
      setSearchOpen(false)
    },
    [query, project, setElements],
  )

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveNow()
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleSearch()
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setWritingMode((w) => !w)
      }
      // Global undo/redo (e.g. after deleting a page from the Pages menu).
      // Keystrokes inside a script block are handled by the block itself.
      const inBlock = (e.target as HTMLElement | null)?.closest?.('[data-elid]')
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && !inBlock) {
        e.preventDefault()
        undo()
      }
      if (
        mod &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) &&
        !inBlock
      ) {
        e.preventDefault()
        redo()
      }
      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false)
          setQuery('')
        } else if (writingMode) {
          setWritingMode(false)
        } else if (settingsOpen) {
          setSettingsOpen(false)
        }
      }
    }
    const onUndo = () => undo()
    const onRedo = () => redo()
    window.addEventListener('keydown', onKey)
    window.addEventListener('reel:undo', onUndo)
    window.addEventListener('reel:redo', onRedo)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('reel:undo', onUndo)
      window.removeEventListener('reel:redo', onRedo)
    }
  }, [toggleSearch, undo, redo, searchOpen, writingMode, settingsOpen])

  useEffect(() => {
    if (query) setActiveMatch(0)
  }, [query])

  const stats = useMemo(
    () => ({ words: countWords(elements), pages: pageCount(elements) }),
    [elements],
  )

  const pageChunks = useMemo(() => sheetsOf(elements), [elements])
  const pageTotal = Math.max(1, pageChunks.length)
  const curPage = Math.min(pageIdx, pageTotal - 1)
  useEffect(() => {
    const chunk = isMobile ? pageChunks[curPage] : undefined
    pageEndRef.current = chunk?.length ? chunk[chunk.length - 1].el.id : null
    pageIdsRef.current = chunk ? new Set(chunk.map((p) => p.el.id)) : null
  }, [isMobile, pageChunks, curPage])
  const pageOf = useCallback(
    (id: string) => pageChunks.findIndex((c) => c.some((p) => p.el.id === id)),
    [pageChunks],
  )

  /* ---------- page notes ---------- */
  const [rightTab, setRightTab] = useState<'format' | 'notes'>('format')
  const [notesOpen, setNotesOpen] = useState(false) // phone sheet
  const [viewPage, setViewPage] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  // Desktop: the page in view is the one under the top of the canvas.
  useEffect(() => {
    const m = mainRef.current
    if (isMobile || !m) return
    const onScroll = () => {
      const line = m.getBoundingClientRect().top + Math.min(160, m.clientHeight * 0.3)
      let cur = 0
      m.querySelectorAll<HTMLElement>('[data-sheet]').forEach((s, i) => {
        if (s.getBoundingClientRect().top <= line) cur = i
      })
      setViewPage(cur)
    }
    onScroll()
    m.addEventListener('scroll', onScroll, { passive: true })
    return () => m.removeEventListener('scroll', onScroll)
  }, [isMobile, pageChunks.length, project?.id])
  const notesPage = isMobile ? curPage : Math.min(viewPage, pageTotal - 1)
  const openByPage = useMemo(() => openNotesByPage(project?.pageNotes, pageChunks), [project?.pageNotes, pageChunks])
  const jumpToPage = useCallback(
    (pi: number) => {
      if (isMobile) {
        setPageIdx(Math.max(0, Math.min(pageTotal - 1, pi)))
        return
      }
      const m = mainRef.current
      const sheet = m?.querySelector<HTMLElement>(`[data-sheet="${pi}"]`)
      if (m && sheet) m.scrollTo({ top: m.scrollTop + sheet.getBoundingClientRect().top - m.getBoundingClientRect().top - 16, behavior: 'smooth' })
    },
    [isMobile, pageTotal],
  )
  const openNotesFor = useCallback(
    (pi: number) => {
      if (isMobile) {
        setPageIdx(pi)
        setNotesOpen(true)
        return
      }
      setRightCollapsed(false)
      setRightTab('notes')
      jumpToPage(pi)
    },
    [isMobile, jumpToPage],
  )

  // Phone: follow the active search match onto its page.
  const activeMatchId = matches[clampedMatch]?.id
  useEffect(() => {
    if (!isMobile || !activeMatchId) return
    const p = pageOf(activeMatchId)
    if (p !== -1) setPageIdx(p)
  }, [isMobile, activeMatchId, pageOf])

  const goToPage = (p: number) => {
    setPageIdx(Math.max(0, Math.min(pageTotal - 1, p)))
    document.querySelector('main')?.scrollTo({ top: 0 })
  }

  const addPage = () => {
    const el = { id: uid('el'), type: 'SCENE_HEADING' as const, text: '', pageBreak: true }
    // Render synchronously so focus lands inside the tap (phones only open
    // the keyboard for focus that happens during a user gesture).
    flushSync(() => {
      insertElements(elements.length, [el])
      setPageIdx(pageChunks.length)
      setFocus({ kind: 'element', id: el.id })
    })
    document.querySelector<HTMLElement>(`[data-elid="${el.id}"]`)?.focus()
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-100 text-ink-500 dark:bg-ink-950">
        Project not found.{' '}
        <button className="ml-2 font-medium text-brass-500" onClick={goHome}>
          Go to projects
        </button>
      </div>
    )
  }

  if (isMobile) {
    const selectedId = focus.kind === 'element' ? focus.id : null
    const voiceOn = voice.status === 'listening' || voice.status === 'starting'
    const navBtn =
      'flex h-10 w-8 items-center justify-center rounded-full text-ink-700 transition-colors active:bg-ink-100 disabled:opacity-30 dark:text-ink-200 dark:active:bg-ink-800'
    return (
      <div className="flex h-dvh flex-col bg-white dark:bg-ink-950">
        <TopBar
          compact
          project={project}
          saveStatus={saveStatus}
          writingMode={false}
          onToggleSearch={toggleSearch}
          onToggleWritingMode={() => {}}
          onOpenSettings={() => setSettingsOpen(true)}
          onGoHome={goHome}
          onOpenPages={() => setPagesOpen(true)}
          onOpenNotes={() => setNotesOpen(true)}
        />

        <main className="no-scrollbar relative min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden px-6 pt-4">
          <Paper
            compact
            pageIndex={curPage}
            onFollowPage={setPageIdx}
            noteCounts={openByPage}
            onOpenNotes={openNotesFor}
            elements={elements}
            selectedId={selectedId}
            readOnly={searchOpen}
            query={query}
            matches={matches}
            activeMatch={clampedMatch}
            onSelect={(id) => setFocus({ kind: 'element', id })}
            scrollToId={scrollToId}
          />
        </main>

        {!searchOpen && (
          <div className="pb-safe shrink-0 bg-white px-3 pt-1 dark:bg-ink-950">
            {voice.status !== 'idle' && (
              // listening leaves room under the bubble for the pill's "Slide to cancel" hint
              <div className={voiceOn ? 'mb-8' : 'mb-2'}>
                <VoicePanel voice={voice} compact />
              </div>
            )}
            {selectedId && !voiceOn && <MobileTypeBar selectedId={selectedId} />}
            <div
              className={cn('vn-row', selectedId && !voiceOn && 'mt-2')}
              data-open={voiceOn || undefined}
            >
              {/* pages: small, on the left */}
              <div className="vn-side">
                <div className="flex h-11 items-center rounded-full border border-ink-200/80 bg-white shadow-[0_1px_3px_rgb(20_22_26/0.08)] dark:border-ink-700 dark:bg-ink-900">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={curPage === 0}
                    onClick={() => goToPage(curPage - 1)}
                    className={navBtn}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagesOpen(true)}
                    aria-label={`Page ${curPage + 1} of ${pageTotal}. Show pages`}
                    className="min-w-[30px] text-center text-[12.5px] font-semibold tabular-nums text-ink-700 dark:text-ink-200"
                  >
                    {curPage + 1}/{pageTotal}
                  </button>
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={curPage >= pageTotal - 1}
                    onClick={() => goToPage(curPage + 1)}
                    className={navBtn}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              {/* voice: big, in the middle */}
              <div className="min-w-0 flex-1">
                <VoiceNote voice={voice} />
              </div>
              {/* new page: compact, on the right */}
              <div className="vn-side">
                <button
                  type="button"
                  onClick={addPage}
                  aria-label="New page"
                  title="New page"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-200/80 bg-white text-ink-800 shadow-[0_1px_3px_rgb(20_22_26/0.08)] active:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
                >
                  <Plus size={19} />
                </button>
              </div>
            </div>
          </div>
        )}

        {notesOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-ink-950/40 dark:bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setNotesOpen(false)
            }}
          >
            <div className="animate-sheet-up pb-safe max-h-[80dvh] w-full overflow-y-auto rounded-t-[24px] bg-white dark:bg-ink-900">
              <div className="flex justify-center pt-2.5">
                <span className="h-1.5 w-10 rounded-full bg-ink-200 dark:bg-ink-700" />
              </div>
              <div className="flex items-center justify-between px-4 pt-2">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink-900 dark:text-ink-50">
                  <StickyNote size={16} /> Page notes
                </span>
                <button
                  type="button"
                  onClick={() => setNotesOpen(false)}
                  className="rounded-full px-3 py-1 text-[13px] font-medium text-ink-500 hover:text-ink-900 dark:text-ink-400"
                >
                  Done
                </button>
              </div>
              <PageNotes
                project={project}
                sheets={pageChunks}
                page={curPage}
                selectedId={focus.kind === 'element' ? focus.id : null}
                onJumpToPage={(p) => setPageIdx(p)}
              />
            </div>
          </div>
        )}

        {pagesOpen && (
          <div
            className="fixed inset-0 z-50 flex bg-ink-950/40 dark:bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setPagesOpen(false)
            }}
          >
            <div className="animate-fade-slide-in h-full w-[min(85vw,320px)] p-2">
              <Sidebar
                project={project}
                activeId={pageChunks[curPage]?.[0]?.el.id ?? null}
                onJump={(id) => {
                  setPagesOpen(false)
                  const p = pageOf(id)
                  if (p !== -1) goToPage(p)
                  setFocus({ kind: 'element', id })
                }}
                onCollapse={() => setPagesOpen(false)}
              />
            </div>
          </div>
        )}

        {searchOpen && (
          <SearchBar
            query={query}
            setQuery={setQuery}
            matches={matches.length}
            activeMatch={clampedMatch}
            onNext={nextMatch}
            onPrev={prevMatch}
            onReplaceAll={replaceAll}
            onClose={() => {
              setSearchOpen(false)
              setQuery('')
            }}
          />
        )}

        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onEnterWritingMode={() => setSettingsOpen(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col gap-2 bg-[#ececea] p-2 dark:bg-ink-950">
      <TopBar
        project={project}
        saveStatus={saveStatus}
        writingMode={writingMode}
        onToggleSearch={toggleSearch}
        onToggleWritingMode={() => setWritingMode((w) => !w)}
        // typewriter: the keys fill the bottom, so the mic stays up here
        tools={typewriter ? <MicButton voice={voice} className="mr-1 h-8 w-8 [&_svg]:h-[15px] [&_svg]:w-[15px]" /> : undefined}
        onOpenSettings={() => setSettingsOpen(true)}
        onGoHome={goHome}
      />

      <div className="flex min-h-0 flex-1 gap-2">
        {!writingMode &&
          (leftCollapsed ? (
            <button
              type="button"
              title="Show pages"
              onClick={() => setLeftCollapsed(false)}
              className="flex w-9 shrink-0 items-start justify-center rounded-xl border border-ink-200/70 bg-white pt-3 text-ink-400 transition-colors hover:text-ink-800 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-500 dark:hover:text-ink-100"
            >
              <PanelLeftOpen size={15} />
            </button>
          ) : (
            <Sidebar
              project={project}
              activeId={focus.kind === 'element' || focus.kind === 'scene' ? focus.id : null}
              onJump={jumpToElement}
              onCollapse={() => setLeftCollapsed(true)}
            />
          ))}

        <main
          ref={mainRef}
          className={cn(
            'relative min-w-0 flex-1 overflow-auto rounded-xl border border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900',
            typewriter ? 'tw-canvas overflow-x-hidden' : 'paper-canvas',
          )}
        >
          <div
            data-tw-frame
            className={cn(
              'mx-auto w-fit max-w-full px-4 sm:px-6',
              // Typewriter: room below so the last line can reach the print line.
              typewriter ? 'pb-[45vh] pt-[var(--tw-top,2rem)]' : 'py-8',
            )}
          >
            {/* Typewriter: the page rides the carriage, sliding as you type. */}
            <div
              style={
                typewriter
                  ? { transform: 'translateX(var(--tw-shift, 0px))', transition: 'transform 110ms ease-out' }
                  : undefined
              }
            >
              <Paper
                noteCounts={openByPage}
                onOpenNotes={openNotesFor}
                elements={elements}
                selectedId={focus.kind === 'element' ? focus.id : null}
                readOnly={searchOpen}
                query={query}
                matches={matches}
                activeMatch={clampedMatch}
                onSelect={(id) => setFocus({ kind: 'element', id })}
                scrollToId={scrollToId}
              />
            </div>
          </div>
          {typewriter && <TypewriterDeck />}
          {/* voice: the phone's pill, floating at the bottom of the page area */}
          {!searchOpen && !typewriter && (
            <div className="pointer-events-none sticky bottom-5 z-30 flex justify-center px-4">
              {/* the phone's pill at 60% size: plenty for a mouse */}
              <div className="pointer-events-auto w-[300px] origin-bottom scale-[0.6]">
                <VoiceNote voice={voice} />
              </div>
            </div>
          )}
        </main>

        {!writingMode &&
          (rightCollapsed ? (
            <button
              type="button"
              title="Show format panel"
              onClick={() => setRightCollapsed(false)}
              className="flex w-9 shrink-0 items-start justify-center rounded-xl border border-ink-200/70 bg-white pt-3 text-ink-400 transition-colors hover:text-ink-800 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-500 dark:hover:text-ink-100"
            >
              <PanelRightOpen size={15} />
            </button>
          ) : (
            <Inspector
              project={project}
              focus={focus}
              onFocus={setFocus}
              onJumpToScene={scrollToId}
              onCollapse={() => setRightCollapsed(true)}
              tab={rightTab}
              onTab={setRightTab}
              openNotes={openByPage[notesPage] ?? 0}
              notesPanel={
                <PageNotes
                  project={project}
                  sheets={pageChunks}
                  page={notesPage}
                  selectedId={focus.kind === 'element' ? focus.id : null}
                  onJumpToPage={jumpToPage}
                />
              }
            />
          ))}
      </div>

      {!writingMode && (
        <footer className="flex h-7 shrink-0 items-center justify-end gap-4 rounded-b-xl border border-ink-200/70 bg-white px-4 text-[11px] text-ink-400 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-500">
          <span>{stats.words.toLocaleString()} words</span>
          <span className="h-3 w-px bg-ink-200 dark:bg-ink-700" />
          <span>{stats.pages} pages</span>
          <span className="h-3 w-px bg-ink-200 dark:bg-ink-700" />
          <span>~{stats.pages} min of screen time</span>
        </footer>
      )}

      <VoicePanel voice={voice} floating raised />

      {searchOpen && (
        <SearchBar
          query={query}
          setQuery={setQuery}
          matches={matches.length}
          activeMatch={clampedMatch}
          onNext={nextMatch}
          onPrev={prevMatch}
          onReplaceAll={replaceAll}
          onClose={() => {
            setSearchOpen(false)
            setQuery('')
          }}
        />
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onEnterWritingMode={() => {
          setSettingsOpen(false)
          setWritingMode(true)
        }}
      />
    </div>
  )
}
