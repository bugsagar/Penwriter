import { useEffect, useState } from 'react'
import { useApp } from './store/useApp'
import { useAutosave, useTheme } from './hooks/useAutosave'
import { Home } from './components/Home'
import { Dashboard } from './components/Dashboard'
import { Editor } from './components/editor/Editor'
import { ShareView } from './components/ShareView'
import { shareCodeFromLocation } from './utils/share'

export default function App() {
  useAutosave()
  useTheme()
  const view = useApp((s) => s.view)

  // A view-only share link (#share=…) opens the reader instead of the app.
  const [share, setShare] = useState(() => shareCodeFromLocation())
  const [fresh, setFresh] = useState(() => /[#&]new=1/.test(location.hash))
  useEffect(() => {
    const onHash = () => {
      setShare(shareCodeFromLocation())
      setFresh(/[#&]new=1/.test(location.hash))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (share) {
    return (
      <ShareView
        key={share}
        code={share}
        fresh={fresh}
        onExit={() => {
          history.replaceState(null, '', location.pathname + location.search)
          document.title = 'Pen — Screenplay Studio'
          setShare(null)
        }}
      />
    )
  }

  return view === 'editor' ? <Editor /> : view === 'dashboard' ? <Dashboard /> : <Home />
}
