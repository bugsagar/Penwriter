import { Inflate, deflateSync } from 'fflate'
import type { DocFontFamily, ElementType, MalayalamFont, Project, ScreenplayElement } from '../types'
import { isMalayalamFont } from './fonts'

/*
 * View-only share links, with no server.
 *
 * The whole script is compressed into the link's #fragment. Browsers never
 * send the fragment to any server (Vercel included), so the script travels
 * only inside the link: anyone who has the link can read it, nobody else.
 *
 * A link can also be locked with a 6-digit code: the script in the link is
 * encrypted (AES-GCM, key stretched from the code with PBKDF2), so the link
 * alone shows nothing. Six digits stop someone who merely sees the link; a
 * determined attacker with the link could still try every code offline, so
 * this is a lock on the door, not a vault.
 */

const TYPES: ElementType[] = ['SCENE_HEADING', 'ACTION', 'CHARACTER', 'DIALOGUE', 'PARENTHETICAL', 'TRANSITION', 'SHOT']

type Extras = Partial<Pick<ScreenplayElement, 'bold' | 'italic' | 'underline' | 'align' | 'color' | 'pageBreak'>>

interface Payload {
  v: 1
  t: string // title
  a: string // author
  f?: DocFontFamily
  s?: number // font size, pt
  m?: string // Malayalam font
  e: Array<[number, string] | [number, string, Extras]>
}

export interface SharedScript {
  title: string
  author: string
  fontFamily?: DocFontFamily
  fontSizePt?: number
  malayalamFont?: MalayalamFont
  elements: ScreenplayElement[]
}

/* ---------- bytes <-> base64url ---------- */
function toB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/* Raw deflate via fflate, so links open on every browser — including
   iPhones before iOS 16.4, which lack CompressionStream. The bytes are the
   same 'deflate-raw' format, so links made earlier still open. */
const deflate = (b: Uint8Array) => deflateSync(b, { level: 9 })

/** Links are opened from anywhere, so their size is capped before and after unpacking. */
const MAX_LINK_CHARS = 4_000_000
const MAX_SCRIPT_BYTES = 16_000_000

function inflate(b: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = []
  let total = 0
  const inf = new Inflate((chunk) => {
    total += chunk.length
    if (total > MAX_SCRIPT_BYTES) throw new Error('This share link is too large to open.')
    chunks.push(chunk)
  })
  inf.push(b, true)
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

const ALIGNS = new Set(['left', 'center', 'right', 'justify'])

/** Only known formatting, with the right types, from an untrusted link. */
function cleanExtras(x: unknown): Extras {
  if (!x || typeof x !== 'object') return {}
  const v = x as Record<string, unknown>
  const out: Extras = {}
  if (typeof v.bold === 'boolean') out.bold = v.bold
  if (v.italic === true) out.italic = true
  if (v.underline === true) out.underline = true
  if (v.pageBreak === true) out.pageBreak = true
  if (typeof v.align === 'string' && ALIGNS.has(v.align)) out.align = v.align as Extras['align']
  if (typeof v.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.color)) out.color = v.color
  return out
}

/** Locked links need Web Crypto, which browsers only offer on https pages. */
function cryptoOrThrow(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Code-protected links need a secure (https) page. Open Ezuth from its https address and try again.')
  }
  return crypto.subtle
}

/* ---------- encode / decode ---------- */
export class NeedsCodeError extends Error {
  constructor() {
    super('This script is protected with a code.')
  }
}
export class WrongCodeError extends Error {
  constructor() {
    super("That code isn't right.")
  }
}

const PBKDF2_ROUNDS = 400_000 // ~0.3–1 s per try in a browser: fine for a reader, slows guessing

async function keyFor(code: string, salt: Uint8Array, use: KeyUsage): Promise<CryptoKey> {
  const subtle = cryptoOrThrow()
  const base = await subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    [use],
  )
}

/** A random 6-digit code, e.g. "048213". */
export function randomCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return String(n).padStart(6, '0')
}

export function isProtected(code: string): boolean {
  return code[0] === 'p'
}

