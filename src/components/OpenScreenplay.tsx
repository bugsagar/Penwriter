import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { useApp } from '../store/useApp'
import { FILE_EXT, FileFormatError, pickOpenFile, readProjectFile } from '../utils/files'
import { IMPORT_EXTS, ImportError, isImportable } from '../import/formats'

/** A message over any screen, e.g. after an import; closes by itself. */
export function Notice() {
  const notice = useApp((s) => s.notice)
  const setNotice = useApp((s) => s.setNotice)
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 12000)
    return () => clearTimeout(t)
  }, [notice, setNotice])
  if (!notice) return null
  return (
    <div
      role="status"
      className="animate-fade-slide-in fixed inset-x-4 bottom-28 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-ink-950 px-4 py-3 text-[13.5px] text-white shadow-lift sm:bottom-8 dark:bg-ink-50 dark:text-ink-900"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#f0a35e]" />
      <span className="flex-1 leading-snug">{notice}</span>
      <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="-mr-1 rounded-full p-1 opacity-70 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  )
}

/**
 * "Open a screenplay file": Ezuth's own .reel.json, or a Word / PDF / text
 * file imported as a new script.
 * Returns an `open()` trigger plus the hidden input + toast to render.
 */
export function useOpenScreenplay() {
  const importProject = useApp((s) => s.importProject)
  const openEditor = useApp((s) => s.openEditor)
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])


  const fail = (err: unknown) => {
    if (!(err instanceof FileFormatError || err instanceof ImportError)) console.error(err)
    setError(
      err instanceof FileFormatError || err instanceof ImportError ? err.message : 'That file could not be opened.',
    )
  }

  /** Word / PDF / text → a new script (the reader code loads only now). */
  const importFile = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        const { importDocument } = await import('../import')
        const { project, unreadable } = await importDocument(file)
        openEditor(importProject(project))
        if (unreadable > 0) {
          useApp.getState().setNotice(
            'Some letters in this PDF couldn’t be read and show as �. If you have the Word (.docx) file, import that instead for a clean copy.',
          )
        }
      } finally {
        setBusy(false)
      }
    },
    [importProject, openEditor],
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
      else if (res instanceof File) await importFile(res)
      else if (res) load(res)
    } catch (err) {
      fail(err)
    }
  }, [load, importFile])

  const element = (
    <>
      <input
        ref={inputRef}
        type="file"
        // .json lets phones (which filter by type, not double extensions)
        // show the file; the contents are validated before opening.
        accept={`${FILE_EXT},.json,application/json,${IMPORT_EXTS.join(',')},.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain`}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            if (isImportable(file.name)) await importFile(file)
            else load(await readProjectFile(file))
          } catch (err) {
            fail(err)
          }
        }}
      />
      {busy && (
        <div
          role="status"
          className="animate-fade-slide-in fixed inset-x-4 bottom-28 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink-950 px-4 py-3 text-[13.5px] text-white shadow-lift sm:bottom-8 dark:bg-ink-50 dark:text-ink-900"
        >
          <Loader2 size={18} className="shrink-0 animate-spin" />
          <span className="flex-1 leading-snug">Importing your script…</span>
        </div>
      )}
      {error && !busy && (
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
