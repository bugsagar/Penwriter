import type { Project, ScreenplayElement } from '../types'
import { uid } from './id'

function el(type: ScreenplayElement['type'], text: string): ScreenplayElement {
  return { id: uid('el'), type, text }
}

export function emptyProject(): Project {
  return {
    id: uid('proj'),
    title: 'Untitled Screenplay',
    author: '',
    description: '',
    type: 'short',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    elements: [el('SCENE_HEADING', '')],
    sceneNotes: {},
    characters: [],
    settings: {
      theme: 'light',
      showSceneNumbers: true,
      autoDetectElements: true,
      fontFamily: 'courier-prime',
      fontSizePt: 12,
    },
  }
}

/** A short demo screenplay seeded so the app never opens feeling empty. */
export function sampleProject(): Project {
  const p = emptyProject()
  p.title = 'The Last Train'
  p.author = 'You'
  p.description = 'A woman races across a closing city to catch a train that may not be coming.'
  p.type = 'short'
  p.elements = [
    el('SCENE_HEADING', 'EXT. TRAIN STATION - NIGHT'),
    el('ACTION', 'Rain slicks the empty platform. A lone clock overhead reads 11:47. MAYA stands at the edge, suitcase in hand, watching the wet tracks.'),
    el('ACTION', ''),
    el('SCENE_HEADING', 'INT. TRAIN STATION CONCOURSE - CONTINUOUS'),
    el('ACTION', 'Maya hurries through the half-lit hall. Announcements echo over the speakers, muffled and distant. She stops at a departures board. The last train is listed as DELAYED.'),
    el('CHARACTER', 'MAYA'),
    el('DIALOGUE', 'Where is everyone?'),
    el('ACTION', 'A STATION ATTENDANT watches her from behind a glass window. She approaches.'),
    el('CHARACTER', 'STATION ATTENDANT'),
    el('PARENTHETICAL', '(flatly)'),
    el('DIALOGUE', 'You came early.'),
    el('ACTION', ''),
    el('SCENE_HEADING', 'EXT. PLATFORM 4 - NIGHT'),
    el('ACTION', 'Headlights cut through the fog. A single train groans to a halt. Maya lets out a breath she didn\u2019t know she was holding.'),
    el('TRANSITION', 'FADE OUT.'),
  ]
  return p
}
