/**
 * The offline Malayalam speech model: AI4Bharat IndicConformer (120M, CTC,
 * INT8), as exported for sherpa-onnx by the community (MIT). Pinned to a
 * commit so the file never changes under us. Kept in Cache Storage so it
 * works offline after one download.
 */
const REPO = 'https://huggingface.co/csndhanasekar/sherpa-onnx-indicconformer-ml-int8/resolve/394e2c20b57eb0db12839ecff00f904a55ea9f47'

export const MODEL_URL = `${REPO}/model.int8.onnx`
export const TOKENS_URL = `${REPO}/tokens.txt`
export const MODEL_BYTES = 137_563_723
export const MODEL_MB = Math.round(MODEL_BYTES / 1_000_000)
export const ASR_CACHE = 'pen-asr-v1'

export async function isModelDownloaded(): Promise<boolean> {
  try {
    if (!('caches' in self)) return false
    const c = await caches.open(ASR_CACHE)
    const [m, t] = await Promise.all([c.match(MODEL_URL), c.match(TOKENS_URL)])
    return !!m && !!t
  } catch {
    return false
  }
}

/** Download model + tokens into the cache, reporting progress 0–1. */
export async function downloadModel(onProgress: (p: number) => void, signal?: AbortSignal): Promise<void> {
  const cache = await caches.open(ASR_CACHE)

  const tokens = await fetch(TOKENS_URL, { signal })
  if (!tokens.ok) throw new Error(`Could not download the model (${tokens.status}).`)

  const res = await fetch(MODEL_URL, { signal })
  if (!res.ok || !res.body) throw new Error(`Could not download the model (${res.status}).`)
  const total = Number(res.headers.get('content-length')) || MODEL_BYTES
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.byteLength
    onProgress(Math.min(1, got / total))
  }
  const blob = new Blob(chunks as BlobPart[], { type: 'application/octet-stream' })
  await cache.put(MODEL_URL, new Response(blob, { headers: { 'content-length': String(blob.size) } }))
  await cache.put(TOKENS_URL, tokens)
  try {
    await navigator.storage?.persist?.() // ask the browser not to evict it
  } catch {
    /* optional */
  }
}

export async function removeModel(): Promise<void> {
  try {
    await caches.delete(ASR_CACHE)
  } catch {
    /* nothing to remove */
  }
}
