import { useState } from 'react'
import { Cloud, LogOut } from 'lucide-react'
import { useApp } from '../store/useApp'
import { signInWithGoogle, signOut } from '../utils/cloud'
import { clearComputerProjects, saveSession } from '../utils/storage'
import { resolveUnclaimed, syncNow } from '../hooks/useCloud'
import { Dropdown, MenuItem } from './ui'
import logoUrl from '../assets/logo.svg'

/** The Google "G", in its own colours. */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** Start Google sign-in; afterwards the writer lands on their scripts. */
export async function startSignIn(): Promise<void> {
  saveSession({ view: 'dashboard', activeProjectId: null })
  await signInWithGoogle()
}

/** Avatar button with the signed-in account and "Sign out". */
export function AccountButton() {
  const user = useApp((s) => s.user)
  const cloudError = useApp((s) => s.cloudError)
  if (!user) return null
  const initial = (user.name || user.email || '?').trim()[0]?.toUpperCase()
  return (
    <Dropdown
      trigger={
        <button
          type="button"
          title={user.email}
          aria-label="Account"
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-ink-200/70 bg-white/80 text-[14px] font-semibold text-ink-700 backdrop-blur dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-200"
        >
          {user.avatar ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : initial}
        </button>
      }
    >
      {(close) => (
        <div className="w-64">
          <div className="px-3 pb-2 pt-1.5">
            <p className="truncate text-[13.5px] font-semibold text-ink-900 dark:text-ink-50">{user.name}</p>
            <p className="truncate text-[12px] text-ink-500 dark:text-ink-400">{user.email}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-500 dark:text-ink-400">
              <Cloud size={13} />
              {cloudError ?? 'Scripts are saved to your account.'}
            </p>
          </div>
          <SignOutItem close={close} />
        </div>
      )}
    </Dropdown>
  )
}

/**
 * Sign out. If this browser holds "My computer" scripts for this account,
 * ask whether to remove them from this browser too (the files stay).
 */
function SignOutItem({ close }: { close: () => void }) {
  const [asking, setAsking] = useState(false)
  const computerCount = useApp((s) => s.projects.filter((p) => p.savedOnComputer).length)
  const out = async (removeLocal: boolean) => {
    close()
    const uid = useApp.getState().user?.id
    await syncNow() // don't lose the last few words
    if (removeLocal && uid) clearComputerProjects(uid)
    saveSession({ view: 'home', activeProjectId: null })
    await signOut()
  }
  if (!asking) {
    return (
      <MenuItem
        icon={<LogOut size={15} />}
        label="Sign out"
        onClick={() => (computerCount > 0 ? setAsking(true) : void out(false))}
      />
    )
  }
  return (
    <div className="border-t border-ink-100 px-3 pb-2 pt-2.5 dark:border-ink-800">
      <p className="text-[12.5px] leading-snug text-ink-700 dark:text-ink-200">
        Remove your {computerCount} “My computer” script{computerCount === 1 ? '' : 's'} from this browser? Do this on a
        shared computer. The .reel.json files on the computer are not touched.
      </p>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => void out(true)}
          className="h-8 flex-1 rounded-full bg-ink-950 text-[12.5px] font-semibold text-white dark:bg-ink-50 dark:text-ink-950"
        >
          Remove & sign out
        </button>
        <button
          type="button"
          onClick={() => void out(false)}
          className="h-8 flex-1 rounded-full border border-ink-200 text-[12.5px] font-medium text-ink-800 dark:border-ink-700 dark:text-ink-100"
        >
          Keep & sign out
        </button>
      </div>
    </div>
  )
}

/**
 * Scripts this browser kept without an account (from before cloud saving).
 * The browser may be shared, so they only join the signed-in account if the
 * writer says they're theirs.
 */
export function ClaimDrafts() {
  const unclaimed = useApp((s) => s.unclaimed)
  const user = useApp((s) => s.user)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!unclaimed.length || !user) return null
  const go = async (choice: 'move' | 'delete' | 'leave') => {
    setBusy(true)
    setError(null)
    try {
      await resolveUnclaimed(choice)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t move them. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/40 backdrop-blur-[2px] sm:items-center sm:p-6 dark:bg-black/55">
      <div role="dialog" aria-modal="true" aria-label="Scripts found in this browser" className="animate-sheet-up pb-safe w-full rounded-t-[24px] bg-white p-5 shadow-lift sm:max-w-[440px] sm:rounded-[24px] dark:bg-ink-900">
        <h2 className="font-serif text-[22px] leading-tight text-ink-950 dark:text-ink-50">Scripts found in this browser</h2>
        <p className="mt-1 text-[13px] text-ink-500 dark:text-ink-400">
          {unclaimed.length === 1 ? 'This script was' : `These ${unclaimed.length} scripts were`} saved here before you signed in. Are
          they yours?
        </p>
        <ul className="mt-3 max-h-40 space-y-1 overflow-auto rounded-xl bg-ink-50 px-3 py-2 dark:bg-ink-950">
          {unclaimed.map((p) => (
            <li key={p.id} className="truncate text-[13.5px] text-ink-800 dark:text-ink-100">
              {p.title || 'Untitled'}
              {p.savedOnComputer && <span className="text-ink-400"> · My computer</span>}
            </li>
          ))}
        </ul>
        {error && <p className="mt-2 text-[12.5px] text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void go('move')}
          className="mt-4 h-11 w-full rounded-full bg-ink-950 text-[14px] font-semibold text-white disabled:opacity-60 dark:bg-ink-50 dark:text-ink-950"
        >
          {busy ? 'Moving…' : `Yes, add to ${user.email}`}
        </button>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void go('leave')}
            className="h-10 flex-1 rounded-full border border-ink-200 text-[13px] font-medium text-ink-800 dark:border-ink-700 dark:text-ink-100"
          >
            Not mine, leave them
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void go('delete')}
            className="h-10 flex-1 rounded-full border border-ink-200 text-[13px] font-medium text-red-600 dark:border-ink-700 dark:text-red-400"
          >
            Delete from browser
          </button>
        </div>
      </div>
    </div>
  )
}

/** Shown while checking sign-in / loading scripts, and when a page needs sign-in. */
export function SignInScreen({ loading }: { loading?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-[#111214] px-6 text-center text-white">
      <img src={logoUrl} alt="Ezuth" className="h-14 w-auto" />
      {loading ? (
        <p className="text-[14px] text-white/60">Loading your scripts…</p>
      ) : (
        <>
          <p className="max-w-xs text-[15px] text-white/80">Sign in to write. Your scripts are saved to your account, on every device.</p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await startSignIn()
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
                setBusy(false)
              }
            }}
            className="flex h-11 items-center gap-2.5 rounded-full bg-white px-5 text-[14px] font-semibold text-[#1f1f1f] disabled:opacity-60"
          >
            <GoogleMark />
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
          {error && <p className="text-[12.5px] text-[#ff8a7a]">{error}</p>}
        </>
      )}
    </div>
  )
}
