import { useEffect, useMemo, useState } from 'react'
import {
  Bold,
  Copy,
  Eraser,
  Italic,
  Minus,
  PanelRightClose,
  Plus,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Trash2,
  Type,
  Underline,
  X,
  Check as CheckIcon,
} from 'lucide-react'
import { useApp } from '../../store/useApp'
import type { ElementType, Project, ScreenplayElement, TextAlign } from '../../types'
import { ELEMENT_LABELS, normalizeCharacterName } from '../../utils/detect'
import { countWords, pageCount } from '../../utils/layout'
import { deriveScenes, headingForScene } from '../../utils/scenes'
import { DOC_FONTS, FONT_SIZE_MAX, FONT_SIZE_MIN } from '../../utils/fonts'
import { uid } from '../../utils/id'
import { detectCharacters } from './CharacterList'
import { IconButton, cn } from '../ui'

export type Focus =
  | { kind: 'element'; id: string }
  | { kind: 'scene'; id: string }
  | { kind: 'character'; id: string }
  | { kind: 'project' }

const ALL_TYPES: ElementType[] = [
  'SCENE_HEADING',
  'ACTION',
  'CHARACTER',
  'DIALOGUE',
  'PARENTHETICAL',
  'TRANSITION',
  'SHOT',
]

/** Element types that render bold by default in the editor. */
const DEFAULT_BOLD: Partial<Record<ElementType, boolean>> = {
  SCENE_HEADING: true,
}

const ALIGNS: { id: TextAlign; title: string; Icon: typeof TextAlignStart }[] = [
  { id: 'left', title: 'Align left', Icon: TextAlignStart },
  { id: 'center', title: 'Align center', Icon: TextAlignCenter },
  { id: 'right', title: 'Align right', Icon: TextAlignEnd },
  { id: 'justify', title: 'Justify', Icon: TextAlignJustify },
]

