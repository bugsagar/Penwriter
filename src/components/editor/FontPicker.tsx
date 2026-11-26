import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useApp } from '../../store/useApp'
import { DOC_FONTS, MALAYALAM_FONTS, MALAYALAM_FONT_DEFAULT, fontStackFor, sameFontForEnglish } from '../../utils/fonts'
import type { DocFontFamily, MalayalamFont } from '../../types'
import { cn } from '../ui'

const SAMPLE = 'മലയാളം Story'

type Choice = { kind: 'ml'; id: MalayalamFont } | { kind: 'doc'; id: DocFontFamily }

/**
 * The script's one font choice. Google's Malayalam fonts write both
 * Malayalam and English; the classic screenplay fonts (Courier…) write
 * English, with Malayalam in the script's Malayalam font. Every option shows
 * a sample in itself (fonts download only when shown, so on opening).
 */
export function FontPicker({ compact }: { compact?: boolean }) {
  const settings = useApp((s) => s.projects.find((p) => p.id === s.activeProjectId)?.settings)
  const setProjectSettings = useApp((s) => s.setProjectSettings)
  const [open, setOpen] = useState(false)
  const ml = settings?.malayalamFont ?? MALAYALAM_FONT_DEFAULT
  const doc = settings?.fontFamily ?? 'courier-prime'
  const oneFont = sameFontForEnglish(doc)

  const options: { key: string; label: string; stack: string; on: boolean; choice: Choice }[] = [
    ...MALAYALAM_FONTS.map((f) => ({
      key: `ml-${f.id}`,
      label: f.label,
      stack: fontStackFor('malayalam', f.id),
      on: oneFont && f.id === ml,
      choice: { kind: 'ml' as const, id: f.id },
    })),
    ...DOC_FONTS.filter((f) => !sameFontForEnglish(f.id)).map((f) => ({
      key: `doc-${f.id}`,
      label: f.label,
      stack: fontStackFor(f.id, oneFont ? MALAYALAM_FONT_DEFAULT : ml),
      on: !oneFont && f.id === doc,
      choice: { kind: 'doc' as const, id: f.id },
    })),
  ]
  const cur = options.find((o) => o.on) ?? options[0]

  const pick = (c: Choice) => {
    // a classic font writes Malayalam in Noto Sans, as the list shows
    setProjectSettings(
      c.kind === 'ml' ? { fontFamily: 'malayalam', malayalamFont: c.id } : { fontFamily: c.id, malayalamFont: MALAYALAM_FONT_DEFAULT },
    )
    setOpen(false)
  }

  const item = (o: (typeof options)[number]) => (
    <button
      key={o.key}
      type="button"
      role="option"
      aria-selected={o.on}
      onClick={() => pick(o.choice)}
      className={cn(
        'relative rounded-lg border px-2.5 py-2 text-left transition-colors',
        o.on
          ? 'border-ink-900 bg-ink-50 dark:border-ink-100 dark:bg-ink-800'
          : 'border-ink-200 hover:border-ink-300 dark:border-ink-700 dark:hover:border-ink-500',
      )}
    >
      <span className="block truncate text-[16px] leading-snug text-ink-900 dark:text-ink-50" style={{ fontFamily: o.stack }}>
        {SAMPLE}
      </span>
      <span className="block truncate pr-4 text-[11px] text-ink-500 dark:text-ink-400">{o.label}</span>
      {o.on && <Check size={13} className="absolute bottom-2 right-2 text-ink-900 dark:text-ink-50" />}
    </button>
  )

  const grid = cn('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-2')
  const heading = 'mb-1 mt-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-400 dark:text-ink-500'

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 text-left text-ink-900 transition-colors hover:border-ink-300 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-50',
          compact ? 'py-1.5' : 'py-2',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-snug" style={{ fontFamily: cur.stack }}>
            {SAMPLE}
          </span>
          <span className="block truncate text-[11.5px] text-ink-500 dark:text-ink-400">{cur.label}</span>
        </span>
        <ChevronDown size={15} className={cn('shrink-0 text-ink-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="listbox" aria-label="Font">
          <p className={heading}>Google fonts</p>
          <div className={grid}>{options.filter((o) => o.choice.kind === 'ml').map(item)}</div>
          <p className={heading}>Classic screenplay fonts</p>
          <div className={grid}>{options.filter((o) => o.choice.kind === 'doc').map(item)}</div>
        </div>
      )}
    </div>
  )
}
