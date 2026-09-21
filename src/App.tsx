import { useApp } from './store/useApp'
import { useAutosave, useTheme } from './hooks/useAutosave'
import { Home } from './components/Home'
import { Dashboard } from './components/Dashboard'
import { Editor } from './components/editor/Editor'
import { MobileNotice } from './components/MobileNotice'

export default function App() {
  useAutosave()
  useTheme()
  const view = useApp((s) => s.view)

  return (
    <>
      <MobileNotice />
      <div className="desktop-app-container h-full">
        {view === 'editor' ? <Editor /> : view === 'dashboard' ? <Dashboard /> : <Home />}
      </div>
    </>
  )
}
