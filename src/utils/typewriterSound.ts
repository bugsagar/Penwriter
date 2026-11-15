/**
 * Typewriter sounds, synthesised with Web Audio (no audio files):
 * key strikes, space bar, backspace, the end-of-line bell and carriage return.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0.55
      master.connect(ctx.destination)
      const len = Math.floor(ctx.sampleRate * 0.4)
      noise = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** A short filtered noise burst — the metallic "tick" of a typebar. */
function burst(c: AudioContext, t: number, freq: number, q: number, peak: number, decay: number) {
  const src = c.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = 0.9 + Math.random() * 0.2
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + 0.0015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  src.connect(bp).connect(g).connect(master!)
  src.start(t, Math.random() * 0.3)
  src.stop(t + decay + 0.02)
}

/** A falling sine — the body "thock" of the platen being struck. */
function thump(c: AudioContext, t: number, from: number, to: number, peak: number, decay: number) {
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + decay)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  o.connect(g).connect(master!)
  o.start(t)
  o.stop(t + decay + 0.02)
}

export function keyStrike() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const v = 0.85 + Math.random() * 0.3
  burst(c, t, 2200 + Math.random() * 1400, 1.1, 0.5 * v, 0.045)
  thump(c, t, 190 + Math.random() * 40, 85, 0.35 * v, 0.07)
  // the carriage escapement stepping one space
  burst(c, t + 0.028, 5200, 3, 0.08 * v, 0.02)
}

export function spaceBar() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  burst(c, t, 900, 0.8, 0.28, 0.06)
  thump(c, t, 120, 60, 0.3, 0.09)
  burst(c, t + 0.02, 5200, 3, 0.07, 0.02)
}

export function backspace() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  burst(c, t, 3000, 2, 0.16, 0.03)
  thump(c, t, 160, 100, 0.12, 0.04)
}

export function bell() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  for (const [f, a] of [
    [2093, 0.22],
    [3140, 0.08],
    [4186, 0.05],
  ] as const) {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(a, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
    o.connect(g).connect(master!)
    o.start(t)
    o.stop(t + 1.5)
  }
}

/** Ratchet of the line-space lever, the carriage sliding back, then the stop. */
export function carriageReturn() {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  for (let i = 0; i < 3; i++) burst(c, t + i * 0.035, 3800, 4, 0.12, 0.02)
  const src = c.createBufferSource()
  src.buffer = noise
  const lp = c.createBiquadFilter()
  lp.type = 'bandpass'
  lp.Q.value = 0.7
  lp.frequency.setValueAtTime(700, t + 0.1)
  lp.frequency.linearRampToValueAtTime(1600, t + 0.32)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t + 0.1)
  g.gain.linearRampToValueAtTime(0.12, t + 0.16)
  g.gain.linearRampToValueAtTime(0.0001, t + 0.34)
  src.connect(lp).connect(g).connect(master!)
  src.start(t + 0.1)
  src.stop(t + 0.36)
  thump(c, t + 0.34, 150, 70, 0.4, 0.1)
  burst(c, t + 0.34, 1500, 1, 0.3, 0.06)
}
