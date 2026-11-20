import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Project } from '../types'

/*
 * Cloud storage for scripts (Supabase): sign-in with Google, one row per
 * script in the `projects` table (see supabase/schema.sql). Scripts are not
 * kept in the browser any more; only the sign-in session is.
 *
 * The two keys below are public by design (row-level security protects the
 * data). Without them — e.g. local development before setup — the app falls
 * back to browser storage so it still runs.
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloud: SupabaseClient | null =
  URL && KEY ? createClient(URL, KEY, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }) : null

export const cloudEnabled = cloud !== null

export interface CloudUser {
  id: string
  email: string
  name: string
  avatar: string | null
}

export function toCloudUser(u: User): CloudUser {
  const m = (u.user_metadata ?? {}) as Record<string, string | undefined>
  return {
    id: u.id,
    email: u.email ?? '',
    name: m.full_name || m.name || u.email || 'Writer',
    avatar: m.avatar_url || m.picture || null,
  }
}

export async function signInWithGoogle(): Promise<void> {
  if (!cloud) throw new Error('Cloud saving is not set up yet.')
  const { error } = await cloud.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/`, queryParams: { prompt: 'select_account' } },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await cloud?.auth.signOut()
}

export async function fetchProjects(): Promise<Project[]> {
  if (!cloud) return []
  const { data, error } = await cloud.from('projects').select('data').order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => r.data as Project)
}

export async function upsertProjects(userId: string, projects: Project[]): Promise<void> {
  if (!cloud || projects.length === 0) return
  const rows = projects.map((p) => ({
    user_id: userId,
    id: p.id,
    data: p,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await cloud.from('projects').upsert(rows, { onConflict: 'user_id,id' })
  if (error) throw error
}

export async function deleteProjects(userId: string, ids: string[]): Promise<void> {
  if (!cloud || ids.length === 0) return
  const { error } = await cloud.from('projects').delete().eq('user_id', userId).in('id', ids)
  if (error) throw error
}
