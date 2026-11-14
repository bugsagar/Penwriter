import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Replace, X } from 'lucide-react'
import { IconButton } from '../ui'

interface Props {
  query: string
  setQuery: (q: string) => void
  matches: number
  activeMatch: number
  onNext: () => void
  onPrev: () => void
  onReplaceAll: (replacement: string) => void
  onClose: () => void
}

export function SearchBar({
  query,
  setQuery,
  matches,
  activeMatch,
  onNext,
  onPrev,
  onReplaceAll,
  onClose,
}: Props) {
  const replaceAll = (value: string) => {
    if (query.trim()) onReplaceAll(value)
  }

  return (
    <div className="fixed left-1/2 top-14 z-40 w-[calc(100vw-16px)] max-w-[460px] md:top-12 -translate-x-1/2 rounded-xl border border-ink-200 bg-white p-2 shadow-lift dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search screenplay…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (e.shiftKey) onPrev()
              else onNext()
            }
            if (e.key === 'Escape') onClose()
          }}
          className="min-w-0 flex-1 rounded-md bg-ink-100 px-2.5 py-1.5 text-[13px] text-ink-900 outline-none dark:bg-ink-950 dark:text-ink-50"
        />
        <span className="whitespace-nowrap text-[11px] tabular-nums text-ink-400 dark:text-ink-500">
          {matches > 0 ? `${activeMatch + 1} / ${matches}` : matches === 0 && query ? '0' : ''}
        </span>
        <IconButton title="Previous match (Shift+Enter)" onClick={onPrev} className="h-7 w-7">
          <ArrowUp size={14} />
        </IconButton>
        <IconButton title="Next match (Enter)" onClick={onNext} className="h-7 w-7">
          <ArrowDown size={14} />
        </IconButton>
        <IconButton title="Close (Esc)" onClick={onClose} className="h-7 w-7">
          <X size={14} />
        </IconButton>
      </div>
      <ReplaceRow query={query} matches={matches} onReplaceAll={replaceAll} />
    </div>
  )
}

function ReplaceRow({
  query,
  matches,
  onReplaceAll,
}: {
  query: string
  matches: number
  onReplaceAll: (value: string) => void
}) {
  const [value, setValue] = useState('')

  return (
    <div className="mt-1.5 flex items-center gap-1.5 border-t border-ink-100 pt-1.5 dark:border-ink-800">
      <Replace size={13} className="ml-1 text-ink-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Replace with…"
        className="min-w-0 flex-1 rounded-md bg-ink-100 px-2.5 py-1 text-[12.5px] text-ink-900 outline-none dark:bg-ink-950 dark:text-ink-50"
      />
      <button
        disabled={!query.trim() || matches === 0}
        onClick={() => onReplaceAll(value)}
        className="flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-[11.5px] font-medium text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-40 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-200 dark:hover:bg-ink-800"
      >
        <Check size={12} />
        Replace all
      </button>
    </div>
  )
}
