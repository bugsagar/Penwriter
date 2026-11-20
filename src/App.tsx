import { useEffect, useState } from 'react'
import { useApp } from './store/useApp'
import { useAutosave, useTheme } from './hooks/useAutosave'
import { useCloud } from './hooks/useCloud'
import { ClaimDrafts, SignInScreen } from './components/Account'
import { loadSession } from './utils/storage'
import { Home } from './components/Home'
import { Dashboard } from './components/Dashboard'
import { Editor } from './components/editor/Editor'
import { ShareView } from './components/ShareView'
import { shareCodeFromLocation } from './utils/share'

export default function App() {
  useAutosave()
  useCloud()
  useTheme()
  const view = useApp((s) => s.view)
  const authStatus = useApp((s) => s.authStatus)
  // where the writer was last time (to show a loader rather than flash Home)
  const [resumeTo] = useState(() => loadSession()?.view ?? 'home')

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
          document.title = 'Ezuth — Screenplay Studio'
          setShare(null)
        }}
      />
    )
  }

  // Writing needs sign-in (cloud saving). Home stays open to everyone.
  if (authStatus === 'loading' && (view !== 'home' || resumeTo !== 'home')) return <SignInScreen loading />
  if (authStatus === 'signedOut' && view !== 'home') return <SignInScreen />

  return (
    <>
      {view === 'editor' ? <Editor /> : view === 'dashboard' ? <Dashboard /> : <Home />}
      <ClaimDrafts />
    </>
  )
}
