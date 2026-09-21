import { useState } from 'react'
import { Film, Clapperboard, Tv, HardDrive, Globe } from 'lucide-react'
import { useApp } from '../store/useApp'
import { Modal, Button } from './ui'
import {
  supportsFilePicker,
  pickSaveFile,
  downloadProjectFile,
} from '../utils/files'
import type { ProjectType } from '../types'

const TYPES: { value: ProjectType; label: string; icon: typeof Film }[] = [
  { value: 'feature', label: 'Feature', icon: Film },
  { value: 'short', label: 'Short Film', icon: Clapperboard },
  { value: 'tv', label: 'TV Episode', icon: Tv },
]

export function NewScreenplayDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const createProject = useApp((s) => s.createProject)
  const openEditor = useApp((s) => s.openEditor)
  const setSavedOnComputer = useApp((s) => s.setSavedOnComputer)

  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ProjectType>('short')
  const [onComputer, setOnComputer] = useState(true)

  const submit = async () => {
    const id = createProject({ title, author, description, type })
    if (onComputer) {
      // A file on your computer that only you control — never uploaded.
      const proj = useApp.getState().projects.find((p) => p.id === id)
      if (proj) {
        if (supportsFilePicker()) {
          if (await pickSaveFile(proj)) setSavedOnComputer(id, true)
        } else {
          downloadProjectFile(proj)
          setSavedOnComputer(id, true)
        }
      }
    }
    onClose()
    openEditor(id)
  }

  return (
    <Modal open={open} onClose={onClose} title="New Screenplay">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Title
          </label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="My Movie"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brass-400 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-50"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Author
          </label>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brass-400 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-50"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Description <span className="normal-case text-ink-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="A logline or brief note about the story…"
            className="w-full resize-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brass-400 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-50"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Screenplay type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${
                  type === value
                    ? 'border-brass-400 bg-brass-300/15 text-ink-900 dark:bg-brass-300/10 dark:text-ink-50'
                    : 'border-ink-200 text-ink-500 hover:border-ink-300 hover:text-ink-700 dark:border-ink-700 dark:text-ink-400 dark:hover:border-ink-600'
                }`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Save location
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOnComputer(true)}
              className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                onComputer
                  ? 'border-brass-400 bg-brass-300/15 text-ink-900 dark:bg-brass-300/10 dark:text-ink-50'
                  : 'border-ink-200 text-ink-500 hover:border-ink-300 hover:text-ink-700 dark:border-ink-700 dark:text-ink-400 dark:hover:border-ink-600'
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <HardDrive size={15} />
                On my computer
              </span>
              <span className="text-[11px] leading-snug opacity-80">
                A file you control — never uploaded anywhere.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setOnComputer(false)}
              className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                !onComputer
                  ? 'border-brass-400 bg-brass-300/15 text-ink-900 dark:bg-brass-300/10 dark:text-ink-50'
                  : 'border-ink-200 text-ink-500 hover:border-ink-300 hover:text-ink-700 dark:border-ink-700 dark:text-ink-400 dark:hover:border-ink-600'
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Globe size={15} />
                In this browser
              </span>
              <span className="text-[11px] leading-snug opacity-80">
                Private to this device and browser.
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} className="px-4">
            Create Screenplay
          </Button>
        </div>
      </div>
    </Modal>
  )
}
