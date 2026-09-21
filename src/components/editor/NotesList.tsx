import { StickyNote } from 'lucide-react'
import type { Project } from '../../types'
import { deriveScenes, headingForScene } from '../../utils/scenes'

interface Props {
  project: Project
  onSelect: (sceneId: string) => void
}

export function NotesList({ project, onSelect }: Props) {
  const scenes = deriveScenes(project)
  const withNotes = scenes.filter((s) => s.notes.trim())

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-1 pt-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500">
          Notes
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {withNotes.length === 0 && (
          <p className="px-2 pt-3 text-[12px] text-ink-400 dark:text-ink-500">
            Attach notes to a scene and they'll collect here. Notes never appear in the
            exported screenplay.
          </p>
        )}
        {withNotes.map((scene) => (
          <div
            key={scene.id}
            onClick={() => onSelect(scene.id)}
            className="mb-1.5 cursor-pointer rounded-md border border-ink-100 bg-white px-2.5 py-2 transition-colors hover:border-brass-300 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brass-500/60"
          >
            <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-medium text-ink-400 dark:text-ink-500">
              <StickyNote size={11} />
              <span className="truncate">{headingForScene(scene)}</span>
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap text-[12px] leading-snug text-ink-700 dark:text-ink-300">
              {scene.notes}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
