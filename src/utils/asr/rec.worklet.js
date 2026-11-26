// Microphone capture for offline voice typing: hands the audio to the page in
// ~0.1 s chunks. A file of its own (not a blob: URL) so the site's
// Content-Security-Policy (script-src 'self') allows it.
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
