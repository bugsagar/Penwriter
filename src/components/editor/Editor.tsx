import { useCallback, useEffect, useMemo, useState } from 'react'
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react'
import { useApp } from '../../store/useApp'
import { countWords, pageCount } from '../../utils/layout'
import { saveProjects } from '../../utils/storage'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { Inspector, type Focus } from './Inspector'
import { Paper } from './Paper'
import { SearchBar } from './SearchBar'
import { SettingsDialog } from './SettingsDialog'

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
        saveProjects(useApp.getState().projects)
        useApp.getState().markSaved()
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

  return (
    <div className="flex h-screen flex-col gap-2 bg-[#ececea] p-2 dark:bg-ink-950">
      <TopBar
        project={project}
        saveStatus={saveStatus}
        writingMode={writingMode}
        onToggleSearch={toggleSearch}
        onToggleWritingMode={() => setWritingMode((w) => !w)}
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

        <main className="relative min-w-0 flex-1 overflow-auto rounded-xl border border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900">
          <div className="mx-auto w-fit max-w-full px-4 py-8 sm:px-6">
            <Paper
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
