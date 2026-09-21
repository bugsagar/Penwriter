import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../store/useApp'
import type { Project } from '../../types'
import { deriveScenes } from '../../utils/scenes'
import { normalizeCharacterName } from '../../utils/detect'
import { IconButton } from '../ui'

interface Props {
  project: Project
  activeCharacterId: string | null
  onSelect: (characterId: string) => void
}

export interface CharacterStats {
  id: string
  name: string
  manual: boolean
  notes: string
  scenes: number
  dialogues: number
  firstAppearance: number | null
}

/** Detect characters from CHARACTER elements and compute stats. */
export function detectCharacters(project: Project): CharacterStats[] {
  const scenes = deriveScenes(project)
  const byName = new Map<string, CharacterStats>()
  const sceneSets = new Map<string, Set<number>>()
  let currentSceneIndex = 0
  let lastCharacter: string | null = null

  const ensure = (name: string): CharacterStats => {
    let entry = byName.get(name)
    if (!entry) {
      entry = {
        id: name.toLowerCase(),
        name,
        manual: false,
        notes: '',
        scenes: 0,
        dialogues: 0,
        firstAppearance: null,
      }
      byName.set(name, entry)
    }
    return entry
  }

  for (const el of project.elements) {
    if (el.type === 'SCENE_HEADING') {
      currentSceneIndex = scenes.findIndex((s) => s.headingElementId === el.id)
      if (currentSceneIndex === -1) currentSceneIndex = 0
    } else if (el.type === 'CHARACTER') {
      const name = normalizeCharacterName(el.text)
      if (!name) continue
      lastCharacter = name
      const entry = ensure(name)
      if (entry.firstAppearance === null) entry.firstAppearance = currentSceneIndex + 1
      let set = sceneSets.get(name)
      if (!set) {
        set = new Set()
        sceneSets.set(name, set)
      }
      set.add(currentSceneIndex)
    } else if (el.type === 'DIALOGUE' && lastCharacter) {
      ensure(lastCharacter).dialogues++
    } else if (el.type !== 'PARENTHETICAL') {
      lastCharacter = null
    }
  }

  for (const [name, set] of sceneSets) {
    byName.get(name)!.scenes = set.size
  }

  // merge stored (manual) characters
  for (const c of project.characters) {
    const clean = normalizeCharacterName(c.name)
    if (!clean) continue
    const existing = byName.get(clean)
    if (existing) {
      existing.manual = existing.manual || c.manual
      existing.notes = existing.notes || c.notes
      existing.id = c.id
    } else {
      byName.set(clean, {
        id: c.id,
        name: c.name,
        manual: true,
        notes: c.notes,
        scenes: 0,
        dialogues: 0,
        firstAppearance: null,
      })
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function CharacterList({ project, activeCharacterId, onSelect }: Props) {
  const upsertCharacter = useApp((s) => s.upsertCharacter)
  const removeCharacter = useApp((s) => s.removeCharacter)

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const characters = useMemo(() => detectCharacters(project), [project])

  const add = () => {
    const clean = name.trim()
    if (!clean) return
    upsertCharacter(clean)
    const stats = characters.find((c) => c.name.toLowerCase() === clean.toLowerCase())
    if (stats) onSelect(stats.id)
    setName('')
    setAdding(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500">
          Characters
        </span>
        <IconButton title="Add character" onClick={() => setAdding(true)} className="h-6 w-6">
          <Plus size={14} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {adding && (
          <div className="mb-1 flex items-center gap-1 rounded-md bg-ink-100 px-2 py-1.5 dark:bg-ink-800">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add()
                if (e.key === 'Escape') setAdding(false)
              }}
              placeholder="Character name"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink-900 outline-none placeholder:text-ink-400 dark:text-ink-50"
            />
            <button
              onClick={add}
              className="rounded bg-ink-900 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-ink-50 dark:text-ink-900"
            >
              Add
            </button>
          </div>
        )}
        {characters.length === 0 && (
          <p className="px-2 pt-3 text-[12px] text-ink-400 dark:text-ink-500">
            Characters are detected automatically from dialogue.
          </p>
        )}
        {characters.map((c) => (
          <CharacterRow key={c.id} c={c} active={c.id === activeCharacterId} onSelect={onSelect} onRemove={() => removeCharacter(c.id)} />
        ))}
      </div>
    </div>
  )
}

function CharacterRow({
  c,
  active,
  onSelect,
  onRemove,
}: {
  c: CharacterStats
  active: boolean
  onSelect: (id: string) => void
  onRemove: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div
      onClick={() => onSelect(c.id)}
      className={`group mb-0.5 flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors ${
        active
          ? 'border-brass-300 bg-brass-300/10 dark:border-brass-500/60 dark:bg-brass-300/10'
          : 'hover:bg-ink-100 dark:hover:bg-ink-800'
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-200 text-[10px] font-semibold uppercase text-ink-600 dark:bg-ink-700 dark:text-ink-200">
        {c.name.charAt(0)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-800 dark:text-ink-200">
        {c.name}
      </span>
      {c.dialogues > 0 && (
        <span className="text-[10.5px] tabular-nums text-ink-400 dark:text-ink-500">
          {c.dialogues}
        </span>
      )}
      {confirming ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="text-[10.5px] font-medium text-red-500 hover:underline"
        >
          Remove?
        </button>
      ) : (
        <button
          title="Remove character"
          onClick={(e) => {
            e.stopPropagation()
            setConfirming(true)
          }}
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 size={12} className="text-ink-400 hover:text-red-500 dark:text-ink-500" />
        </button>
      )}
    </div>
  )
}
