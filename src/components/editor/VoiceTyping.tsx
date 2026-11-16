import { Download, Mic, Square, WifiOff, X } from 'lucide-react'
import type { VoiceTyping } from '../../hooks/useVoiceTyping'
import { MODEL_MB } from '../../utils/asr/model'
import { cn } from '../ui'

// Keep the caret in the script line while tapping voice controls.
const keep = {
  onPointerDown: (e: React.PointerEvent) => e.preventDefault(),
  onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
}

export function MicButton({ voice, className }: { voice: VoiceTyping; className?: string }) {
  const on = voice.status === 'listening' || voice.status === 'starting'
  return (
    <button
      type="button"
      {...keep}
      onClick={() => voice.toggle()}
      aria-pressed={on}
      aria-label={on ? 'Stop voice typing' : 'Voice typing'}
      title={on ? 'Stop voice typing' : 'Voice typing (Malayalam / English)'}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full transition-colors',
        on
          ? 'bg-[#e8734e] text-white'
          : 'border border-ink-200/80 bg-white text-ink-700 hover:text-ink-950 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200',
        className,
      )}
    >
      {on && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-[#e8734e]/35 transition-transform duration-100"
          style={{ transform: `scale(${1 + voice.level * 0.45})` }}
        />
      )}
      <Mic size={17} className="relative" />
    </button>
  )
}

/** Live transcript, language switch, and offline-model prompts. */
export function VoicePanel({ voice, floating }: { voice: VoiceTyping; floating?: boolean }) {
  if (voice.status === 'idle') return null
  const panel = <PanelBody voice={voice} />
  if (!floating) return panel
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-12 z-40 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[560px]">{panel}</div>
    </div>
  )
}

function PanelBody({ voice }: { voice: VoiceTyping }) {
  const { status } = voice
  const shell =
    'animate-fade-slide-in w-full rounded-[22px] border border-ink-200/80 bg-white/95 px-4 py-3 text-ink-800 shadow-[0_10px_30px_-10px_rgb(20_22_26/0.25)] backdrop-blur dark:border-ink-700 dark:bg-ink-900/95 dark:text-ink-100'

  if (status === 'need-model' || status === 'downloading') {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    return (
      <div className={shell} role="dialog" aria-label="Offline voice model">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fbeee8] text-[#c4532d] dark:bg-ink-800 dark:text-[#f0a35e]">
            {offline ? <WifiOff size={16} /> : <Download size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            {status === 'downloading' ? (
              <>
                <p className="text-[13.5px] font-semibold">Downloading the Malayalam voice model…</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                  <div className="h-full rounded-full bg-[#e8734e] transition-[width]" style={{ width: `${Math.round(voice.progress * 100)}%` }} />
                </div>
                <p className="mt-1.5 text-[12px] text-ink-500 dark:text-ink-400">
                  {Math.round(voice.progress * MODEL_MB)} of {MODEL_MB} MB · stays on this device
                </p>
              </>
            ) : (
              <>
                <p className="text-[13.5px] font-semibold">
                  {offline
                    ? "You're offline"
                    : voice.needReason === 'unsupported'
                      ? 'This browser has no Malayalam voice typing'
                      : 'Voice typing on this device'}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-500 dark:text-ink-400">
                  {voice.error ??
                    (offline
                      ? `Voice typing needs internet, or the offline Malayalam model. Connect once to download it (${MODEL_MB} MB).`
                      : voice.needReason === 'unsupported'
                        ? `Download the Malayalam voice model once (${MODEL_MB} MB) and it runs right on this phone, even without internet. (Chrome on Android and computers can also type by voice without it.)`
                        : `Download the Malayalam voice model once (${MODEL_MB} MB) to type by voice without internet. It stays on this device.`)}
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    {...keep}
                    onClick={voice.download}
                    disabled={offline}
                    className="rounded-full bg-ink-950 px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40 dark:bg-ink-50 dark:text-ink-950"
                  >
                    Download {MODEL_MB} MB
                  </button>
                  <button
                    type="button"
                    {...keep}
                    onClick={voice.dismiss}
                    className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
                  >
                    Not now
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            {...keep}
            aria-label={status === 'downloading' ? 'Cancel download' : 'Close'}
            onClick={status === 'downloading' ? voice.cancelDownload : voice.dismiss}
            className="-mr-1 rounded-full p-1 text-ink-400 hover:text-ink-800 dark:hover:text-ink-100"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={shell} role="alert">
        <div className="flex items-start gap-3">
          <p className="flex-1 text-[13px] leading-snug">{voice.error}</p>
          <button type="button" {...keep} aria-label="Close" onClick={voice.dismiss} className="rounded-full p-1 text-ink-400 hover:text-ink-800">
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  // listening / starting
  const canOffline = voice.lang === 'ml'
  return (
    <div className={shell} aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e8734e] opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#e8734e]" />
        </span>
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
          {status === 'starting' ? 'Starting…' : voice.engine === 'offline' ? 'On device' : 'Listening'}
        </span>
        <div className="flex-1" />
        <div className="flex rounded-full bg-ink-100 p-0.5 dark:bg-ink-800">
          {(
            [
              ['ml', 'മലയാളം'],
              ['en', 'English'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              {...keep}
              onClick={async () => {
                await voice.setLang(v)
                void voice.start({ lang: v })
              }}
              className={cn(
                'rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors',
                voice.lang === v ? 'bg-white text-ink-950 shadow-sm dark:bg-ink-600 dark:text-white' : 'text-ink-500 dark:text-ink-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          {...keep}
          onClick={voice.stop}
          aria-label="Stop voice typing"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 text-white dark:bg-ink-50 dark:text-ink-950"
        >
          <Square size={12} fill="currentColor" />
        </button>
      </div>
      <p className={cn('mt-2 min-h-[22px] text-[15px] leading-snug', voice.interim ? 'text-ink-700 dark:text-ink-200' : 'text-ink-400 dark:text-ink-500')}>
        {voice.interim || (voice.lang === 'ml' ? 'സംസാരിക്കൂ… text appears at the cursor' : 'Speak… text appears at the cursor')}
      </p>
      {canOffline && (
        <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink-400 dark:text-ink-500">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={voice.offlineOnly}
              onMouseDown={(e) => e.preventDefault()}
              onChange={async (e) => {
                const v = e.target.checked
                await voice.setOfflineOnly(v)
                void voice.start({ offline: v })
              }}
              className="h-3.5 w-3.5 accent-[#e8734e]"
            />
            Offline (on device, private)
          </label>
          {!voice.modelReady && <span>· needs a one-time {MODEL_MB} MB download</span>}
        </div>
      )}
    </div>
  )
}