export async function encodeShare(p: Project, lockCode?: string): Promise<string> {
  const payload: Payload = {
    v: 1,
    t: p.title,
    a: p.author,
    f: p.settings?.fontFamily,
    s: p.settings?.fontSizePt,
    m: p.settings?.malayalamFont,
    e: p.elements.map((el) => {
      const x: Extras = {}
      if (el.bold !== undefined) x.bold = el.bold
      if (el.italic) x.italic = true
      if (el.underline) x.underline = true
      if (el.align) x.align = el.align
      if (el.color) x.color = el.color
      if (el.pageBreak) x.pageBreak = true
      const t = Math.max(0, TYPES.indexOf(el.type))
      return Object.keys(x).length ? [t, el.text, x] : [t, el.text]
    }),
  }
  const json = new TextEncoder().encode(JSON.stringify(payload))
  // 'z' = deflate-compressed ('j' = plain, read for older links)
  const kind = 'z'
  const body = deflate(json)
  if (!lockCode) return `${kind}${toB64url(body)}`

  // 'p' = locked: salt(16) · iv(12) · AES-GCM( kind byte · body )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new Uint8Array(body.length + 1)
  plain[0] = kind.charCodeAt(0)
  plain.set(body, 1)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(lockCode, salt, 'encrypt'), plain))
  const out = new Uint8Array(16 + 12 + ct.length)
  out.set(salt, 0)
  out.set(iv, 16)
  out.set(ct, 28)
  return `p${toB64url(out)}`
}

export async function decodeShare(code: string, lockCode?: string): Promise<SharedScript> {
  if (code.length > MAX_LINK_CHARS) throw new Error('This share link is too large to open.')
  let kind = code[0]
  let bytes = fromB64url(code.slice(1))
  if (kind === 'p') {
    if (!lockCode) throw new NeedsCodeError()
    const salt = bytes.subarray(0, 16)
    const iv = bytes.subarray(16, 28)
    let plain: Uint8Array
    try {
      plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await keyFor(lockCode, salt, 'decrypt'), bytes.subarray(28) as BufferSource))
    } catch {
      throw new WrongCodeError()
    }
    kind = String.fromCharCode(plain[0])
    bytes = plain.subarray(1)
  }
  if (kind === 'z') bytes = inflate(bytes)
  else if (kind !== 'j') throw new Error('This share link is not an Ezuth link.')
  const p = JSON.parse(new TextDecoder().decode(bytes)) as Payload
  if (p.v !== 1 || !Array.isArray(p.e)) throw new Error('This share link is damaged or from a newer Ezuth.')
  return {
    title: String(p.t ?? ''),
    author: String(p.a ?? ''),
    fontFamily: typeof p.f === 'string' ? p.f : undefined,
    fontSizePt: typeof p.s === 'number' ? p.s : undefined,
    malayalamFont: isMalayalamFont(p.m) ? p.m : undefined,
    elements: p.e.map((row, i) => {
      const [t, text, x] = Array.isArray(row) ? row : []
      return {
        ...cleanExtras(x),
        id: `s${i}`,
        type: (typeof t === 'number' && TYPES[t]) || 'ACTION',
        text: String(text ?? ''),
      }
    }),
  }
}

/** The share code in the current address, if this is a share link. */
export function shareCodeFromLocation(): string | null {
  const m = location.hash.match(/^#share=([^&]+)/)
  return m ? m[1] : null
}

export async function createShareLink(p: Project, lockCode?: string): Promise<string> {
  return `${location.origin}/#share=${await encodeShare(p, lockCode)}`
}

/** The clean link for a share code (no "just opened" flags). */
export function linkFor(code: string): string {
  return `${location.origin}/#share=${code}`
}

/*
 * The writer opening their own locked link shouldn't have to type the code:
 * it's handed to the new tab through this browser's storage, once.
 */
const UNLOCK_KEY = 'reel.share.unlock'
export function rememberUnlock(code: string, lockCode: string) {
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify({ tail: code.slice(-24), lockCode, at: Date.now() }))
  } catch {
    /* storage unavailable */
  }
}
export function takeUnlock(code: string): string | null {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { tail: string; lockCode: string; at: number }
    if (v.tail !== code.slice(-24) || Date.now() - v.at > 120_000) return null
    localStorage.removeItem(UNLOCK_KEY)
    return v.lockCode
  } catch {
    return null
  }
}
