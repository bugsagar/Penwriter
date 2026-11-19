import type { DocFontFamily, ElementType, Project, ScreenplayElement } from '../types'

/*
 * View-only share links, with no server.
 *
 * The whole script is compressed into the link's #fragment. Browsers never
 * send the fragment to any server (Vercel included), so the script travels
 * only inside the link: anyone who has the link can read it, nobody else.
 */

const TYPES: ElementType[] = ['SCENE_HEADING', 'ACTION', 'CHARACTER', 'DIALOGUE', 'PARENTHETICAL', 'TRANSITION', 'SHOT']

type Extras = Partial<Pick<ScreenplayElement, 'bold' | 'italic' | 'underline' | 'align' | 'color' | 'pageBreak'>>

interface Payload {
  v: 1
  t: string // title
  a: string // author
  f?: DocFontFamily
  s?: number // font size, pt
  e: Array<[number, string] | [number, string, Extras]>
}

export interface SharedScript {
  title: string
  author: string
  fontFamily?: DocFontFamily
  fontSizePt?: number
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

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await res.arrayBuffer())
}

const canCompress = () => typeof CompressionStream !== 'undefined'

/* ---------- encode / decode ---------- */
export async function encodeShare(p: Project): Promise<string> {
  const payload: Payload = {
    v: 1,
    t: p.title,
    a: p.author,
    f: p.settings?.fontFamily,
    s: p.settings?.fontSizePt,
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
  // 'z' = deflate-compressed, 'j' = plain (very old browsers)
  return canCompress() ? `z${toB64url(await pipe(json, new CompressionStream('deflate-raw')))}` : `j${toB64url(json)}`
}

export async function decodeShare(code: string): Promise<SharedScript> {
  const kind = code[0]
  let bytes = fromB64url(code.slice(1))
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'))
  else if (kind !== 'j') throw new Error('This share link is not a Pen link.')
  const p = JSON.parse(new TextDecoder().decode(bytes)) as Payload
  if (p.v !== 1 || !Array.isArray(p.e)) throw new Error('This share link is damaged or from a newer Pen.')
  return {
    title: String(p.t ?? ''),
    author: String(p.a ?? ''),
    fontFamily: p.f,
    fontSizePt: typeof p.s === 'number' ? p.s : undefined,
    elements: p.e.map(([t, text, x], i) => ({
      id: `s${i}`,
      type: TYPES[t] ?? 'ACTION',
      text: String(text ?? ''),
      ...(x ?? {}),
    })),
  }
}

/** The share code in the current address, if this is a share link. */
export function shareCodeFromLocation(): string | null {
  const m = location.hash.match(/^#share=([^&]+)/)
  return m ? m[1] : null
}

export async function createShareLink(p: Project): Promise<string> {
  return `${location.origin}/#share=${await encodeShare(p)}`
}
