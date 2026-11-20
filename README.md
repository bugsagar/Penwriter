# Ezuth — Screenplay Studio

A professional, keyboard-first screenwriting app for the browser. Write
properly formatted screenplays with automatic element detection, manage
scenes and characters, and export to PDF — inspired by the workflow of
Celtx and Final Draft, without copying any of their branding or UI.

## Features

- **Projects dashboard** — create, search, duplicate and delete screenplays
- **New screenplay wizard** — title, author, description and type
  (Feature / Short Film / TV Episode)
- **Structured screenplay editor** — each paragraph is a typed element
  (`SCENE_HEADING`, `ACTION`, `CHARACTER`, `DIALOGUE`, `PARENTHETICAL`,
  `TRANSITION`, `SHOT`), stored as structured data, not one giant text blob
- **Automatic formatting**
  - Type `INT. HOUSE - NIGHT` → scene heading, live
  - Type an all-caps line then press Enter → character + dialogue
  - Tab opens the element-type menu; Enter follows screenplay conventions
- **Paper-true page** — US Letter, 1.5" / 1.0" margins, Courier Prime,
  dialogue at 4.0"–6.5", page break guides, live page/word/minute counts
- **Scene management** — sidebar list with numbers, rename, duplicate,
  delete, drag to reorder, click to jump
- **Characters** — auto-detected from dialogue with scenes/lines/first
  appearance stats, notes, manual creation
- **Notes** — attached to scenes; never exported
- **Search & replace** — with in-editor highlighting
- **Autosave** — local persistence (localStorage) with save status
  indicator; reopening the app restores your last project
- **Export** — PDF (title page + formatted screenplay), plain text, Fountain
- **Writing mode** — distraction-free, hides everything but the page
- **Light & dark mode**

## Tech

React · TypeScript · Vite · Tailwind CSS · Zustand · pdf-lib · lucide-react

The architecture keeps the screenplay as structured elements, so cloud sync,
collaboration, version history and AI features can be layered on later.

## Getting started

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck + production build
npm run lint       # oxlint
```

### Testing

```bash
npm run build
npm run preview &  # serve the production build
npm run test:e2e   # Playwright end-to-end suite (34 checks)
```

The e2e suite drives a real headless Chromium instance through creating a
screenplay, automatic formatting, keyboard workflow, scene/character
management, search & replace, writing mode, autosave, reload persistence and
both exports.

## Keyboard workflow

| Key | Action |
| --- | --- |
| `Enter` | Next element per screenplay rules (heading → action → dialogue) |
| `Tab` | Open element-type menu (`Tab` moves, `Enter` selects, `Esc` closes) |
| `⌘Z` / `⌘⇧Z` | Undo / redo |
| `⌘F` | Search & replace |
| `⌘S` | Save now |
| `⌘⇧F` | Writing mode |
| `Esc` | Close search / leave writing mode |

## Project structure

```
src/
├── components/         UI (dashboard, editor, dialogs, ui primitives)
│   └── editor/         ElementBlock, Paper, Sidebar, Inspector, TopBar…
├── export/             PDF (pdf-lib) + plain text / Fountain
├── hooks/              autosave, theme
├── store/              zustand store (projects, undo/redo, session)
├── utils/              detection, pagination, scenes, storage
└── types.ts            data model
```

## Credits

- **Typewriter canvas** — the desktop "Typewriter" canvas (paper fed over a
  platen roller, with a carriage scale and the typing line held at the print
  line) is inspired by [Platen](https://github.com/mskayyali/platenwriter), a
  thermal typewriter by [Saleh Kayyali](https://x.com/mskayyali), MIT licensed.
  Ezuth's version is redrawn in its own theme; no code from Platen is included.