const TEXT_COLORS: { label: string; value: string | undefined }[] = [
  { label: 'Auto', value: undefined },
  { label: 'Red', value: '#b91c1c' },
  { label: 'Blue', value: '#1d4ed8' },
  { label: 'Green', value: '#047857' },
  { label: 'Amber', value: '#b45309' },
  { label: 'Purple', value: '#7c3aed' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-wider text-ink-400 dark:text-ink-500">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brass-400 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-50'

const segBtn =
  'flex h-8 flex-1 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-30'

function segActive(on: boolean) {
  return on
    ? 'bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900'
    : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100'
}

function FormatPanel({
  project,
  element,
  sceneLabel,
  showProject,
  onAddPage,
}: {
  project: Project
  element: ScreenplayElement | null
  sceneLabel: string | null
  showProject: boolean
  onAddPage: () => void
}) {
  const updateElement = useApp((s) => s.updateElement)
  const insertElements = useApp((s) => s.insertElements)
  const removeElement = useApp((s) => s.removeElement)
  const updateActive = useApp((s) => s.updateActive)
  const setProjectSettings = useApp((s) => s.setProjectSettings)

  const fontSize = project.settings.fontSizePt

  const boldOn = element ? (element.bold ?? DEFAULT_BOLD[element.type] ?? false) : false
  const hasStyle = !!element && (
    element.bold !== undefined ||
    element.italic !== undefined ||
    element.underline !== undefined ||
    element.align !== undefined ||
    element.color !== undefined
  )

  const set = (patch: Partial<ScreenplayElement>) => {
    if (element) updateElement(element.id, patch)
  }

  const wordCount =
    element && element.text.trim() ? element.text.trim().split(/\s+/).length : 0

  return (
    <div className="space-y-5 px-3.5 py-3">
      {/* ---------- Page ---------- */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={onAddPage}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-200/80 bg-white px-3 py-2 text-[12.5px] font-medium text-ink-500 transition-colors hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
        >
          <Plus size={14} />
          Add new page
        </button>
      </section>

      {/* ---------- Block ---------- */}
      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">Block</h3>
        {element ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-ink-400 dark:text-ink-500">
                {ELEMENT_LABELS[element.type]} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </p>
              <div className="flex items-center gap-1">
                <IconButton
                  title="Duplicate block"
                  onClick={() => {
                    insertElements(
                      project.elements.findIndex((el) => el.id === element.id) + 1,
                      [{ ...element, id: uid('el') }],
                    )
                  }}
                  className="h-6 w-6"
                >
                  <Copy size={13} />
                </IconButton>
                <IconButton
                  title="Delete block"
                  onClick={() => removeElement(element.id)}
                  className="h-6 w-6"
                >
                  <Trash2 size={13} className="text-ink-400 dark:text-ink-500" />
                </IconButton>
              </div>
            </div>
            <Field label="Element type">
              <div className="flex items-center gap-2">
                <Type size={14} className="shrink-0 text-ink-400" />
                <select
                  className={inputCls}
                  value={element.type}
                  onChange={(e) => set({ type: e.target.value as ElementType })}
                >
                  {ALL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ELEMENT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            {sceneLabel && (
              <div className="rounded-lg bg-ink-100 px-3 py-2 dark:bg-ink-800">
                <div className="line-clamp-2 text-[12px] text-ink-700 dark:text-ink-300">
                  {sceneLabel}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-[12px] leading-relaxed text-ink-400 dark:bg-ink-800 dark:text-ink-500">
            Select a block in the script to change its type and style.
          </p>
        )}
      </section>

      {/* ---------- Text ---------- */}
      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">Text</h3>
        <Field label="Style">
          <div className="flex overflow-hidden rounded-lg border border-ink-200 dark:border-ink-700">
            <button
              type="button"
              title="Bold"
              disabled={!element}
              onClick={() => set({ bold: !boldOn })}
              className={cn(segBtn, segActive(boldOn))}
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              title="Italic"
              disabled={!element}
              onClick={() => element && set({ italic: !element.italic })}
              className={cn(
                segBtn,
                'border-l border-ink-200 dark:border-ink-700',
                segActive(!!element?.italic),
              )}
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              title="Underline"
              disabled={!element}
              onClick={() => element && set({ underline: !element.underline })}
              className={cn(
                segBtn,
                'border-l border-ink-200 dark:border-ink-700',
                segActive(!!element?.underline),
              )}
            >
              <Underline size={14} />
            </button>
          </div>
        </Field>
        <Field label="Alignment">
          <div className="flex overflow-hidden rounded-lg border border-ink-200 dark:border-ink-700">
            {ALIGNS.map(({ id, title, Icon }, i) => (
              <button
                key={id}
                type="button"
                title={title}
                disabled={!element}
                onClick={() =>
                  element && set({ align: element.align === id ? undefined : id })
                }
                className={cn(
                  segBtn,
                  i > 0 && 'border-l border-ink-200 dark:border-ink-700',
                  segActive(element?.align === id),
                )}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Color">
          <div className="flex items-center gap-1.5">
            {TEXT_COLORS.map(({ label, value }) => {
              const active = (element?.color ?? undefined) === value
              return (
                <button
                  key={label}
                  type="button"
                  title={label}
                  disabled={!element}
                  onClick={() => set({ color: value })}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-30',
                    active
                      ? 'border-ink-900 ring-2 ring-ink-900/20 dark:border-ink-50 dark:ring-ink-50/20'
                      : 'border-ink-200 hover:border-ink-400 dark:border-ink-700',
                  )}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ background: value ?? '#1a1a1a' }}
                  />
                </button>
              )
            })}
          </div>
        </Field>
        {hasStyle && (
          <button
            type="button"
            onClick={() =>
              set({ bold: undefined, italic: undefined, underline: undefined, align: undefined, color: undefined })
            }
            className="flex items-center gap-1.5 text-[12px] font-medium text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
          >
            <Eraser size={13} />
            Clear block style
          </button>
        )}
      </section>

      {/* ---------- Document ---------- */}
      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">Document</h3>
        <Field label="Font">
          <select
            className={inputCls}
            value={project.settings.fontFamily}
            onChange={(e) =>
              setProjectSettings({ fontFamily: e.target.value as Project['settings']['fontFamily'] })
            }
          >
            {DOC_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Font size">
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Decrease font size"
              disabled={fontSize <= FONT_SIZE_MIN}
              onClick={() => setProjectSettings({ fontSizePt: fontSize - 1 })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-600 transition-colors hover:bg-ink-50 disabled:opacity-30 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <Minus size={14} />
            </button>
            <span className="min-w-0 flex-1 text-center text-[13px] tabular-nums text-ink-800 dark:text-ink-100">
              {fontSize} pt
            </span>
            <button
              type="button"
              title="Increase font size"
              disabled={fontSize >= FONT_SIZE_MAX}
              onClick={() => setProjectSettings({ fontSizePt: fontSize + 1 })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-600 transition-colors hover:bg-ink-50 disabled:opacity-30 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <Plus size={14} />
            </button>
          </div>
        </Field>
        {fontSize !== 12 && (
          <p className="text-[11px] leading-relaxed text-ink-400 dark:text-ink-500">
            Page guides assume 12 pt — counts are approximate at {fontSize} pt.
          </p>
        )}
      </section>

      {/* ---------- Project ---------- */}
      {showProject && (
        <section className="space-y-3 border-t border-ink-100 pt-4 dark:border-ink-800">
          <h3 className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">Project</h3>
          <Field label="Title">
            <input
              className={inputCls}
              value={project.title}
              onChange={(e) => updateActive({ title: e.target.value })}
            />
          </Field>
          <Field label="Author">
            <input
              className={inputCls}
              value={project.author}
              onChange={(e) => updateActive({ author: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={3}
              className={inputCls}
              value={project.description}
              onChange={(e) => updateActive({ description: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              className={inputCls}
              value={project.type}
              onChange={(e) =>
                updateActive({ type: e.target.value as Project['type'] })
              }
            >
              <option value="feature">Feature Screenplay</option>
              <option value="short">Short Film</option>
              <option value="tv">TV Episode</option>
            </select>
          </Field>
        </section>
      )}
    </div>
  )
}

export function Inspector({
  project,
  focus,
  onFocus,
  onJumpToScene,
  onCollapse,
  tab = 'format',
  onTab,
  notesPanel,
  openNotes = 0,
}: {
  project: Project
  focus: Focus
  onFocus: (f: Focus) => void
  onJumpToScene: (id: string) => void
  onCollapse: () => void
  /** Right panel tab: formatting, or the page notes. */
  tab?: 'format' | 'notes'
  onTab?: (t: 'format' | 'notes') => void
  notesPanel?: React.ReactNode
  /** open (unticked) notes on the page in view, for the tab badge */
  openNotes?: number
}) {
  const updateElement = useApp((s) => s.updateElement)
  const insertElements = useApp((s) => s.insertElements)
  const setSceneNote = useApp((s) => s.setSceneNote)
  const updateCharacter = useApp((s) => s.updateCharacter)
  const removeCharacter = useApp((s) => s.removeCharacter)

  const addPage = () => {
    const heading = { id: uid('el'), type: 'SCENE_HEADING' as const, text: '', pageBreak: true }
    insertElements(project.elements.length, [heading])
    // Wait a frame so the new block is rendered before scrolling to it.
    // Focus is left untouched so the right panel stays on Format.
    requestAnimationFrame(() => {
      onJumpToScene(heading.id)
    })
  }

  const scenes = useMemo(() => deriveScenes(project), [project])
  const characters = useMemo(() => detectCharacters(project), [project])

  const [noteDraft, setNoteDraft] = useState('')
  const [charNotesDraft, setCharNotesDraft] = useState('')
  const [confirmCharRemove, setConfirmCharRemove] = useState(false)

  useEffect(() => {
    if (focus.kind === 'scene') {
      setNoteDraft(project.sceneNotes[focus.id] ?? '')
    }
    if (focus.kind === 'character') {
      const c = characters.find((c) => c.id === focus.id)
      setCharNotesDraft(c?.notes ?? '')
    }
  }, [focus, project.sceneNotes, characters])

  const element =
    focus.kind === 'element'
      ? project.elements.find((el) => el.id === focus.id) ?? null
      : null

  const sceneForElement = useMemo(() => {
    if (!element) return null
    for (const s of scenes) {
      if (s.headingElementId === element.id || s.elementIds.includes(element.id)) {
        return s
      }
    }
    return null
  }, [element, scenes])

  const activeScene =
    focus.kind === 'scene' ? scenes.find((s) => s.id === focus.id) ?? null : sceneForElement

  const activeCharacter =
    focus.kind === 'character' ? characters.find((c) => c.id === focus.id) ?? null : null

  const stats = useMemo(
    () => ({ pages: pageCount(project.elements), words: countWords(project.elements) }),
    [project.elements],
  )

  const renderScene = () => {
    if (!activeScene) return null
    return (
      <div className="space-y-3 px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">
              Scene {activeScene.number}
            </h3>
            <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-400 dark:text-ink-500">
              {headingForScene(activeScene)}
            </p>
          </div>
          <IconButton
            title="Clear selection"
            onClick={() => onFocus({ kind: 'project' })}
            className="h-6 w-6"
          >
            <X size={13} />
          </IconButton>
        </div>
        <Field label="Slug line">
          <input
            className={inputCls}
            value={activeScene.heading}
            onChange={(e) =>
              updateElement(activeScene.headingElementId, { text: e.target.value })
            }
          />
        </Field>
        <Field label="Note">
          <textarea
            rows={5}
            placeholder="e.g. John should reveal the secret here."
            className={inputCls}
            value={noteDraft}
            onChange={(e) => {
              setNoteDraft(e.target.value)
              setSceneNote(activeScene.id, e.target.value)
            }}
          />
        </Field>
        <p className="text-[11px] text-ink-400 dark:text-ink-500">
          Notes stay in the app and never appear in the exported PDF.
        </p>
      </div>
    )
  }

  const renderCharacter = () => {
    if (!activeCharacter) return null
    return (
      <div className="space-y-3 px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">
            {activeCharacter.name}
            {activeCharacter.manual && (
              <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                manual
              </span>
            )}
          </h3>
          {confirmCharRemove ? (
            <div className="flex items-center gap-1">
              <span className="text-[11.5px] text-red-500">Remove?</span>
              <button
                onClick={() => {
                  removeCharacter(activeCharacter.id)
                  setConfirmCharRemove(false)
                  onFocus({ kind: 'project' })
                }}
                className="rounded px-1 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400"
              >
                <CheckIcon size={14} />
              </button>
              <button
                onClick={() => setConfirmCharRemove(false)}
                className="rounded px-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <IconButton
              title="Remove character"
              onClick={() => setConfirmCharRemove(true)}
              className="h-6 w-6"
            >
              <Trash2 size={13} className="text-ink-400 dark:text-ink-500" />
            </IconButton>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Scenes" value={String(activeCharacter.scenes)} />
          <Stat label="Lines" value={String(activeCharacter.dialogues)} />
          <Stat label="First in" value={activeCharacter.firstAppearance ? `Sc ${activeCharacter.firstAppearance}` : '—'} />
        </div>

        <Field label="Name">
          <input
            className={inputCls}
            value={activeCharacter.name}
            onChange={(e) => {
              const clean = normalizeCharacterName(e.target.value)
              if (clean) updateCharacter(activeCharacter.id, { name: e.target.value })
            }}
          />
        </Field>

        <Field label="Notes">
          <textarea
            rows={5}
            placeholder="Notes about this character…"
            className={inputCls}
            value={charNotesDraft}
            onChange={(e) => {
              setCharNotesDraft(e.target.value)
              updateCharacter(activeCharacter.id, { notes: e.target.value })
            }}
          />
        </Field>
      </div>
    )
  }

  const title =
    tab === 'notes' && notesPanel
      ? 'Page notes'
      : focus.kind === 'scene' && activeScene
      ? `Scene ${activeScene.number}`
      : focus.kind === 'character' && activeCharacter
        ? activeCharacter.name
        : 'Format'

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col overflow-hidden rounded-xl border border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900">
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-3.5 py-2.5 dark:border-ink-800">
        <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500">
          {title}
        </span>
        <IconButton title="Collapse panel" onClick={onCollapse} className="h-6 w-6 shrink-0">
          <PanelRightClose size={14} />
        </IconButton>
      </div>
      {notesPanel && (
        <div className="flex gap-1 border-b border-ink-100 px-2.5 py-1.5 dark:border-ink-800">
          {(['format', 'notes'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTab?.(t)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12.5px] font-medium transition-colors',
                tab === t
                  ? 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-50'
                  : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100',
              )}
            >
              {t === 'format' ? 'Format' : 'Notes'}
              {t === 'notes' && openNotes > 0 && (
                <span className="rounded-full bg-[#f3c74f] px-1.5 text-[10.5px] font-semibold leading-[16px] text-[#4a3a0a]">
                  {openNotes}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'notes' && notesPanel ? (
          notesPanel
        ) : focus.kind === 'scene' && activeScene ? (
          renderScene()
        ) : focus.kind === 'character' && activeCharacter ? (
          renderCharacter()
        ) : (
          <FormatPanel
            project={project}
            element={element}
            sceneLabel={
              activeScene
                ? `Scene ${activeScene.number} — ${headingForScene(activeScene)}`
                : null
            }
            showProject={focus.kind === 'project'}
            onAddPage={addPage}
          />
        )}
        {focus.kind === 'project' && tab !== 'notes' && (
          <p className="px-3.5 pb-3 text-[11px] text-ink-400 dark:text-ink-500">
            {stats.pages} pages · {stats.words.toLocaleString()} words · ~{Math.round(stats.pages)} min
          </p>
        )}
      </div>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50 px-2 py-2 text-center dark:border-ink-800 dark:bg-ink-950">
      <div className="text-[14px] font-semibold tabular-nums text-ink-900 dark:text-ink-50">
        {value}
      </div>
      <div className="text-[9.5px] font-medium uppercase tracking-wider text-ink-400 dark:text-ink-500">
        {label}
      </div>
    </div>
  )
}
