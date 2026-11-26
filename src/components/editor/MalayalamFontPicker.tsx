import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useApp } from '../../store/useApp'
import { MALAYALAM_FONTS, MALAYALAM_FONT_DEFAULT, sameFontForEnglish } from '../../utils/fonts'
import type { MalayalamFont } from '../../types'
import { cn } from '../ui'

const SAMPLE = 'മലയാളം കഥ'

/**
 * Choose the script's Malayalam font. Closed, it shows the current font;
 * open, every font shows a sample written in itself (fonts download only
 * when shown, so they load on opening).
 */
export function MalayalamFontPicker({ compact }: { compact?: boolean }) {
  const current = useApp((s) => s.projects.find((p) => p.id === s.activeProjectId)?.settings.malayalamFont) ?? MALAYALAM_FONT_DEFAULT
  const englishToo = useApp((s) => sameFontForEnglish(s.projects.find((p) => p.id === s.activeProjectId)?.settings.fontFamily))
  const setProjectSettings = useApp((s) => s.setProjectSettings)
  const [open, setOpen] = useState(false)
  const cur = MALAYALAM_FONTS.find((f) => f.id === current) ?? MALAYALAM_FONTS[0]

  const pick = (id: MalayalamFont) => {
    setProjectSettings({ malayalamFont: id })
    setOpen(false)
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 text-left text-ink-900 transition-colors hover:border-ink-300 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-50',
          compact ? 'py-1.5' : 'py-2',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-snug" style={{ fontFamily: `'${cur.family}'` }}>
            {englishToo ? `${SAMPLE} Story` : SAMPLE}
          </span>
          <span className="block truncate text-[11.5px] text-ink-500 dark:text-ink-400">{cur.label}</span>
        </span>
        <ChevronDown size={15} className={cn('shrink-0 text-ink-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="listbox" aria-label="Malayalam font" className={cn('mt-1.5 grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-2')}>
          {MALAYALAM_FONTS.map((f) => {
            const on = f.id === current
            return (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => pick(f.id)}
                className={cn(
                  'relative rounded-lg border px-2.5 py-2 text-left transition-colors',
                  on
                    ? 'border-ink-900 bg-ink-50 dark:border-ink-100 dark:bg-ink-800'
                    : 'border-ink-200 hover:border-ink-300 dark:border-ink-700 dark:hover:border-ink-500',
                )}
              >
                <span className="block truncate text-[16px] leading-snug text-ink-900 dark:text-ink-50" style={{ fontFamily: `'${f.family}'` }}>
                  {englishToo ? `${SAMPLE} Story` : SAMPLE}
                </span>
                <span className="block truncate pr-4 text-[11px] text-ink-500 dark:text-ink-400">{f.label}</span>
                {on && <Check size={13} className="absolute bottom-2 right-2 text-ink-900 dark:text-ink-50" />}
              </button>
            )
          })}
        </div>
      )}
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-700 dark:text-ink-200">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-ink-900 dark:accent-ink-100"
          checked={englishToo}
          onChange={(e) => setProjectSettings({ fontFamily: e.target.checked ? 'malayalam' : 'courier-prime' })}
        />
        Use this font for English too
      </label>
    </div>
  )
}
