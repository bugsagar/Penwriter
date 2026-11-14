import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { useApp } from '../store/useApp'
import { FILE_EXT, FileFormatError, pickOpenFile, readProjectFile } from '../utils/files'

/**
 * "Open a screenplay file" — only Pen's own .reel.json format is accepted.
 * Returns an `open()` trigger plus the hidden input + error toast to render.
 */
export function useOpenScreenplay() {
  const importProject = useApp((s) => s.importProject)
  const openEditor = useApp((s) => s.openEditor)
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  const fail = (err: unknown) =>
    setError(
      err instanceof FileFormatError ? err.message : 'That file could not be opened.',
    )

  const load = useCallback(
    (project: Parameters<typeof importProject>[0]) => {
      openEditor(importProject(project))
    },
    [importProject, openEditor],
  )

  const open = useCallback(async () => {
    setError(null)
    try {
      const res = await pickOpenFile()
      if (res === 'unsupported') inputRef.current?.click()
      else if (res) load(res)
    } catch (err) {
      fail(err)
    }
  }, [load])

  const element = (
    <>
      <input
        ref={inputRef}
        type="file"
        // .json lets phones (which filter by type, not double extensions)
        // show the file; the contents are validated before opening.
        accept={`${FILE_EXT},.json,application/json`}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            load(await readProjectFile(file))
          } catch (err) {
            fail(err)
          }
        }}
      />
      {error && (
        <div
          role="alert"
          className="animate-fade-slide-in fixed inset-x-4 bottom-28 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-ink-950 px-4 py-3 text-[13.5px] text-white shadow-lift sm:bottom-8 dark:bg-ink-50 dark:text-ink-900"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#f0a35e]" />
          <span className="flex-1 leading-snug">{error}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setError(null)}
            className="-mr-1 rounded-full p-1 opacity-70 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  )

  return { open, element }
}
