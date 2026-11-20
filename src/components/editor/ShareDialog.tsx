import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Globe, Lock, RefreshCw, Share2, X } from 'lucide-react'
import type { Project } from '../../types'
import { createShareLink, randomCode, rememberUnlock } from '../../utils/share'
import { cn } from '../ui'

/**
 * Share a view-only link. First asks how: open to anyone with the link, or
 * locked with a random 6-digit code. Then shows the link (and code) to copy.
 */
export function ShareDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const [mode, setMode] = useState<'open' | 'code'>('open')
  const [code, setCode] = useState(randomCode)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ url: string; code?: string } | null>(null)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setResult(null)
    setError(null)
    setCopied(null)
    setCode(randomCode())
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const copy = async (what: 'link' | 'code', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600)
    } catch {
      window.prompt('Copy this:', text)
    }
  }

  // Phones (and the installed app) handle a pre-opened tab badly — it often
  // stays blank — and won't copy after the encryption step. There, the result
  // offers the phone's own share sheet and plain tap-to-copy instead.
  const isPhone =
    typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const nativeShare = async (data: ShareData) => {
    try {
      await navigator.share(data)
    } catch {
      /* cancelled */
    }
  }

  const create = async () => {
    // desktop: open the tab inside the click so pop-up blockers allow it
    const tab = isPhone ? null : window.open('', '_blank')
    setBusy(true)
    setError(null)
    try {
      const lock = mode === 'code' ? code : undefined
      const url = await createShareLink(project, lock)
      const shareCode = url.split('#share=')[1]
      if (lock) rememberUnlock(shareCode, lock) // you won't be asked for your own code
      setResult({ url, code: lock })
      if (!isPhone) {
        try {
          await navigator.clipboard.writeText(url)
          setCopied('link')
          setTimeout(() => setCopied((c) => (c === 'link' ? null : c)), 1600)
        } catch {
          /* the Copy button is right there */
        }
      }
      if (tab) tab.location.href = `${url}&new=1`
    } catch (err) {
      tab?.close()
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const option = (value: 'open' | 'code', icon: React.ReactNode, title: string, hint: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => setMode(value)}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
        mode === value
          ? 'border-ink-950 bg-ink-50 dark:border-ink-50 dark:bg-ink-800'
          : 'border-ink-200 hover:border-ink-300 dark:border-ink-700 dark:hover:border-ink-600',
      )}
    >
      <span className="mt-0.5 text-ink-600 dark:text-ink-300">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-ink-900 dark:text-ink-50">{title}</span>
        <span className="block text-[12.5px] leading-snug text-ink-500 dark:text-ink-400">{hint}</span>
      </span>
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          mode === value ? 'border-ink-950 bg-ink-950 text-white dark:border-ink-50 dark:bg-ink-50 dark:text-ink-950' : 'border-ink-300 dark:border-ink-600',
        )}
      >
        {mode === value && <Check size={12} strokeWidth={3} />}
      </span>
    </button>
  )

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-950/40 backdrop-blur-[2px] sm:items-center sm:p-6 dark:bg-black/55"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share"
        className="animate-sheet-up pb-safe w-full rounded-t-[24px] bg-white p-5 shadow-lift sm:max-w-[440px] sm:rounded-[24px] dark:bg-ink-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-[24px] leading-tight text-ink-950 dark:text-ink-50">Share</h2>
            <p className="mt-0.5 text-[13px] text-ink-500 dark:text-ink-400">
              A view-only link to “{project.title || 'Untitled'}”. Readers can’t change your copy.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500 hover:text-ink-900 dark:bg-ink-800 dark:text-ink-400"
          >
            <X size={16} />
          </button>
        </div>

        {!result ? (
          <>
            <p className="mb-2 text-[12.5px] font-medium text-ink-500 dark:text-ink-400">Password protect this link?</p>
            <div className="space-y-2">
              {option('open', <Globe size={18} />, 'No — anyone with the link', 'Whoever you send the link to can read it.')}
              {option('code', <Lock size={18} />, 'Yes — link + 6-digit code', 'Readers type a code before the script opens.')}
            </div>

            {mode === 'code' && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#fdf3cf] px-4 py-3 dark:bg-[#2a261b]">
                <div>
                  <p className="text-[11.5px] font-medium text-[#6b5208] dark:text-[#e9c48a]">Code</p>
                  <p className="font-mono text-[26px] font-semibold tracking-[0.25em] text-ink-950 dark:text-ink-50">{code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCode(randomCode())}
                  className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-white dark:bg-ink-800 dark:text-ink-200"
                >
                  <RefreshCw size={13} />
                  New code
                </button>
              </div>
            )}

            {error && <p className="mt-3 text-[12.5px] text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink-950 text-[14.5px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:opacity-60 dark:bg-ink-50 dark:text-ink-950"
            >
              {busy ? (mode === 'code' ? 'Locking…' : 'Making link…') : 'Create link'}
            </button>
          </>
        ) : (
          <>
            <p className="mb-1.5 text-[12.5px] font-medium text-ink-500 dark:text-ink-400">Link</p>
            <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 py-1.5 pl-3 pr-1.5 dark:border-ink-700 dark:bg-ink-950">
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-600 dark:text-ink-300">{result.url}</span>
              <button
                type="button"
                onClick={() => copy('link', result.url)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ink-950 px-2.5 py-1.5 text-[12px] font-semibold text-white dark:bg-ink-50 dark:text-ink-950"
              >
                {copied === 'link' ? <Check size={13} /> : <Copy size={13} />}
                {copied === 'link' ? 'Copied' : 'Copy'}
              </button>
            </div>

            {result.code && (
              <>
                <p className="mb-1.5 mt-3 text-[12.5px] font-medium text-ink-500 dark:text-ink-400">Code</p>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#fdf3cf] px-4 py-2.5 dark:bg-[#2a261b]">
                  <span className="font-mono text-[24px] font-semibold tracking-[0.25em] text-ink-950 dark:text-ink-50">{result.code}</span>
                  <button
                    type="button"
                    onClick={() => copy('code', result.code!)}
                    className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-[12px] font-semibold text-ink-800 hover:bg-white dark:bg-ink-800 dark:text-ink-100"
                  >
                    {copied === 'code' ? <Check size={13} /> : <Copy size={13} />}
                    {copied === 'code' ? 'Copied' : 'Copy code'}
                  </button>
                </div>
                {isPhone && canNativeShare && (
                  <button
                    type="button"
                    onClick={() => nativeShare({ text: `Code to open “${project.title || 'the script'}” in Ezuth: ${result.code}` })}
                    className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-ink-200 text-[13px] font-medium text-ink-800 dark:border-ink-700 dark:text-ink-100"
                  >
                    <Share2 size={14} />
                    Send code…
                  </button>
                )}
                <p className="mt-2 text-[12px] leading-snug text-ink-500 dark:text-ink-400">
                  Send the code separately from the link — for example, the link by email and the code by message.
                </p>
              </>
            )}

            {isPhone && canNativeShare && (
              <button
                type="button"
                onClick={() => nativeShare({ title: project.title || 'Screenplay', text: 'Read my script in Ezuth', url: result.url })}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#e8734e] text-[14.5px] font-semibold text-white"
              >
                <Share2 size={16} />
                Send link…
              </button>
            )}
            <div className="mt-4 flex gap-2">
              <a
                href={`${result.url}&new=1`}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-ink-200 text-[13.5px] font-medium text-ink-800 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-100 dark:hover:bg-ink-800"
              >
                <ExternalLink size={14} />
                Open view
              </a>
              <button
                type="button"
                onClick={onClose}
                className="h-10 flex-1 rounded-full bg-ink-950 text-[13.5px] font-semibold text-white dark:bg-ink-50 dark:text-ink-950"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
