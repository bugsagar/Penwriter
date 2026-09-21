import { useState } from 'react'
import { Copy, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { useApp } from '../../store/useApp'
import type { Project } from '../../types'
import { deriveScenes, duplicateScene, moveScene, headingForScene } from '../../utils/scenes'
import { uid } from '../../utils/id'
import { Dropdown, IconButton, MenuItem, ConfirmItem } from '../ui'

interface Props {
  project: Project
  activeSceneId: string | null
  onJump: (headingId: string) => void
  onSelect: (sceneId: string) => void
}

export function SceneList({ project, activeSceneId, onJump, onSelect }: Props) {
  const updateElement = useApp((s) => s.updateElement)
  const insertElements = useApp((s) => s.insertElements)
  const setElements = useApp((s) => s.setElements)
  const removeElements = useApp((s) => s.removeElements)
  const setSceneNote = useApp((s) => s.setSceneNote)

  const scenes = deriveScenes(project)
  const showNumbers = project.settings.showSceneNumbers

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)

  const addScene = () => {
    const heading = { id: uid('el'), type: 'SCENE_HEADING' as const, text: '' }
    insertElements(project.elements.length, [heading])
    onJump(heading.id)
    onSelect(heading.id)
    setEditingId(heading.id)
    setDraft('')
  }

  const commitRename = (sceneId: string) => {
    updateElement(sceneId, { text: draft })
    setEditingId(null)
  }

  const duplicate = (sceneId: string) => {
    const { elements, newHeadingId } = duplicateScene(project.elements, sceneId)
    setElements(elements)
    onJump(newHeadingId)
    onSelect(newHeadingId)
  }

  const remove = (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return
    const ids = [sceneId, ...scene.elementIds]
    removeElements(ids)
    setSceneNote(sceneId, '')
  }

  const onDrop = (targetIndex: number) => {
    if (dragId) {
      const next = moveScene(project.elements, dragId, targetIndex)
      setElements(next)
      setDragId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-1">
        <span className="text-[11px] font-medium text-ink-400 dark:text-ink-500">
          Scenes
        </span>
        <IconButton title="Add scene" onClick={addScene} className="h-6 w-6">
          <Plus size={14} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {scenes.length === 0 && (
          <p className="px-2 pt-3 text-[12px] text-ink-400 dark:text-ink-500">
            No scenes yet. Add one to begin.
          </p>
        )}
        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            draggable
            onDragStart={(e) => {
              setDragId(scene.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              onDrop(i)
            }}
            onDragEnd={() => setDragId(null)}
            onClick={() => {
              onJump(scene.id)
              onSelect(scene.id)
            }}
            className={`group mb-px flex cursor-pointer items-start gap-1.5 rounded-md border border-transparent px-2 py-[7px] transition-colors ${
              activeSceneId === scene.id
                ? 'bg-ink-100 dark:bg-ink-800'
                : 'hover:bg-ink-50 dark:hover:bg-ink-800/60'
            } ${dragId === scene.id ? 'opacity-40' : ''}`}
          >
            <span className="mt-[2px] shrink-0 tabular-nums text-ink-400 dark:text-ink-500">
              <GripVertical size={11} className="mr-0.5 inline opacity-0 transition-opacity group-hover:opacity-40" />
              {showNumbers && <span className="text-[11px]">{String(i + 1).padStart(2, '0')}</span>}
            </span>
            {editingId === scene.id ? (
              <div className="flex flex-1 items-center gap-1">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(scene.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onFocus={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 rounded border border-brass-400 bg-white px-1 py-0.5 text-[12px] text-ink-900 outline-none dark:bg-ink-950 dark:text-ink-50"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    commitRename(scene.id)
                  }}
                  className="text-brass-500"
                >
                  <Check size={13} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(null)
                  }}
                  className="text-ink-400"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <span
                className="min-w-0 flex-1 truncate text-[12.5px] leading-snug text-ink-700 dark:text-ink-200"
                title={headingForScene(scene)}
              >
                {headingForScene(scene)}
              </span>
            )}
            <div className="opacity-0 transition-opacity group-hover:opacity-100">
              <Dropdown
                trigger={
                  <IconButton title="Scene options" className="h-6 w-6">
                    <MoreHorizontal size={13} />
                  </IconButton>
                }
              >
                {(close) => (
                  <>
                    <MenuItem
                      icon={<Pencil size={14} />}
                      label="Rename"
                      onClick={() => {
                        setEditingId(scene.id)
                        setDraft(scene.heading)
                        close()
                      }}
                    />
                    <MenuItem
                      icon={<Copy size={14} />}
                      label="Duplicate"
                      onClick={() => {
                        duplicate(scene.id)
                        close()
                      }}
                    />
                    <ConfirmItem
                      icon={<Trash2 size={14} />}
                      label="Delete scene"
                      onConfirm={() => {
                        remove(scene.id)
                        close()
                      }}
                    />
                  </>
                )}
              </Dropdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
