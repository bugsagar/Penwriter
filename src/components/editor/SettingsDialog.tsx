import { Maximize2 } from 'lucide-react'
import { useApp } from '../../store/useApp'
import { Modal, Button } from '../ui'

export function SettingsDialog({
  open,
  onClose,
  onEnterWritingMode,
}: {
  open: boolean
  onClose: () => void
  onEnterWritingMode: () => void
}) {
  const project = useApp((s) => s.projects.find((p) => p.id === s.activeProjectId))
  const setProjectSettings = useApp((s) => s.setProjectSettings)
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)

  const settings = project?.settings

  if (!project || !settings) return null

  const exportRow =
    'flex w-full items-center gap-2.5 rounded-lg border border-ink-200 px-3 py-2 text-left text-[13px] text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800'

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 text-[12px] font-semibold text-ink-800 dark:text-ink-100">Appearance</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                theme === 'light'
                  ? 'border-brass-400 bg-brass-300/15 text-ink-900 dark:bg-brass-300/10'
                  : 'border-ink-200 text-ink-500 hover:border-ink-300 dark:border-ink-700 dark:text-ink-400'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                theme === 'dark'
                  ? 'border-brass-400 bg-brass-300/15 text-ink-900 dark:bg-brass-300/10'
                  : 'border-ink-200 text-ink-500 hover:border-ink-300 dark:border-ink-700 dark:text-ink-400'
              }`}
            >
              Dark
            </button>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-400 dark:text-ink-500">
            The screenplay page stays paper-white in both modes.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-[12px] font-semibold text-ink-800 dark:text-ink-100">Screenplay</h3>
          <label className="flex items-center justify-between gap-4 text-[13px] text-ink-700 dark:text-ink-200">
            <span>
              Automatic element detection
              <p className="text-[11.5px] font-normal text-ink-400 dark:text-ink-500">
                INT./EXT. becomes a scene heading, capitals become characters.
              </p>
            </span>
            <input
              type="checkbox"
              checked={settings.autoDetectElements}
              onChange={(e) => setProjectSettings({ autoDetectElements: e.target.checked })}
              className="h-4 w-4 accent-[#b08d4f]"
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-[13px] text-ink-700 dark:text-ink-200">
            <span>
              Scene numbers
              <p className="text-[11.5px] font-normal text-ink-400 dark:text-ink-500">
                Show numbers in the scene sidebar.
              </p>
            </span>
            <input
              type="checkbox"
              checked={settings.showSceneNumbers}
              onChange={(e) => setProjectSettings({ showSceneNumbers: e.target.checked })}
              className="h-4 w-4 accent-[#b08d4f]"
            />
          </label>
        </div>

        <div className="space-y-2">
          <h3 className="text-[12px] font-semibold text-ink-800 dark:text-ink-100">Focus</h3>
          <button type="button" onClick={onEnterWritingMode} className={exportRow}>
            <Maximize2 size={14} className="text-ink-400" />
            <span className="flex-1">Writing mode</span>
            <span className="text-[11px] text-ink-400 dark:text-ink-500">⌘⇧F</span>
          </button>
        </div>

        <div className="rounded-lg bg-ink-50 p-3 text-[12px] leading-relaxed text-ink-500 dark:bg-ink-950 dark:text-ink-400">
          <p className="font-medium text-ink-700 dark:text-ink-200">Writing shortcuts</p>
          <p className="mt-1">
            <b>Enter</b> — new line · <b>Tab</b> — next block · <b>⌥Tab</b> — element menu · <b>⌘Z</b> / <b>⌘⇧Z</b> — undo / redo
            <br />
            <b>⌘F</b> — search &amp; replace · <b>⌘S</b> — save · <b>⌘⇧F</b> — writing mode · <b>Esc</b> — close
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
