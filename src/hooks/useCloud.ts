import { useEffect } from 'react'
import { useApp } from '../store/useApp'
import { cloud, deleteProjects, fetchProjects, toCloudUser, upsertProjects } from '../utils/cloud'
import { clearLocalProjects, loadProjects } from '../utils/storage'
import type { Project } from '../types'

/*
 * Keeps the writer's scripts in the cloud.
 *
 * On sign-in: loads their scripts, and moves up any scripts this browser kept
 * from before cloud saving (then forgets them locally). While writing: every
 * change is sent ~0.7 s after typing stops — only the scripts that changed —
 * and deleted scripts are removed. A failed save (offline) is retried.
 */

/** What the cloud holds, as last confirmed: id → the exact object sent. */
const synced = new Map<string, Project>()
let userId: string | null = null
let chain: Promise<void> = Promise.resolve()
let retry: ReturnType<typeof setTimeout> | undefined

async function pushChanges(): Promise<void> {
  if (!userId) return
  const uid = userId
  const { projects } = useApp.getState()
  const changed = projects.filter((p) => synced.get(p.id) !== p)
  const live = new Set(projects.map((p) => p.id))
  const gone = [...synced.keys()].filter((id) => !live.has(id))
  if (changed.length === 0 && gone.length === 0) {
    if (useApp.getState().projects === projects) useApp.getState().markSaved()
    return
  }
  useApp.setState({ saveStatus: 'saving' })
  try {
    await upsertProjects(uid, changed)
    await deleteProjects(uid, gone)
    if (uid !== userId) return // signed out meanwhile
    for (const p of changed) synced.set(p.id, p)
    for (const id of gone) synced.delete(id)
    useApp.getState().setCloudError(null)
    // newer edits arrived while saving → stay "unsaved"; the next run sends them
    useApp.setState({ saveStatus: useApp.getState().projects === projects ? 'saved' : 'unsaved' })
  } catch (err) {
    useApp.setState({ saveStatus: 'unsaved' })
    useApp.getState().setCloudError(navigator.onLine ? 'Couldn’t save to the cloud — retrying…' : 'Offline — will save when you’re back online.')
    console.error('Cloud save failed', err)
    clearTimeout(retry)
    retry = setTimeout(() => void syncNow(), 5000)
  }
}

/** Send pending changes now (queued behind any save in progress). */
export function syncNow(): Promise<void> {
  chain = chain.then(pushChanges, pushChanges)
  return chain
}

async function onUser(user: ReturnType<typeof toCloudUser> | null) {
  const store = useApp.getState()
  if (!user) {
    userId = null
    synced.clear()
    store.signedOut()
    return
  }
  if (userId === user.id) return // already loaded / loading for this writer
  userId = user.id
  useApp.setState({ authStatus: 'loading' })
  try {
    const remote = await fetchProjects()
    synced.clear()
    for (const p of remote) synced.set(p.id, p)
    // move scripts from before cloud saving, then forget them in the browser
    const ids = new Set(remote.map((p) => p.id))
    const local = loadProjects().filter((p) => !ids.has(p.id))
    if (local.length) {
      await upsertProjects(user.id, local)
      for (const p of local) synced.set(p.id, p)
    }
    clearLocalProjects()
    const all = [...remote, ...local].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    useApp.getState().signedIn(user, all)
  } catch (err) {
    console.error('Loading scripts failed', err)
    useApp.setState({ authStatus: 'signedIn', user })
    useApp.getState().setCloudError('Couldn’t load your scripts. Check your connection and reload.')
    userId = null // don't save over the cloud with an empty list
  }
}

export function useCloud() {
  const projects = useApp((s) => s.projects)
  const authStatus = useApp((s) => s.authStatus)

  // sign-in state
  useEffect(() => {
    if (!cloud) return
    // INITIAL_SESSION covers page load (incl. the return from Google). The
    // work is deferred: Supabase deadlocks if its own calls are awaited inside
    // this callback.
    const { data } = cloud.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        const user = session ? toCloudUser(session.user) : null
        setTimeout(() => void onUser(user), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // autosave to the cloud
  useEffect(() => {
    if (authStatus !== 'signedIn' || !userId) return
    const t = setTimeout(() => void syncNow(), 700)
    return () => clearTimeout(t)
  }, [projects, authStatus])

  // leaving the page / switching apps: send now
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && userId) void syncNow()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  // reconnect: send what's pending
  useEffect(() => {
    const onOnline = () => userId && void syncNow()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])
}
