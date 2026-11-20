import { useEffect } from 'react'
import { useApp } from '../store/useApp'
import { cloud, deleteProjects, fetchProjects, toCloudUser, upsertProjects } from '../utils/cloud'
import {
  clearUnclaimedProjects,
  loadComputerProjects,
  loadUnclaimedProjects,
  saveComputerProjects,
} from '../utils/storage'
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
  // Only while one writer's scripts are fully loaded and on screen: never
  // during sign-in / account switch (the list may still be the last writer's).
  const st = useApp.getState()
  if (!userId || st.authStatus !== 'signedIn' || st.user?.id !== userId) return
  const uid = userId
  const { projects } = useApp.getState()
  // "My computer" scripts never go up; switching one to computer removes it from the cloud
  const cloudOnes = projects.filter((p) => !p.savedOnComputer)
  const changed = cloudOnes.filter((p) => synced.get(p.id) !== p)
  const live = new Set(cloudOnes.map((p) => p.id))
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
  if (user?.id !== userId) clearTimeout(retry) // a retry belongs to the previous writer
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
    const ids = new Set(remote.map((p) => p.id))
    const computer = loadComputerProjects(user.id).filter((p) => !ids.has(p.id))
    const all = [...remote, ...computer].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    useApp.getState().signedIn(user, all)
    // Scripts left in this browser without an account (from before cloud
    // saving) are never moved on their own — this browser may be shared.
    // The writer is asked first (ClaimDrafts).
    const unclaimed = loadUnclaimedProjects().filter((p) => !ids.has(p.id) && !computer.some((c) => c.id === p.id))
    useApp.setState({ unclaimed })
  } catch (err) {
    console.error('Loading scripts failed', err)
    // still show this computer's scripts (and never save their list as empty)
    useApp.setState({ authStatus: 'signedIn', user, projects: loadComputerProjects(user.id) })
    useApp.getState().setCloudError('Couldn’t load your scripts. Check your connection and reload.')
    userId = null // don't save over the cloud with an empty list
  }
}

/**
 * The writer chose what to do with scripts this browser kept without an
 * account: 'move' adds them to their account (computer ones stay on this
 * computer under their account), 'delete' removes them from this browser,
 * 'leave' keeps them here unclaimed (asked again next sign-in).
 */
export async function resolveUnclaimed(choice: 'move' | 'delete' | 'leave'): Promise<void> {
  const { unclaimed, user } = useApp.getState()
  if (choice === 'leave' || !user) {
    useApp.setState({ unclaimed: [] })
    return
  }
  if (choice === 'move') {
    const cloudOnes = unclaimed.filter((p) => !p.savedOnComputer)
    const computerOnes = unclaimed.filter((p) => p.savedOnComputer)
    await upsertProjects(user.id, cloudOnes)
    for (const p of cloudOnes) synced.set(p.id, p)
    const { projects } = useApp.getState()
    const next = [...unclaimed, ...projects].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    saveComputerProjects(user.id, [...computerOnes, ...projects])
    useApp.setState({ projects: next })
  }
  clearUnclaimedProjects()
  useApp.setState({ unclaimed: [] })
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
