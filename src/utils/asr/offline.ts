/**
 * Offline Malayalam dictation: microphone → pause-split segments → model in a
 * worker. While you speak, the growing segment is re-decoded about once a
 * second for live text; when you pause, the segment is decoded once more and
 * committed.
 */
import { SAMPLE_RATE } from './features'

/* ---------- worker client ---------- */
let worker: Worker | null = null
let ready: Promise<void> | null = null
let seq = 0
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./asr.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e) => {
    const m = e.data
    if (m.type === 'result') {
      pending.get(m.id)?.resolve(m.text)
      pending.delete(m.id)
    } else if (m.type === 'error' && m.id !== undefined) {
      pending.get(m.id)?.reject(new Error(m.message))
      pending.delete(m.id)
    }
  }
  return worker
}

/** Load the model (from the cache) into the worker. */
export function warmUp(): Promise<void> {
  if (ready) return ready
  const w = getWorker()
  ready = new Promise<void>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data.type === 'ready') {
        w.removeEventListener('message', onMsg)
        resolve()
      } else if (e.data.type === 'error' && e.data.id === undefined) {
        w.removeEventListener('message', onMsg)
        ready = null
        reject(new Error(e.data.message))
      }
    }
    w.addEventListener('message', onMsg)
    w.postMessage({ type: 'init' })
  })
  return ready
}

export function transcribe(samples: Float32Array): Promise<string> {
  const id = ++seq
  const w = getWorker()
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ type: 'decode', id, samples }, [samples.buffer])
  })
}

/* ---------- microphone capture ---------- */
const WORKLET = `
class PenRec extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; this.n = 0 }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) { this.buf.push(new Float32Array(ch)); this.n += ch.length
      if (this.n >= sampleRate / 10) { const out = new Float32Array(this.n); let o = 0
        for (const b of this.buf) { out.set(b, o); o += b.length }
        this.port.postMessage(out, [out.buffer]); this.buf = []; this.n = 0 } }
    return true
  }
}
registerProcessor('pen-rec', PenRec)
`

/** Linear resample to 16 kHz. */
function resample(input: Float32Array, from: number): Float32Array {
  if (from === SAMPLE_RATE) return input
  const ratio = from / SAMPLE_RATE
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio
    const j = Math.floor(x)
    const f = x - j
    out[i] = (input[j] ?? 0) * (1 - f) + (input[j + 1] ?? input[j] ?? 0) * f
  }
  return out
}

export interface OfflineSession {
  stop: () => Promise<void>
}

/**
 * Start listening. `onInterim` gets live text for the current phrase,
 * `onFinal` the committed text of each phrase.
 */
export async function startOffline(opts: {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onLevel?: (rms: number) => void
}): Promise<OfflineSession> {
  await warmUp()
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  const ctx = new AudioContext()
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
  await ctx.audioWorklet.addModule(url)
  URL.revokeObjectURL(url)
  const src = ctx.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(ctx, 'pen-rec')
  src.connect(node)

  const PRE_ROLL = 3 // chunks kept from before speech starts
  const END_SILENCE = 7 // chunks of quiet that end a phrase (~0.7 s)
  const MAX_CHUNKS = 150 // 15 s cap per phrase

  let noise = 0.004
  let pre: Float32Array[] = []
  let seg: Float32Array[] = []
  let quiet = 0
  let inSpeech = false
  let busy = false
  let lastPartial = 0
  let stopped = false
  let chain = Promise.resolve()

  const join = (parts: Float32Array[]) => {
    const n = parts.reduce((a, p) => a + p.length, 0)
    const out = new Float32Array(n)
    let o = 0
    for (const p of parts) {
      out.set(p, o)
      o += p.length
    }
    return out
  }

  const commit = (parts: Float32Array[]) => {
    const audio = join(parts)
    // finals run in order, after any partial in flight
    chain = chain.then(async () => {
      try {
        const text = await transcribe(audio)
        opts.onInterim('')
        if (text) opts.onFinal(text)
      } catch {
        opts.onInterim('')
      }
    })
  }

  const partial = () => {
    if (busy || seg.length < 6) return
    busy = true
    lastPartial = performance.now()
    transcribe(join(seg))
      .then((t) => {
        if (!stopped && inSpeech) opts.onInterim(t)
      })
      .catch(() => {})
      .finally(() => {
        busy = false
      })
  }

  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    if (stopped) return
    const chunk = resample(e.data, ctx.sampleRate)
    let sum = 0
    for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i]
    const rms = Math.sqrt(sum / Math.max(1, chunk.length))
    opts.onLevel?.(rms)
    const speaking = rms > Math.max(0.01, noise * 3)
    if (!inSpeech) noise = noise * 0.95 + rms * 0.05 // track the room's noise floor

    if (!inSpeech) {
      pre.push(chunk)
      if (pre.length > PRE_ROLL) pre.shift()
      if (speaking) {
        inSpeech = true
        seg = [...pre]
        pre = []
        quiet = 0
      }
      return
    }
    seg.push(chunk)
    quiet = speaking ? 0 : quiet + 1
    if (quiet >= END_SILENCE || seg.length >= MAX_CHUNKS) {
      inSpeech = false
      const done = seg
      seg = []
      commit(done)
    } else if (performance.now() - lastPartial > 900) {
      partial()
    }
  }

  return {
    stop: async () => {
      if (stopped) return
      stopped = true
      if (inSpeech && seg.length > 3) commit(seg)
      seg = []
      node.port.onmessage = null
      src.disconnect()
      node.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      await ctx.close().catch(() => {})
      await chain
    },
  }
}
