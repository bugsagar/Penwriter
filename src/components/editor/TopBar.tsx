import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  Files,
  Keyboard,
  MoreHorizontal,
  Minimize2,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Table,
  Undo2,
  Redo2,
} from 'lucide-react'
import { useApp } from '../../store/useApp'
import { exportPdf } from '../../export/pdf'
import { exportText, exportFountain } from '../../export/text'
import { saveProjects } from '../../utils/storage'
import { Dropdown, IconButton, MenuItem, cn } from '../ui'
import type { Project, SaveStatus } from '../../types'

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-[11.5px] text-ink-400 dark:text-ink-500">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brass-500" />
        Saving…
      </span>
    )
  }
  if (status === 'unsaved') {
    return (
      <span className="flex items-center gap-1.5 text-[11.5px] text-ink-500 dark:text-ink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-brass-500" />
        Unsaved changes
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-ink-400 dark:text-ink-500">
      <Check size={12} className="text-emerald-500" />
      Saved
    </span>
  )
}

interface Props {
  project: Project
  saveStatus: SaveStatus
  writingMode: boolean
  onToggleSearch: () => void
  onToggleWritingMode: () => void
  onOpenSettings: () => void
  onGoHome: () => void
  /** Phone layout: one simple row with an overflow menu. */
  compact?: boolean
  onOpenPages?: () => void
  /** Extra buttons for the desktop toolbar (e.g. voice typing). */
  tools?: React.ReactNode
}

const pill =
  'flex items-center rounded-full border border-ink-200/80 bg-white text-ink-800 shadow-[0_1px_3px_rgb(20_22_26/0.08)] dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100'

function ToolBtn({
  title,
  children,
  onClick,
  active,
  disabled,
}: {
  title: string
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-[13px] text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100',
        active && 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-50',
      )}
    >
      {children}
    </button>
  )
}

