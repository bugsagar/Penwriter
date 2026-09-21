import { useApp } from './store/useApp'
import { useAutosave, useTheme } from './hooks/useAutosave'
import { Home } from './components/Home'
import { Dashboard } from './components/Dashboard'
import { Editor } from './components/editor/Editor'

export default function App() {
  useAutosave()
  useTheme()
  const view = useApp((s) => s.view)

  return (
    <div className="h-full">
      {view === 'editor' ? <Editor /> : view === 'dashboard' ? <Dashboard /> : <Home />}
    </div>
  )
}
