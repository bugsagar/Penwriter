import type { ElementType } from '../types'

export const ELEMENT_LABELS: Record<ElementType, string> = {
  SCENE_HEADING: 'Slug Line',
  ACTION: 'Action Block',
  CHARACTER: 'Character Name',
  DIALOGUE: 'Dialogue',
  PARENTHETICAL: 'Parenthetical',
  TRANSITION: 'Transition',
  SHOT: 'Shot',
}

/** Positioning hints shown in menus, mirroring classic screenplay layout. */
export const ELEMENT_HINTS: Record<ElementType, string> = {
  SCENE_HEADING: 'INT./EXT.',
  ACTION: 'full width',
  CHARACTER: 'cue',
  DIALOGUE: 'speech',
  PARENTHETICAL: '( … )',
  TRANSITION: 'right',
  SHOT: 'camera',
}

/** Elements available in the Tab cycle. */
export const TAB_CYCLE: ElementType[] = [
  'ACTION',
  'CHARACTER',
  'DIALOGUE',
  'PARENTHETICAL',
  'TRANSITION',
  'SHOT',
]

const SCENE_HEADING_RE =
  /^\s*(INT|EXT|INT\.EXT|INT\/EXT|EXT\/INT|EST|I\/E|I\.E)[./\s-]/i

const TRANSITION_RE =
  /^(FADE IN|FADE OUT|CUT TO|DISSOLVE TO|SMASH CUT TO|MATCH CUT TO|IRIS IN|IRIS OUT|FLASH CUT TO)[.\s:]*$/i

const TRANSITION_END_RE =
  /(CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:)$/i

const SHOT_RE =
  /^(CLOSE ON|CLOSE UP|EXTREME CLOSE UP|INSERT|POV|POINT OF VIEW|ANGLE ON|WIDE ON|ESTABLISHING|OVER THE SHOULDER|REVERSE|MEDIUM SHOT|LOW ANGLE|HIGH ANGLE|PUSH IN|PULL BACK|TRACKING|DOLLY)/i

const UPPER_RE = /^[A-Z0-9][A-Z0-9 .'&/-]{0,48}$/
const HAS_LETTER_RE = /[A-Z]/

export function isSceneHeading(text: string): boolean {
  return SCENE_HEADING_RE.test(text.trim())
}

export function isTransition(text: string): boolean {
  const t = text.trim()
  return TRANSITION_RE.test(t) || TRANSITION_END_RE.test(t)
}

export function isShot(text: string): boolean {
  const t = text.trim()
  if (!t || t.includes(' ') === false) return false
  return SHOT_RE.test(t)
}

/** Is this line an all-caps character name? */
export function isCharacterLine(text: string): boolean {
  const t = text.trim()
  if (t.length < 2 || t.length > 50) return false
  if (!HAS_LETTER_RE.test(t)) return false
  if (!UPPER_RE.test(t)) return false
  if (isSceneHeading(t)) return false
  if (isTransition(t)) return false
  if (/^THE END\.?$/i.test(t)) return false
  if (t.endsWith('.')) return false
  return true
}

export function normalizeCharacterName(raw: string): string {
  let name = raw.trim().replace(/\s*\(.*?\)\s*$/g, '').replace(/\.$/, '')
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
    .trim()
}

export function cycleType(current: ElementType, dir: 1 | -1): ElementType {
  const i = TAB_CYCLE.indexOf(current)
  if (i === -1) {
    return dir === 1 ? 'CHARACTER' : 'SHOT'
  }
  return TAB_CYCLE[(i + dir + TAB_CYCLE.length) % TAB_CYCLE.length]
}

/**
 * Decide what type the next element should be after pressing Enter.
 * The current element's text is passed so ACTION can be upgraded in place.
 */
export function nextTypeAfterEnter(current: ElementType, text: string): ElementType {
  switch (current) {
    case 'SCENE_HEADING':
      return 'ACTION'
    case 'CHARACTER':
      return 'DIALOGUE'
    case 'PARENTHETICAL':
      return 'DIALOGUE'
    case 'DIALOGUE':
      return text.trim() ? 'DIALOGUE' : 'ACTION'
    case 'TRANSITION':
      return 'ACTION'
    case 'SHOT':
      return 'ACTION'
    case 'ACTION':
    default: {
      const t = text.trim()
      if (isSceneHeading(t)) return 'SCENE_HEADING'
      if (isTransition(t)) return 'TRANSITION'
      if (isCharacterLine(t)) return 'CHARACTER'
      return 'ACTION'
    }
  }
}

/**
 * Live detection while typing. Returns a new type if the current text
 * strongly implies one, otherwise keeps the existing type.
 */
export function detectTypeWhileTyping(current: ElementType, text: string): ElementType {
  const t = text.trim()
  if (current === 'SCENE_HEADING') {
    return t ? 'SCENE_HEADING' : 'ACTION'
  }
  if (current === 'CHARACTER' && t && !isCharacterLine(t)) {
    return 'ACTION'
  }
  if (current === 'TRANSITION' && t && !isTransition(t)) {
    return 'ACTION'
  }
  if (t && isSceneHeading(t)) {
    return 'SCENE_HEADING'
  }
  if (current === 'ACTION' && t && isTransition(t)) {
    return 'TRANSITION'
  }
  return current
}
