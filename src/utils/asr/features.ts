/**
 * NeMo-style log-mel features for IndicConformer (16 kHz, 80 mel bands):
 * pre-emphasis 0.97, 25 ms Hann window, 10 ms hop, 512-point FFT, Slaney mel
 * filterbank (0–8 kHz), log(mel + 2^-24), then per-band mean/std normalisation.
 */

export const SAMPLE_RATE = 16000
const N_FFT = 512
const WIN = 400
const HOP = 160
const N_MELS = 80
const LOG_GUARD = 2 ** -24

/* ---------- Slaney mel scale (as librosa) ---------- */
const F_SP = 200 / 3
const MIN_LOG_HZ = 1000
const MIN_LOG_MEL = MIN_LOG_HZ / F_SP
const LOG_STEP = Math.log(6.4) / 27

const hzToMel = (f: number) => (f < MIN_LOG_HZ ? f / F_SP : MIN_LOG_MEL + Math.log(f / MIN_LOG_HZ) / LOG_STEP)
const melToHz = (m: number) => (m < MIN_LOG_MEL ? m * F_SP : MIN_LOG_HZ * Math.exp(LOG_STEP * (m - MIN_LOG_MEL)))

let filters: Float32Array[] | null = null
function melFilters(): Float32Array[] {
  if (filters) return filters
  const bins = N_FFT / 2 + 1
  const fftFreqs = Array.from({ length: bins }, (_, k) => (k * SAMPLE_RATE) / N_FFT)
  const mMin = hzToMel(0)
  const mMax = hzToMel(SAMPLE_RATE / 2)
  const hz = Array.from({ length: N_MELS + 2 }, (_, i) => melToHz(mMin + ((mMax - mMin) * i) / (N_MELS + 1)))
  filters = []
  for (let i = 0; i < N_MELS; i++) {
    const w = new Float32Array(bins)
    const enorm = 2 / (hz[i + 2] - hz[i])
    for (let k = 0; k < bins; k++) {
      const lower = (fftFreqs[k] - hz[i]) / (hz[i + 1] - hz[i])
      const upper = (hz[i + 2] - fftFreqs[k]) / (hz[i + 2] - hz[i + 1])
      w[k] = Math.max(0, Math.min(lower, upper)) * enorm
    }
    filters.push(w)
  }
  return filters
}

/* ---------- window (symmetric Hann, centred in the FFT frame) ---------- */
let window_: Float32Array | null = null
function hann(): Float32Array {
  if (window_) return window_
  window_ = new Float32Array(N_FFT)
  const off = (N_FFT - WIN) / 2
  for (let n = 0; n < WIN; n++) window_[off + n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (WIN - 1))
  return window_
}

/* ---------- radix-2 FFT ---------- */
const rev = new Uint16Array(N_FFT)
{
  const bits = Math.log2(N_FFT)
  for (let i = 0; i < N_FFT; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
    rev[i] = r
  }
}
const cosT = new Float32Array(N_FFT / 2)
const sinT = new Float32Array(N_FFT / 2)
for (let i = 0; i < N_FFT / 2; i++) {
  cosT[i] = Math.cos((2 * Math.PI * i) / N_FFT)
  sinT[i] = -Math.sin((2 * Math.PI * i) / N_FFT)
}

function powerSpectrum(frame: Float32Array, re: Float32Array, im: Float32Array, out: Float32Array) {
  for (let i = 0; i < N_FFT; i++) {
    re[rev[i]] = frame[i]
    im[rev[i]] = 0
  }
  for (let size = 2; size <= N_FFT; size <<= 1) {
    const half = size >> 1
    const step = N_FFT / size
    for (let start = 0; start < N_FFT; start += size) {
      for (let j = 0; j < half; j++) {
        const t = j * step
        const a = start + j
        const b = a + half
        const tr = re[b] * cosT[t] - im[b] * sinT[t]
        const ti = re[b] * sinT[t] + im[b] * cosT[t]
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
  for (let k = 0; k <= N_FFT / 2; k++) out[k] = re[k] * re[k] + im[k] * im[k]
}

/** Returns features laid out [80, T] (row-major) and T. */
export function logMel(samples: Float32Array): { data: Float32Array; frames: number } {
  // pre-emphasis
  const x = new Float32Array(samples.length)
  x[0] = samples[0] ?? 0
  for (let i = 1; i < samples.length; i++) x[i] = samples[i] - 0.97 * samples[i - 1]

  // centre padding (reflect), like torch.stft(center=True)
  const pad = N_FFT / 2
  const padded = new Float32Array(x.length + 2 * pad)
  padded.set(x, pad)
  for (let i = 0; i < pad; i++) {
    padded[pad - 1 - i] = x[Math.min(i + 1, x.length - 1)] ?? 0
    padded[pad + x.length + i] = x[Math.max(x.length - 2 - i, 0)] ?? 0
  }

  const frames = 1 + Math.floor(x.length / HOP)
  const fb = melFilters()
  const win = hann()
  const frame = new Float32Array(N_FFT)
  const re = new Float32Array(N_FFT)
  const im = new Float32Array(N_FFT)
  const spec = new Float32Array(N_FFT / 2 + 1)
  const data = new Float32Array(N_MELS * frames)

  for (let t = 0; t < frames; t++) {
    const s = t * HOP
    for (let i = 0; i < N_FFT; i++) frame[i] = (padded[s + i] ?? 0) * win[i]
    powerSpectrum(frame, re, im, spec)
    for (let m = 0; m < N_MELS; m++) {
      const w = fb[m]
      let acc = 0
      for (let k = 0; k < spec.length; k++) acc += w[k] * spec[k]
      data[m * frames + t] = Math.log(acc + LOG_GUARD)
    }
  }

  // per-band normalisation
  for (let m = 0; m < N_MELS; m++) {
    const row = m * frames
    let mean = 0
    for (let t = 0; t < frames; t++) mean += data[row + t]
    mean /= frames
    let v = 0
    for (let t = 0; t < frames; t++) v += (data[row + t] - mean) ** 2
    const std = Math.sqrt(v / Math.max(1, frames - 1)) + 1e-5
    for (let t = 0; t < frames; t++) data[row + t] = (data[row + t] - mean) / std
  }
  return { data, frames }
}
