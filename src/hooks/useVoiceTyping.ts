import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadModel, isModelDownloaded, MODEL_MB } from '../utils/asr/model'
import type { OfflineSession } from '../utils/asr/offline'

/*
 * Voice typing in Malayalam (or English).
 *
 * - Online (default): the browser's own speech recognition — nothing to
 *   download, live text as you speak. Chrome/Edge (desktop + Android).
 * - Offline: AI4Bharat IndicConformer running on the device, after a
 *   one-time ~138 MB download. Used when there's no internet, when the
 *   browser has no speech recognition, or when "Offline" is chosen.
 */

export type VoiceLang = 'ml' | 'en'
export type VoiceEngine = 'online' | 'offline'
export type VoiceStatus = 'idle' | 'starting' | 'listening' | 'need-model' | 'downloading' | 'error'

interface SR {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

const SRClass = (): (new () => SR) | undefined =>
  (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR })
    .SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition

function pref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback
  } catch {
    return fallback
  }
}
function savePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* storage unavailable */
  }
}

export function useVoiceTyping(onFinal: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [engine, setEngine] = useState<VoiceEngine>('online')
  const [lang, setLangState] = useState<VoiceLang>(() => pref<VoiceLang>('reel.voice.lang', 'ml'))
  const [offlineOnly, setOfflineOnlyState] = useState(() => pref<string>('reel.voice.offline', '0') === '1')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [modelReady, setModelReady] = useState(false)
  // Why the offline model is being asked for (shown in the prompt).
  const [needReason, setNeedReason] = useState<'offline' | 'unsupported' | 'chosen'>('offline')
  const [level, setLevel] = useState(0)

  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onFinalRef.current = onFinal
  })
  const rec = useRef<SR | null>(null)
  const off = useRef<OfflineSession | null>(null)
  const wanted = useRef(false) // user still wants to listen (online recogniser auto-restarts)
  const abortDl = useRef<AbortController | null>(null)

  useEffect(() => {
    isModelDownloaded().then(setModelReady)
  }, [])

  const onlineSupported = typeof window !== 'undefined' && !!SRClass()

  const stopAll = useCallback(async () => {
    wanted.current = false
    if (rec.current) {
      const r = rec.current
      rec.current = null
      r.onend = null
      try {
        r.stop()
      } catch {
        /* already stopped */
      }
    }
    if (off.current) {
      const s = off.current
      off.current = null
      await s.stop()
    }
    setInterim('')
    setLevel(0)
  }, [])

  const startOfflineEngine = useCallback(async (l: VoiceLang) => {
    if (l === 'en') {
      setError('Offline voice typing is Malayalam only. Connect to the internet for English.')
      setStatus('error')
      return
    }
    if (!(await isModelDownloaded())) {
      setModelReady(false)
      setStatus('need-model')
      return
    }
    setEngine('offline')
    setStatus('starting')
    try {
      const { startOffline } = await import('../utils/asr/offline')
      off.current = await startOffline({
        onInterim: setInterim,
        onFinal: (t) => onFinalRef.current(t),
        onLevel: (r) => setLevel(Math.min(1, r * 12)),
      })
      wanted.current = true
      setStatus('listening')
    } catch (err) {
      off.current = null
      setError(micError(err))
      setStatus('error')
    }
  }, [])

  const startOnlineEngine = useCallback((l: VoiceLang) => {
    const C = SRClass()!
    const r = new C()
    r.lang = l === 'ml' ? 'ml-IN' : 'en-IN'
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    r.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const text = res[0]?.transcript ?? ''
        if (res.isFinal) {
          const t = text.trim()
          if (t) onFinalRef.current(t)
        } else live += text
      }
      setInterim(live.trim())
    }
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'network' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') {
        setNeedReason(e.error === 'network' ? 'offline' : 'unsupported')
        // Can't reach the online recogniser: fall back to the on-device model.
        rec.current = null
        r.onend = null
        setInterim('')
        void startOfflineEngine(l)
        return
      }
      wanted.current = false
      setError(e.error === 'not-allowed' ? 'Microphone access is blocked. Allow it in the browser to use voice typing.' : `Voice typing stopped (${e.error}).`)
      setStatus('error')
    }
    r.onend = () => {
      // Chrome ends after a pause; keep listening until the user stops.
      if (wanted.current && rec.current === r) {
        try {
          r.start()
        } catch {
          /* will retry on next end */
        }
      }
    }
    rec.current = r
    wanted.current = true
    setEngine('online')
    setStatus('listening')
    try {
      r.start()
    } catch (err) {
      setError(micError(err))
      setStatus('error')
    }
  }, [startOfflineEngine])

  const start = useCallback(
    async (o?: { lang?: VoiceLang; offline?: boolean }) => {
      const l = o?.lang ?? lang
      const offOnly = o?.offline ?? offlineOnly
      setError(null)
      setInterim('')
      const online = navigator.onLine && onlineSupported && (!offOnly || l === 'en')
      setNeedReason(!navigator.onLine ? 'offline' : !onlineSupported ? 'unsupported' : 'chosen')
      if (online) startOnlineEngine(l)
      else await startOfflineEngine(l)
    },
    [lang, offlineOnly, onlineSupported, startOnlineEngine, startOfflineEngine],
  )

  const stop = useCallback(async () => {
    await stopAll()
    setStatus('idle')
  }, [stopAll])

  const toggle = useCallback(() => {
    if (status === 'listening' || status === 'starting') void stop()
    else void start()
  }, [status, start, stop])

  const download = useCallback(async () => {
    if (!navigator.onLine) {
      setError(`Connect to the internet once to download the offline voice model (${MODEL_MB} MB).`)
      setStatus('need-model')
      return
    }
    setError(null)
    setProgress(0)
    setStatus('downloading')
    abortDl.current = new AbortController()
    try {
      await downloadModel(setProgress, abortDl.current.signal)
      // Load the engine now so its files are cached for offline use too.
      const { warmUp } = await import('../utils/asr/offline')
      await warmUp()
      setModelReady(true)
      setStatus('idle')
    } catch (err) {
      if ((err as Error).name === 'AbortError') setStatus('idle')
      else {
        setError((err as Error).message || 'Download failed.')
        setStatus('need-model')
      }
    } finally {
      abortDl.current = null
    }
  }, [])

  const cancelDownload = useCallback(() => abortDl.current?.abort(), [])

  const dismiss = useCallback(() => {
    setError(null)
    if (status !== 'listening' && status !== 'downloading') setStatus('idle')
  }, [status])

  const setLang = useCallback(
    async (l: VoiceLang) => {
      setLangState(l)
      savePref('reel.voice.lang', l)
      if (status === 'listening') {
        await stopAll()
        setStatus('idle')
      }
    },
    [status, stopAll],
  )

  const setOfflineOnly = useCallback(
    async (v: boolean) => {
      setOfflineOnlyState(v)
      savePref('reel.voice.offline', v ? '1' : '0')
      if (status === 'listening') {
        await stopAll()
        setStatus('idle')
      }
    },
    [status, stopAll],
  )

  useEffect(() => () => void stopAll(), [stopAll])

  return {
    status,
    engine,
    lang,
    setLang,
    offlineOnly,
    setOfflineOnly,
    interim,
    error,
    progress,
    modelReady,
    needReason,
    level,
    onlineSupported,
    start,
    stop,
    toggle,
    download,
    cancelDownload,
    dismiss,
  }
}

export type VoiceTyping = ReturnType<typeof useVoiceTyping>

function micError(err: unknown): string {
  const name = (err as { name?: string })?.name
  if (name === 'NotAllowedError') return 'Microphone access is blocked. Allow it in the browser to use voice typing.'
  if (name === 'NotFoundError') return 'No microphone found.'
  return (err as Error)?.message || 'Could not start the microphone.'
}
