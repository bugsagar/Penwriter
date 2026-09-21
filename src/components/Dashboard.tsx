import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Clapperboard,
  Copy,
  Film,
  HardDrive,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useApp } from '../store/useApp'
import type { Project } from '../types'
import { pageCount, countWords } from '../utils/layout'
import { Dropdown, IconButton, MenuItem, ConfirmItem, Button, cn } from './ui'
import { NewScreenplayDialog } from './NewScreenplayDialog'

const TYPE_LABEL: Record<Project['type'], string> = {
  feature: 'Feature Screenplay',
  short: 'Short Film',
  tv: 'TV Episode',
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const deleteProject = useApp((s) => s.deleteProject)
  const duplicateProject = useApp((s) => s.duplicateProject)

  const { pages, words } = useMemo(() => {
    try {
      return { pages: pageCount(project.elements), words: countWords(project.elements) }
    } catch {
      return { pages: 0, words: 0 }
    }
  }, [project.elements])

  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer rounded-xl border border-ink-200 bg-white p-5 transition-all hover:border-brass-400 hover:shadow-paper dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brass-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          <Film size={16} />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={
              <IconButton title="Project options" className="opacity-0 group-hover:opacity-100">
                <MoreHorizontal size={16} />
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

      <h3 className="mt-4 truncate text-[15px] font-semibold text-ink-900 dark:text-ink-50">
        {project.title || 'Untitled Screenplay'}
      </h3>
      <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-500 dark:text-ink-400">
        {TYPE_LABEL[project.type]}
        {project.savedOnComputer && (
          <span
            title="Saved as a file on your computer — never uploaded"
            className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300"
          >
            <HardDrive size={11} />
            On computer
          </span>
        )}
      </p>

      <div className="mt-4 flex items-center gap-3 text-[12px] text-ink-400 dark:text-ink-500">
        <span>
          {pages} page{pages === 1 ? '' : 's'}
        </span>
        <span className="h-1 w-1 rounded-full bg-ink-300 dark:bg-ink-600" />
        <span>{words.toLocaleString()} words</span>
      </div>
      <div className="mt-1.5 text-[12px] text-ink-400 dark:text-ink-500">
        Edited {timeAgo(project.updatedAt)}
      </div>
    </div>
  )
}

export function Dashboard() {
  const projects = useApp((s) => s.projects)
  const openEditor = useApp((s) => s.openEditor)
  const openHome = useApp((s) => s.openHome)
  const createSample = useApp((s) => s.createSample)
  const [showNew, setShowNew] = useState(false)
  const [query, setQuery] = useState('')

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

  return (
    <div className="min-h-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pb-2 pt-8 sm:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openHome}
            title="Back to home"
            className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-900 text-brass-400 dark:bg-ink-100 dark:text-brass-600">
            <Clapperboard size={19} />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-ink-900 dark:text-ink-50">
              Studio
            </h1>
            <p className="text-[11.5px] text-ink-400 dark:text-ink-500">
              Your screenplays
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => openEditor(createSample())}>
            <Play size={15} />
            Sample script
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowNew(true)}
            className="px-4"
          >
            <Plus size={16} />
            New Screenplay
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
            Projects
          </h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-56 rounded-lg border border-ink-200 bg-white py-1.5 pl-9 pr-3 text-sm text-ink-800 outline-none transition-colors placeholder:text-ink-400 focus:border-brass-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-24 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500">
              <Clapperboard size={28} />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-ink-800 dark:text-ink-100">
              {projects.length === 0 ? 'Start your first screenplay' : 'No projects found'}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
              {projects.length === 0
                ? 'Create a new script from scratch, or open the sample to see the studio in action.'
                : 'Try a different search — project titles, authors, or types.'}
            </p>
            {projects.length === 0 && (
              <div className={cn('mt-6 flex items-center gap-2')}>
                <Button variant="primary" className="px-4" onClick={() => setShowNew(true)}>
                  <Plus size={16} />
                  New Screenplay
                </Button>
                <Button variant="ghost" onClick={() => openEditor(createSample())}>
                  <Play size={15} />
                  Sample script
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => openEditor(p.id)} />
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-5 right-5 flex flex-col items-end gap-2">
        {projects.length === 0 && (
          <button
            onClick={() => openEditor(createSample())}
            className="flex items-center gap-2 rounded-full border border-ink-200 bg-white/90 px-4 py-2 text-sm text-ink-600 shadow-paper backdrop-blur transition-colors hover:text-ink-900 dark:border-ink-700 dark:bg-ink-900/90 dark:text-ink-300"
          >
            <Play size={14} />
            Open a sample
          </button>
        )}
      </div>

      <NewScreenplayDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
