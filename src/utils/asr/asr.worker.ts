/// <reference lib="webworker" />
/**
 * Runs the offline Malayalam model off the main thread so typing and
 * scrolling never stutter while speech is decoded.
 */
import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { logMel } from './features'
import { ASR_CACHE, MODEL_URL, TOKENS_URL } from './model'

type In = { type: 'init' } | { type: 'decode'; id: number; samples: Float32Array }

let session: ort.InferenceSession | null = null
let tokens: string[] = []
let blank = 0

ort.env.wasm.wasmPaths = { wasm: wasmUrl }
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1

async function fromCache(url: string): Promise<Response> {
  const c = await caches.open(ASR_CACHE)
  const hit = await c.match(url)
  if (!hit) throw new Error('The offline voice model is not downloaded.')
  return hit
}

async function init() {
  if (session) return
  const tokText = await (await fromCache(TOKENS_URL)).text()
  tokens = []
  for (const line of tokText.split(/\r?\n/)) {
    const m = line.trim().match(/^(.+)\s+(\d+)$/)
    if (m) tokens[Number(m[2])] = m[1]
  }
  blank = tokens.indexOf('<blk>')
  if (blank < 0) blank = tokens.length - 1
  const model = new Uint8Array(await (await fromCache(MODEL_URL)).arrayBuffer())
  session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
}

async function decode(samples: Float32Array): Promise<string> {
  if (!session) await init()
  const s = session!
  if (samples.length < 1600) return ''
  const { data, frames } = logMel(samples)
  const feeds: Record<string, ort.Tensor> = {}
  feeds[s.inputNames[0]] = new ort.Tensor('float32', data, [1, 80, frames])
  if (s.inputNames[1]) feeds[s.inputNames[1]] = new ort.Tensor('int64', BigInt64Array.from([BigInt(frames)]), [1])
  const out = await s.run(feeds)
  const logits = out[s.outputNames[0]]
  const [, steps, vocab] = logits.dims as number[]
  const v = logits.data as Float32Array

  // greedy CTC: best token per step, merge repeats, drop blanks
  let text = ''
  let prev = -1
  for (let t = 0; t < steps; t++) {
    let best = 0
    let bestV = -Infinity
    const o = t * vocab
    for (let k = 0; k < vocab; k++) {
      if (v[o + k] > bestV) {
        bestV = v[o + k]
        best = k
      }
    }
    if (best !== prev && best !== blank) {
      const piece = tokens[best]
      if (piece && piece !== '<unk>') text += piece
    }
    prev = best
  }
  return text.replace(/▁/g, ' ').replace(/\s+/g, ' ').trim()
}

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data
  try {
    if (msg.type === 'init') {
      await init()
      self.postMessage({ type: 'ready' })
    } else if (msg.type === 'decode') {
      const text = await decode(msg.samples)
      self.postMessage({ type: 'result', id: msg.id, text })
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      id: msg.type === 'decode' ? msg.id : undefined,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
