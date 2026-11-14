import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Clapperboard,
  Copy,
  Film,
  FolderOpen,
  HardDrive,
  Home as HomeIcon,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Sun,
  Trash2,
  Tv,
  X,
} from 'lucide-react'
import { useApp } from '../store/useApp'
import type { Project } from '../types'
import { pageCount, countWords } from '../utils/layout'
import { Dropdown, IconButton, MenuItem, ConfirmItem, cn } from './ui'
import { NewScreenplayDialog } from './NewScreenplayDialog'
import { useOpenScreenplay } from './OpenScreenplay'

const TYPE_LABEL: Record<Project['type'], string> = {
  feature: 'Feature',
  short: 'Short Film',
  tv: 'TV Episode',
}

const TYPE_ICON: Record<Project['type'], typeof Film> = {
  feature: Film,
  short: Clapperboard,
  tv: Tv,
}

/** Warm accent palette, echoing a calm "daily progress" app. */
const ACCENT = {
  amber: '#e9a23b',
  coral: '#e8734e',
  violet: '#9b6bd6',
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Late night pages'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function safeStats(p: Project) {
  try {
    return { pages: pageCount(p.elements), words: countWords(p.elements) }
  } catch {
    return { pages: 0, words: 0 }
  }
}

/* ---------- pieces ---------- */

function StatRing({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white/70 dark:bg-ink-900/70"
        style={{ boxShadow: `inset 0 0 0 4px ${color}` }}
      >
        <span className="text-[17px] font-semibold tabular-nums tracking-tight text-ink-900 dark:text-ink-50">
          {value}
        </span>
      </div>
      <span className="text-[12px] font-medium text-ink-500 dark:text-ink-400">{label}</span>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  hint,
  onClick,
  primary,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-w-[156px] flex-1 snap-start flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.98] sm:min-w-0',
        primary
          ? 'border-ink-950 bg-ink-950 text-white hover:bg-ink-900 dark:border-ink-50 dark:bg-ink-50 dark:text-ink-950'
          : 'border-ink-200/70 bg-white/80 text-ink-900 backdrop-blur hover:border-ink-300 hover:bg-white dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-50 dark:hover:border-ink-700',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full',
          primary ? 'bg-white/15 dark:bg-ink-950/10' : 'bg-ink-100 dark:bg-ink-800',
        )}
      >
        {icon}
      </span>
      <span>
        <span className="block text-[14.5px] font-semibold leading-tight">{title}</span>
        <span
          className={cn(
            'mt-0.5 block text-[12px]',
            primary ? 'text-white/65 dark:text-ink-950/60' : 'text-ink-500 dark:text-ink-400',
          )}
        >
          {hint}
        </span>
      </span>
    </button>
  )
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {children}
    </span>
  )
}

function ProjectRow({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const deleteProject = useApp((s) => s.deleteProject)
  const duplicateProject = useApp((s) => s.duplicateProject)
  const { pages, words } = useMemo(() => safeStats(project), [project])
  const Icon = TYPE_ICON[project.type]

  return (
    <div
      onClick={onOpen}
      className="group flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink-50/80 sm:px-5 dark:hover:bg-ink-800/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6efe6] text-[#b0773a] dark:bg-ink-800 dark:text-brass-400">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-ink-900 dark:text-ink-50">
          {project.title || 'Untitled Screenplay'}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-ink-500 dark:text-ink-400">
          {TYPE_LABEL[project.type]}
          <span className="text-ink-300 dark:text-ink-600">·</span>
          {timeAgo(project.updatedAt)}
          {project.savedOnComputer && (
            <HardDrive size={12} className="ml-0.5 shrink-0 text-ink-400" aria-label="Saved on computer" />
          )}
        </div>
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">
        <Pill color={ACCENT.amber}>{pages} pg</Pill>
        <Pill color={ACCENT.violet}>{words.toLocaleString()} w</Pill>
      </div>
      <div className="sm:hidden">
        <Pill color={ACCENT.amber}>{pages} pg</Pill>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <Dropdown
          trigger={
            <IconButton
              title="Script options"
              className="opacity-60 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <MoreHorizontal size={17} />
            </IconButton>
          }
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Copy size={14} />}
                label="Duplicate"
                onClick={() => {
                  duplicateProject(project.id)
                  close()
                }}
              />
              <ConfirmItem
                icon={<Trash2 size={14} />}
                label="Delete"
                onConfirm={() => {
                  deleteProject(project.id)
                  close()
                }}
              />
            </>
          )}
        </Dropdown>
      </div>
    </div>
  )
}

/* ---------- page ---------- */

