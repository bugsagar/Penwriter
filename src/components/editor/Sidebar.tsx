import { useMemo } from 'react'
import { Copy, FileText, MoreHorizontal, PanelLeftClose, Trash2 } from 'lucide-react'
import type { Project } from '../../types'
import { useApp } from '../../store/useApp'
import { sceneChunks, duplicateScene } from '../../utils/scenes'
import { Dropdown, IconButton, MenuItem, cn } from '../ui'

interface Props {
  project: Project
  activeId: string | null
  onJump: (elementId: string) => void
  onCollapse: () => void
}

export function Sidebar({ project, activeId, onJump, onCollapse }: Props) {
  const removeElements = useApp((s) => s.removeElements)
  const setElements = useApp((s) => s.setElements)

  const chunks = useMemo(() => sceneChunks(project.elements), [project.elements])

  const activeChunkIndex = useMemo(() => {
    if (!activeId) return null
    const idx = chunks.findIndex((c) => c.some((el) => el.id === activeId))
    return idx === -1 ? null : idx
  }, [chunks, activeId])

  const duplicatePage = (ci: number) => {
    const headingId = chunks[ci]?.[0]?.id
    if (!headingId) return
    const { elements, newHeadingId } = duplicateScene(project.elements, headingId)
    setElements(elements)
    requestAnimationFrame(() => onJump(newHeadingId))
  }

  const deletePage = (ci: number) => {
    const chunk = chunks[ci]
    if (!chunk) return
    removeElements(chunk.map((el) => el.id))
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col rounded-xl border border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500">
          Pages
        </span>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-500 dark:bg-ink-800 dark:text-ink-400">
            {chunks.length}
          </span>
          <IconButton title="Collapse pages" onClick={onCollapse} className="h-6 w-6">
            <PanelLeftClose size={14} />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {chunks.map((chunk, ci) => {
          const first = chunk[0]
          const preview = first?.text.trim().slice(0, 34) || 'Blank page'
          const active = ci === activeChunkIndex
          return (
            <div
              key={first?.id ?? ci}
              className={cn(
                'group relative mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors',
                active
                  ? 'bg-ink-100 dark:bg-ink-800'
                  : 'hover:bg-ink-50 dark:hover:bg-ink-800/60',
              )}
            >
              <button
                type="button"
                onClick={() => first && onJump(first.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-ink-200/70 bg-white text-ink-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-500">
                  <FileText size={13} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink-900 dark:text-ink-50">
                    Page {ci + 1}
                  </span>
                  <span className="block truncate text-[11px] text-ink-400 dark:text-ink-500">
                    {preview}
                  </span>
                </span>
              </button>
              <div
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <Dropdown
                  trigger={
                    <IconButton title={`Page ${ci + 1} options`} className="h-6 w-6">
                      <MoreHorizontal size={14} />
                    </IconButton>
                  }
                >
                  {(close) => (
                    <>
                      <MenuItem
                        icon={<Copy size={14} />}
                        label="Duplicate page"
                        onClick={() => {
                          duplicatePage(ci)
                          close()
                        }}
                      />
                      <MenuItem
                        icon={<Trash2 size={14} />}
                        label="Delete page"
                        danger
                        onClick={() => {
                          deletePage(ci)
                          close()
                        }}
                      />
                    </>
                  )}
                </Dropdown>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
