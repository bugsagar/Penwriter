import { useMemo, useState } from 'react'
import { Check, StickyNote, X } from 'lucide-react'
import type { PageNote, Project } from '../../types'
import type { SheetPart } from '../../utils/layout'
import { anchorForPage, notePage } from '../../utils/notes'
import { useApp } from '../../store/useApp'
import { cn } from '../ui'

/**
 * Notes beside the pages, to check later. "This page" shows the page in
 * view; "All" collects every page's notes. Ticked notes stay, struck
 * through, until deleted. Notes never appear in exports.
 */
export function PageNotes({
  project,
  sheets,
  page,
  selectedId,
  onJumpToPage,
}: {
  project: Project
  sheets: SheetPart[][]
  page: number
  selectedId: string | null
  onJumpToPage: (page: number) => void
}) {
  const addPageNote = useApp((s) => s.addPageNote)
  const [mode, setMode] = useState<'page' | 'all'>('page')
  const [draft, setDraft] = useState('')

  const placed = useMemo(
    () =>
      (project.pageNotes ?? [])
        .map((n) => ({ note: n, page: notePage(n, sheets) }))
        .sort((a, b) => a.page - b.page || a.note.createdAt - b.note.createdAt),
    [project.pageNotes, sheets],
  )
  const here = placed.filter((p) => p.page === page)
  const openTotal = placed.filter((p) => !p.note.done).length

  const add = () => {
    const text = draft.trim()
    if (!text) return
    const anchor = anchorForPage(sheets, page, selectedId)
    if (!anchor) return
    addPageNote({ ...anchor, pageHint: page, text })
    setDraft('')
  }

  // group "All" by page
  const groups = useMemo(() => {
    const m = new Map<number, PageNote[]>()
    for (const { note, page: p } of placed) m.set(p, [...(m.get(p) ?? []), note])
    return [...m.entries()]
  }, [placed])

  return (
    <div className="flex flex-col gap-3 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg bg-ink-100 p-0.5 text-[12px] font-medium dark:bg-ink-800">
          {(
            [
              ['page', `Page ${page + 1}`],
              ['all', `All${openTotal ? ` · ${openTotal}` : ''}`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMode(v)}
              className={cn(
                'rounded-md px-2.5 py-1 transition-colors',
                mode === v ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-600 dark:text-white' : 'text-ink-500 dark:text-ink-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'page' ? (
        <>
          {here.length === 0 && (
            <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-[12px] leading-snug text-ink-400 dark:bg-ink-950 dark:text-ink-500">
              No notes on page {page + 1} yet. Jot down anything to check later — it stays with this part of the
              script, even as pages move.
            </p>
          )}
          <ul className="space-y-1.5">
            {here.map(({ note }) => (
              <NoteRow key={note.id} note={note} />
            ))}
          </ul>
          <div className="rounded-xl border border-ink-200 bg-white focus-within:border-ink-400 dark:border-ink-700 dark:bg-ink-900 dark:focus-within:border-ink-500">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  add()
                }
              }}
              rows={2}
              placeholder={`Add a note for page ${page + 1}…`}
              className="field-sizing-content block max-h-40 min-h-[52px] w-full resize-none bg-transparent px-3 pt-2 text-[13px] leading-snug text-ink-800 outline-none placeholder:text-ink-400 dark:text-ink-100"
            />
            <div className="flex items-center justify-between px-2 pb-1.5">
              <span className="pl-1 text-[10.5px] text-ink-400 dark:text-ink-500">Enter to add</span>
              <button
                type="button"
                onClick={add}
                disabled={!draft.trim()}
                className="rounded-md bg-ink-950 px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-30 dark:bg-ink-50 dark:text-ink-950"
              >
                Add note
              </button>
            </div>
          </div>
        </>
      ) : groups.length === 0 ? (
        <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-[12px] text-ink-400 dark:bg-ink-950 dark:text-ink-500">
          No notes yet. Notes you add on any page collect here.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map(([p, notes]) => (
            <div key={p}>
              <button
                type="button"
                onClick={() => {
                  onJumpToPage(p)
                  setMode('page')
                }}
                className="mb-1 flex w-full items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400 hover:text-ink-800 dark:text-ink-500 dark:hover:text-ink-100"
              >
                <StickyNote size={12} />
                Page {p + 1}
                <span className="font-normal normal-case tracking-normal">
                  · {notes.filter((n) => !n.done).length} open
                </span>
              </button>
              <ul className="space-y-1.5">
                {notes.map((n) => (
                  <NoteRow key={n.id} note={n} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-ink-400 dark:text-ink-500">Notes stay in Pen and never appear in exports.</p>
    </div>
  )
}

function NoteRow({ note }: { note: PageNote }) {
  const updatePageNote = useApp((s) => s.updatePageNote)
  const removePageNote = useApp((s) => s.removePageNote)
  return (
    <li
      className={cn(
        'group flex items-start gap-2 rounded-lg border px-2 py-1.5 transition-colors',
        note.done
          ? 'border-transparent bg-ink-50 dark:bg-ink-950'
          : 'border-[#f1e2b8] bg-[#fdf8e8] dark:border-[#4a4126] dark:bg-[#2a261b]',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={note.done}
        aria-label={note.done ? 'Mark as not checked' : 'Mark as checked'}
        onClick={() => updatePageNote(note.id, { done: !note.done })}
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          note.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-300 hover:border-ink-500 dark:border-ink-600',
        )}
      >
        {note.done && <Check size={10} strokeWidth={3} />}
      </button>
      <textarea
        value={note.text}
        onChange={(e) => updatePageNote(note.id, { text: e.target.value })}
        rows={1}
        aria-label="Note"
        className={cn(
          'field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-[12.5px] leading-snug outline-none',
          note.done ? 'text-ink-400 line-through dark:text-ink-500' : 'text-ink-800 dark:text-ink-100',
        )}
      />
      <button
        type="button"
        aria-label="Delete note"
        onClick={() => removePageNote(note.id)}
        className="shrink-0 rounded p-0.5 text-ink-300 opacity-0 transition-opacity hover:text-ink-700 group-hover:opacity-100 [@media(hover:none)]:opacity-100 dark:text-ink-600 dark:hover:text-ink-200"
      >
        <X size={13} />
      </button>
    </li>
  )
}
