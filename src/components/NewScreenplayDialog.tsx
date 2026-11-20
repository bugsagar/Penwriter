import { useEffect, useState } from 'react'
import { Film, Clapperboard, Tv, HardDrive, Cloud, X, FolderOpen, Check } from 'lucide-react'
import { useApp } from '../store/useApp'
import { cn } from './ui'
import { supportsFilePicker, pickSaveFile, downloadProjectFile } from '../utils/files'
import type { ProjectType } from '../types'

const TYPES: { value: ProjectType; label: string; icon: typeof Film; hint: string }[] = [
  { value: 'feature', label: 'Feature', icon: Film, hint: '90–120 pages' },
  { value: 'short', label: 'Short', icon: Clapperboard, hint: 'Under 40 pages' },
  { value: 'tv', label: 'TV Episode', icon: Tv, hint: '30–60 pages' },
]

const fieldCls =
  'w-full rounded-2xl border border-transparent bg-ink-100/70 px-4 py-3 text-[15px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-ink-300 focus:bg-white dark:bg-ink-800/70 dark:text-ink-50 dark:focus:border-ink-600 dark:focus:bg-ink-900'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[12.5px] font-medium text-ink-500 dark:text-ink-400">
      {children}
    </span>
  )
}

export function NewScreenplayDialog({
  open,
  onClose,
  onOpenFile,
}: {
  open: boolean
  onClose: () => void
  onOpenFile?: () => void
}) {
  const createProject = useApp((s) => s.createProject)
  const openEditor = useApp((s) => s.openEditor)
  const deleteProject = useApp((s) => s.deleteProject)

  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ProjectType>('short')
  const [onComputer, setOnComputer] = useState(true)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = async () => {
    const id = createProject({ title, author, description, type, onComputer })
    if (onComputer) {
      // A file on your computer that only you control — never uploaded.
      const proj = useApp.getState().projects.find((p) => p.id === id)
      if (proj) {
        if (supportsFilePicker()) {
          if (!(await pickSaveFile(proj))) {
            deleteProject(id) // picker cancelled: nothing made, dialog stays open
            return
          }
        } else {
          downloadProjectFile(proj)
        }
      }
    }
    onClose()
    openEditor(id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/35 backdrop-blur-[3px] sm:items-center sm:p-6 dark:bg-black/55"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-sp-title"
        className="animate-sheet-up flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[linear-gradient(180deg,#fbf6f0_0%,#ffffff_140px)] shadow-lift sm:max-w-[520px] sm:rounded-[28px] dark:bg-[linear-gradient(180deg,#221e1a_0%,#17181b_140px)]"
      >
        {/* grab handle (phones) */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-ink-200 dark:bg-ink-700" />
        </div>

        <div className="flex items-start justify-between px-6 pb-1 pt-4 sm:pt-6">
          <div>
            <h2
              id="new-sp-title"
              className="font-serif text-[28px] leading-tight text-ink-950 dark:text-ink-50"
            >
              New screenplay
            </h2>
            <p className="mt-0.5 text-[13.5px] text-ink-500 dark:text-ink-400">
              Name it now, or change it any time.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-ink-100/80 text-ink-500 transition-colors hover:text-ink-900 dark:bg-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
          >
            <X size={17} />
          </button>
        </div>

        <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-6 pb-4 pt-4">
          <label className="block">
            <Label>Title</Label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Untitled screenplay"
              className={cn(fieldCls, 'text-[17px] font-semibold')}
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
            <label className="block">
              <Label>Written by</Label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <Label>Logline (optional)</Label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One line about the story"
                className={fieldCls}
              />
            </label>
          </div>

          <div>
            <Label>Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map(({ value, label, icon: Icon, hint }) => {
                const on = type === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    aria-pressed={on}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition-all active:scale-[0.97]',
                      on
                        ? 'border-ink-950 bg-ink-950 text-white dark:border-ink-50 dark:bg-ink-50 dark:text-ink-950'
                        : 'border-ink-200/80 bg-white text-ink-700 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300',
                    )}
                  >
                    <Icon size={19} strokeWidth={1.8} />
                    <span className="text-[13.5px] font-semibold">{label}</span>
                    <span className={cn('text-[11px]', on ? 'opacity-70' : 'text-ink-400')}>{hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label>Save to</Label>
            <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white dark:border-ink-700 dark:bg-ink-900">
              {[
                {
                  on: onComputer,
                  set: () => setOnComputer(true),
                  icon: <HardDrive size={18} />,
                  title: 'My computer',
                  hint: 'A .reel.json file on this computer, never uploaded',
                },
                {
                  on: !onComputer,
                  set: () => setOnComputer(false),
                  icon: <Cloud size={18} />,
                  title: 'Cloud',
                  hint: 'Saved to your account, on every device',
                },
              ].map((o, i) => (
                <button
                  key={o.title}
                  type="button"
                  role="radio"
                  aria-checked={o.on}
                  onClick={o.set}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                    i > 0 && 'border-t border-ink-100 dark:border-ink-800',
                    o.on ? 'bg-[#fbf6f0] dark:bg-ink-800/60' : 'hover:bg-ink-50 dark:hover:bg-ink-800/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      o.on
                        ? 'bg-[#f3e4d0] text-[#9a6227] dark:bg-ink-700 dark:text-brass-400'
                        : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
                    )}
                  >
                    {o.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold text-ink-900 dark:text-ink-50">
                      {o.title}
                    </span>
                    <span className="block text-[12.5px] text-ink-500 dark:text-ink-400">{o.hint}</span>
                  </span>
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      o.on
                        ? 'border-ink-950 bg-ink-950 text-white dark:border-ink-50 dark:bg-ink-50 dark:text-ink-950'
                        : 'border-ink-300 dark:border-ink-600',
                    )}
                  >
                    {o.on && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pb-safe border-t border-ink-100 bg-white/90 px-6 pt-3 sm:pb-5 dark:border-ink-800 dark:bg-ink-950/60">
          <button
            type="button"
            onClick={submit}
            className="flex h-12 w-full items-center justify-center rounded-full bg-ink-950 text-[15px] font-semibold text-white transition-colors hover:bg-ink-800 active:scale-[0.99] dark:bg-ink-50 dark:text-ink-950"
          >
            Create screenplay
          </button>
          {onOpenFile && (
            <button
              type="button"
              onClick={onOpenFile}
              className="mx-auto mt-1.5 flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-medium text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
            >
              <FolderOpen size={15} />
              Open an existing script instead
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
