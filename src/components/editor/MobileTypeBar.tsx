import type { ElementType } from '../../types'
import { useApp } from '../../store/useApp'
import { cn } from '../ui'

const TYPES: { id: ElementType; label: string }[] = [
  { id: 'SCENE_HEADING', label: 'Scene' },
  { id: 'ACTION', label: 'Action' },
  { id: 'CHARACTER', label: 'Character' },
  { id: 'DIALOGUE', label: 'Dialogue' },
  { id: 'PARENTHETICAL', label: '(Paren)' },
  { id: 'TRANSITION', label: 'Transition' },
  { id: 'SHOT', label: 'Shot' },
]

/** Phone-only bar to switch the current line's element type (no Tab key on touch keyboards). */
export function MobileTypeBar({ selectedId }: { selectedId: string | null }) {
  const current = useApp((s) =>
    selectedId
      ? s.projects.find((p) => p.id === s.activeProjectId)?.elements.find((e) => e.id === selectedId)
          ?.type
      : undefined,
  )
  const updateElement = useApp((s) => s.updateElement)

  return (
    <div className="rounded-full border border-ink-200/80 bg-white shadow-[0_1px_3px_rgb(20_22_26/0.08)] dark:border-ink-700 dark:bg-ink-900">
      <div className="flex gap-1 no-scrollbar overflow-x-auto rounded-full p-1">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={!selectedId}
            // Keep the caret (and the on-screen keyboard) in the script line.
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectedId && updateElement(selectedId, { type: t.id })}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40',
              current === t.id
                ? 'bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900'
                : 'text-ink-600 dark:text-ink-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