export function Dashboard() {
  const projects = useApp((s) => s.projects)
  const openEditor = useApp((s) => s.openEditor)
  const openHome = useApp((s) => s.openHome)
  const createSample = useApp((s) => s.createSample)
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)
  const [showNew, setShowNew] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const { open: openFile, element: openFileUi } = useOpenScreenplay()

  const totals = useMemo(() => {
    let pages = 0
    let words = 0
    for (const p of projects) {
      const s = safeStats(p)
      pages += s.pages
      words += s.words
    }
    return { pages, words }
  }, [projects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        TYPE_LABEL[p.type].toLowerCase().includes(q),
    )
  }, [projects, query])

  const openSample = () => openEditor(createSample())
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const summary =
    projects.length === 0
      ? 'Your first scene is one tap away.'
      : `${totals.pages} page${totals.pages === 1 ? '' : 's'} across ${projects.length} script${projects.length === 1 ? '' : 's'}. Keep going.`

  return (
    <div className="min-h-full bg-[radial-gradient(90%_55%_at_85%_0%,#ebe2f6_0%,transparent_65%),linear-gradient(180deg,#f8efe4_0%,#f5f2ee_40%,#f3f2f0_100%)] pb-32 text-ink-900 sm:pb-16 dark:bg-[radial-gradient(90%_55%_at_85%_0%,#2a2238_0%,transparent_65%),linear-gradient(180deg,#1d1a17_0%,#17181b_45%)] dark:text-ink-50">
      {/* Top bar */}
      <header className="pt-safe mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
        <button
          type="button"
          onClick={openHome}
          aria-label="Back to home"
          title="Back to home"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200/70 bg-white/80 text-ink-600 backdrop-blur transition-colors hover:text-ink-900 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-300"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-ink-500 sm:hidden dark:text-ink-400">
          Studio
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200/70 bg-white/80 text-ink-600 backdrop-blur transition-colors hover:text-ink-900 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-300"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            type="button"
            onClick={openFile}
            className="hidden h-10 items-center gap-2 rounded-full border border-ink-200/70 bg-white/80 px-4 text-[13.5px] font-medium text-ink-700 backdrop-blur transition-colors hover:text-ink-950 sm:flex dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-200"
          >
            <FolderOpen size={16} />
            Open file
          </button>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="hidden h-10 items-center gap-2 rounded-full bg-ink-950 px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-ink-800 sm:flex dark:bg-ink-50 dark:text-ink-950"
          >
            <Plus size={16} />
            New screenplay
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-8">
        {/* Hero */}
        <section className="pb-6 pt-6 text-center sm:pt-10 sm:text-left">
          <h1 className="font-serif text-[38px] leading-[1.05] tracking-[-0.01em] text-ink-950 sm:text-[52px] dark:text-ink-50">
            {greeting()}
          </h1>
          <p className="mt-2 text-[14.5px] text-ink-500 dark:text-ink-400">{summary}</p>

          <div className="mt-7 flex items-start justify-center gap-6 sm:justify-start sm:gap-8">
            <StatRing value={String(projects.length)} label="Scripts" color={ACCENT.amber} />
            <StatRing value={String(totals.pages)} label="Pages" color={ACCENT.coral} />
            <StatRing
              value={totals.words >= 1000 ? `${(totals.words / 1000).toFixed(1)}k` : String(totals.words)}
              label="Words"
              color={ACCENT.violet}
            />
          </div>
        </section>

        {/* Quick actions */}
        <section className="pb-7">
          <h2 className="mb-3 text-[19px] font-semibold tracking-tight">Start</h2>
          <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            <ActionCard
              primary
              icon={<Plus size={18} />}
              title="New screenplay"
              hint="Blank page, formatted"
              onClick={() => setShowNew(true)}
            />
            <ActionCard
              icon={<FolderOpen size={17} />}
              title="Open a file"
              hint="Pen .reel.json scripts"
              onClick={openFile}
            />
            <ActionCard
              icon={<Play size={16} />}
              title="Try the sample"
              hint="See Pen in action"
              onClick={openSample}
            />
          </div>
        </section>

        {/* Scripts */}
        <section>
          <div className="mb-3 flex h-10 items-center justify-between gap-3">
            {searching ? (
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search scripts…"
                  className="h-10 w-full rounded-full border border-ink-200/70 bg-white/90 pl-10 pr-4 text-[14px] outline-none placeholder:text-ink-400 focus:border-ink-400 dark:border-ink-800 dark:bg-ink-900"
                />
              </div>
            ) : (
              <h2 className="text-[19px] font-semibold tracking-tight">Your scripts</h2>
            )}
            {projects.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearching((s) => !s)
                  setQuery('')
                }}
                aria-label={searching ? 'Close search' : 'Search scripts'}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-white/70 hover:text-ink-900 dark:hover:bg-ink-800"
              >
                {searching ? <X size={17} /> : <Search size={17} />}
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-ink-200/70 bg-white/85 backdrop-blur dark:border-ink-800 dark:bg-ink-900/70">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f6efe6] text-[#b0773a] dark:bg-ink-800 dark:text-brass-400">
                  <Clapperboard size={20} />
                </span>
                <p className="mt-3 text-[15px] font-semibold">
                  {projects.length === 0 ? 'No scripts yet' : 'Nothing matches'}
                </p>
                <p className="mt-1 max-w-xs text-[13px] text-ink-500 dark:text-ink-400">
                  {projects.length === 0
                    ? 'Start a new screenplay or open one you saved earlier.'
                    : 'Try a title, author or type.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {filtered.map((p) => (
                  <ProjectRow key={p.id} project={p} onOpen={() => openEditor(p.id)} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-ink-200/60 bg-white/90 backdrop-blur-md sm:hidden dark:border-ink-800 dark:bg-ink-950/90">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          <NavItem icon={<HomeIcon size={20} />} label="Home" onClick={openHome} />
          <NavItem icon={<Clapperboard size={20} />} label="Scripts" active />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowNew(true)}
              aria-label="New screenplay"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink-950 text-white shadow-lift transition-transform active:scale-95 dark:bg-ink-50 dark:text-ink-950"
            >
              <Plus size={24} />
            </button>
          </div>
          <NavItem icon={<FolderOpen size={20} />} label="Open" onClick={openFile} />
          <NavItem icon={<Play size={19} />} label="Sample" onClick={openSample} />
        </div>
      </nav>

      {openFileUi}
      <NewScreenplayDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onOpenFile={() => {
          setShowNew(false)
          openFile()
        }}
      />
    </div>
  )
}

function NavItem({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-medium',
        active ? 'text-ink-950 dark:text-ink-50' : 'text-ink-400 dark:text-ink-500',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