export function TopBar({
  project,
  saveStatus,
  writingMode,
  onToggleSearch,
  onToggleWritingMode,
  onOpenSettings,
  onGoHome,
  compact = false,
  onOpenPages,
  tools,
}: Props) {
  const undo = useApp((s) => s.undo)
  const redo = useApp((s) => s.redo)
  const undoStack = useApp((s) => s.undoStack)
  const redoStack = useApp((s) => s.redoStack)
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)
  const updateActive = useApp((s) => s.updateActive)
  const canvasStyle = useApp((s) => s.canvasStyle)
  const setCanvasStyle = useApp((s) => s.setCanvasStyle)

  const doExport = async (kind: 'pdf' | 'text' | 'fountain') => {
    try {
      if (kind === 'pdf') await exportPdf(project)
      else if (kind === 'text') exportText(project)
      else exportFountain(project)
    } catch (err) {
      console.error('Export failed', err)
      window.alert(`Sorry — the export didn't work.\n\n${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const saveNow = () => {
    saveProjects(useApp.getState().projects)
  }

  if (compact) {
    const roundBtn = pill + ' h-11 w-11 shrink-0 justify-center active:bg-ink-50 dark:active:bg-ink-800'
    return (
      <header className="pt-safe flex shrink-0 items-center gap-2 bg-white px-3 pb-2 pt-2 dark:bg-ink-950">
        <button
          type="button"
          title="Back to projects"
          aria-label="Back to projects"
          onClick={onGoHome}
          className={roundBtn}
        >
          <ArrowLeft size={20} />
        </button>
        <input
          value={project.title}
          onChange={(e) => updateActive({ title: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder="Untitled"
          aria-label="Script name"
          enterKeyHint="done"
          className="min-w-0 flex-1 truncate bg-transparent text-center text-[22px] font-bold tracking-[-0.02em] text-ink-950 outline-none placeholder:text-ink-300 dark:text-ink-50"
        />
        <Dropdown
          trigger={
            <button type="button" aria-label="More options" title="More options" className={roundBtn}>
              <MoreHorizontal size={20} />
            </button>
          }
        >
          {(close) => (
            <div className="min-w-56 py-0.5 [&_button]:py-2.5 [&_button]:text-[14px]">
              <div className="px-3 pb-1.5 pt-1">
                <SaveIndicator status={saveStatus} />
              </div>
              <div className="flex gap-1 px-1.5 pb-1.5">
                <button
                  type="button"
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink-100/70 text-ink-700 disabled:opacity-35 dark:bg-ink-800 dark:text-ink-200"
                >
                  <Undo2 size={15} /> Undo
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink-100/70 text-ink-700 disabled:opacity-35 dark:bg-ink-800 dark:text-ink-200"
                >
                  <Redo2 size={15} /> Redo
                </button>
              </div>
              <div className="my-1 border-t border-ink-100 dark:border-ink-800" />
              <MenuItem
                icon={<Files size={15} />}
                label="Scenes"
                onClick={() => {
                  close()
                  onOpenPages?.()
                }}
              />
              <MenuItem
                icon={<FileText size={15} />}
                label="Export PDF"
                onClick={() => {
                  close()
                  doExport('pdf')
                }}
              />
              <MenuItem
                icon={<Sparkles size={15} />}
                label="Export Fountain"
                onClick={() => {
                  close()
                  doExport('fountain')
                }}
              />
              <div className="my-1 border-t border-ink-100 dark:border-ink-800" />
              <MenuItem
                icon={theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                onClick={() => {
                  close()
                  setTheme(theme === 'dark' ? 'light' : 'dark')
                }}
              />
              <MenuItem
                icon={<Settings size={15} />}
                label="Settings"
                onClick={() => {
                  close()
                  onOpenSettings()
                }}
              />
            </div>
          )}
        </Dropdown>
      </header>
    )
  }

  if (writingMode) {
    return (
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-200 bg-white px-3 dark:border-ink-800 dark:bg-ink-900">
        <button
          onClick={onGoHome}
          title="Back to projects"
          className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
        >
          <ArrowLeft size={17} />
        </button>
        <span className="max-w-[200px] truncate px-1.5 text-[13px] font-medium text-ink-800 dark:text-ink-100">
          {project.title || 'Untitled Screenplay'}
        </span>
        <SaveIndicator status={saveStatus} />
        <div className="flex-1" />
        <IconButton title="Exit writing mode (⌘⇧F)" onClick={onToggleWritingMode}>
          <Minimize2 size={15} />
        </IconButton>
      </header>
    )
  }

  return (
    <header className="shrink-0 rounded-t-xl border-b border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900">
      {/* Row 1 — workspace / search / status (like screenshot) */}
      <div className="flex h-12 items-center gap-2 px-3">
        <button
          onClick={onGoHome}
          title="Back to projects"
          className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#6b5ce7] text-[13px] font-semibold text-white">
            {(project.title || 'A').trim().charAt(0).toUpperCase()}
          </span>
          <input
            value={project.title}
            onChange={(e) => updateActive({ title: e.target.value })}
            className="w-40 truncate rounded-md bg-transparent px-1 py-1 text-[13.5px] font-semibold text-ink-900 outline-none transition-colors hover:bg-ink-50 focus:bg-ink-50 dark:text-ink-50 dark:hover:bg-ink-800 dark:focus:bg-ink-800"
            title="Project title"
          />
          <span className="hidden sm:block">
            <SaveIndicator status={saveStatus} />
          </span>
          <span className="hidden h-4 w-px bg-ink-200 sm:block dark:bg-ink-700" />
          <ToolBtn title="Undo (⌘Z)" onClick={undo} disabled={undoStack.length === 0}>
            <Undo2 size={13} />
          </ToolBtn>
          <ToolBtn title="Redo (⌘⇧Z)" onClick={redo} disabled={redoStack.length === 0}>
            <Redo2 size={13} />
          </ToolBtn>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          {tools}
          <IconButton
            title={canvasStyle === 'typewriter' ? 'Switch to paper canvas' : 'Switch to typewriter canvas'}
            onClick={() => setCanvasStyle(canvasStyle === 'typewriter' ? 'paper' : 'typewriter')}
            active={canvasStyle === 'typewriter'}
            className="h-8 w-8"
          >
            <Keyboard size={15} />
          </IconButton>
          <IconButton title="Search (⌘F)" onClick={onToggleSearch} className="h-8 w-8">
            <Search size={15} />
          </IconButton>
          <Dropdown
            trigger={
              <span className="mr-1 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-ink-200 px-2.5 text-[12.5px] font-medium text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800">
                <Table size={13} />
                Export
                <ChevronDown size={12} className="text-ink-400" />
              </span>
            }
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<FileText size={14} />}
                  label="PDF"
                  hint="Formatting preserved"
                  onClick={() => {
                    close()
                    doExport('pdf')
                  }}
                />
                <MenuItem
                  icon={<FileText size={14} />}
                  label="Plain text"
                  onClick={() => {
                    close()
                    doExport('text')
                  }}
                />
                <MenuItem
                  icon={<Sparkles size={14} />}
                  label="Fountain"
                  hint="Final Draft / compatible"
                  onClick={() => {
                    close()
                    doExport('fountain')
                  }}
                />
              </>
            )}
          </Dropdown>
          <IconButton title="Settings" onClick={onOpenSettings} className="h-8 w-8">
            <Settings size={15} />
          </IconButton>
          <IconButton
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-8 w-8"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </IconButton>
        </div>
        <button onClick={saveNow} className="sr-only">
          Save
        </button>
      </div>
    </header>
  )
}
