import type { SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { plays, PLAYED, type Play } from './stats'
import { load, save, todayKey } from './util'

// Le compte est facultatif : sans projet Supabase configuré dans .env.local, le site reste 100 % local.
const URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').trim()
const KEY = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '').trim()
export const cloudEnabled = !!URL && !!KEY

// Le client (≈ 50 Ko) ne se charge que si le compte est configuré.
let client: Promise<SupabaseClient> | null = null
function cloud(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    // hors des clés cg: pour que « Effacer ma progression » ne déconnecte pas
    createClient(URL, KEY, { auth: { storageKey: 'meridien-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }),
  )
  return client
}

/* État du compte, partagé par tous les écrans */

export interface Account {
  state: 'off' | 'loading' | 'out' | 'in'
  email: string
  userId: string
  syncing: boolean
  error: string
}

let account: Account = { state: cloudEnabled ? 'loading' : 'off', email: '', userId: '', syncing: false, error: '' }
const listeners = new Set<() => void>()

function set(patch: Partial<Account>) {
  account = { ...account, ...patch }
  listeners.forEach((f) => f())
}

export function useAccount(): Account {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => account,
  )
}

/* Historique : conversion et fusion */

export interface PlayRow {
  game: string
  played_at: string
  day: string
  pts: number
  score: number | null
  ms: number | null
  win: boolean | null
  sub: string | null
}

export function toRow(p: Play): PlayRow {
  return {
    game: p.g,
    played_at: new Date(p.t).toISOString(),
    day: todayKey(new Date(p.t)),
    pts: p.pts,
    score: p.s ?? null,
    ms: p.ms === undefined ? null : Math.round(p.ms),
    win: p.win ?? null,
    sub: p.sub ?? null,
  }
}

export function fromRow(r: Omit<PlayRow, 'day'>): Play {
  const p: Play = { g: r.game, t: new Date(r.played_at).getTime(), pts: r.pts }
  if (r.score !== null) p.s = r.score
  if (r.ms !== null) p.ms = r.ms
  if (r.win !== null) p.win = r.win
  if (r.sub !== null) p.sub = r.sub
  return p
}

// Les parties jouées sur un autre appareil rejoignent l'historique local, sans doublon.
export function mergePlays(local: Play[], remote: Play[]): Play[] {
  const seen = new Set(local.map((p) => `${p.g}|${p.t}`))
  const extra = remote.filter((p) => !seen.has(`${p.g}|${p.t}`))
  return extra.length ? [...local, ...extra].sort((a, b) => a.t - b.t).slice(-5000) : local
}

/* Profil public */

export interface PublicProfile {
  name: string
  avatar: string
}

const validName = (name: string) => name.trim().length >= 2 && name.trim().length <= 24

function defaultName() {
  return `Joueur ${Math.floor(1000 + Math.random() * 9000)}`
}

// Un nouvel appareil reprend le profil du compte ; un nouveau compte reprend le profil de l'appareil.
async function ensureProfile(sb: SupabaseClient, userId: string) {
  const local = load<PublicProfile>('profile', { name: '', avatar: '🧭' })
  const { data, error } = await sb.from('profiles').select('name, avatar').eq('id', userId).maybeSingle()
  if (error) throw error
  if (data) {
    save('profile', { name: data.name, avatar: data.avatar })
    window.dispatchEvent(new Event(PROFILE_CHANGED))
    return
  }
  const profile = { name: validName(local.name) ? local.name.trim() : defaultName(), avatar: local.avatar }
  const { error: insertError } = await sb.from('profiles').insert({ id: userId, ...profile })
  if (insertError) throw insertError
  save('profile', profile)
  window.dispatchEvent(new Event(PROFILE_CHANGED))
}

export const PROFILE_CHANGED = 'cg:profile'

let profileTimer = 0
export function pushProfile(profile: PublicProfile) {
  if (account.state !== 'in' || !validName(profile.name)) return
  clearTimeout(profileTimer)
  profileTimer = window.setTimeout(async () => {
    const sb = await cloud()
    await sb.from('profiles').update({ name: profile.name.trim(), avatar: profile.avatar, updated_at: new Date().toISOString() }).eq('id', account.userId)
  }, 600)
}

/* Synchronisation */

const syncedKey = () => `synced:${account.userId}`

async function upload(sb: SupabaseClient) {
  const since = load<number>(syncedKey(), 0)
  const fresh = plays().filter((p) => p.t > since)
  for (let i = 0; i < fresh.length; i += 500) {
    const batch = fresh.slice(i, i + 500)
    const { error } = await sb.from('plays').upsert(batch.map(toRow), { onConflict: 'user_id,game,played_at', ignoreDuplicates: true })
    if (error) throw error
    save(syncedKey(), batch.at(-1)!.t)
  }
}

export const HISTORY_CHANGED = 'cg:history'

async function download(sb: SupabaseClient) {
  const { data, error } = await sb.from('plays').select('game, played_at, pts, score, ms, win, sub').order('played_at', { ascending: false }).limit(5000)
  if (error) throw error
  const local = plays()
  const merged = mergePlays(local, (data as PlayRow[]).map(fromRow))
  if (merged !== local) {
    save('history', merged)
    // les succès gagnés sur l'autre appareil sont célébrés ici aussi
    window.dispatchEvent(new Event(HISTORY_CHANGED))
  }
}

// Les synchronisations passent l'une après l'autre : une partie finie pendant la première n'est pas envoyée deux fois.
let queue = Promise.resolve()

function sync(full: boolean) {
  queue = queue.then(async () => {
    if (account.state !== 'in') return
    set({ syncing: true, error: '' })
    try {
      const sb = await cloud()
      if (full) await ensureProfile(sb, account.userId)
      await upload(sb)
      if (full) await download(sb)
      set({ syncing: false })
    } catch (e) {
      set({ syncing: false, error: e instanceof Error ? e.message : 'Synchronisation impossible.' })
    }
  })
  return queue
}

let started = false

// Écoute la session (rétablie au chargement, ouverte par un code, fermée ailleurs) et envoie chaque partie terminée.
export function startCloud() {
  if (!cloudEnabled || started) return
  started = true
  void cloud().then((sb) =>
    sb.auth.onAuthStateChange((event, session) => {
      set({ state: session ? 'in' : 'out', email: session?.user.email ?? '', userId: session?.user.id ?? '' })
      // pas d'appel à Supabase dans ce rappel : la bibliothèque attend qu'il se termine
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) setTimeout(() => void sync(true))
    }),
  )
  window.addEventListener(PLAYED, () => void sync(false))
}

/* Connexion par code à 6 chiffres reçu par email */

function french(e: { message?: string; status?: number; code?: string }): string {
  if (e.code === 'over_email_send_rate_limit' || e.status === 429) return 'Trop de demandes : attends une minute avant de redemander un code.'
  if (e.code === 'otp_expired' || /expired|invalid/i.test(e.message ?? '')) return 'Code incorrect ou expiré. Vérifie-le ou demande-en un nouveau.'
  if (e.code === 'email_address_invalid' || /email/i.test(e.message ?? '')) return 'Cette adresse email n’est pas valide.'
  return e.message || 'Une erreur est survenue. Réessaie.'
}

export async function sendCode(email: string): Promise<void> {
  const { error } = await (await cloud()).auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
  if (error) throw new Error(french(error))
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const { error } = await (await cloud()).auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
  if (error) throw new Error(french(error))
}

export async function signOut(): Promise<void> {
  await (await cloud()).auth.signOut()
}

/* Classements */

export interface DailyRow {
  rank: number
  name: string
  avatar: string
  pts: number
  score: number | null
  ms: number | null
  win: boolean | null
  me: boolean
}

export interface PointsRow {
  rank: number
  name: string
  avatar: string
  points: number
  plays: number
  me: boolean
}

export async function dailyBoard(game: string, day: string): Promise<DailyRow[]> {
  const { data, error } = await (await cloud()).rpc('daily_board', { p_game: game, p_day: day })
  if (error) throw new Error(error.message)
  return data as DailyRow[]
}

export async function pointsBoard(since: Date | null): Promise<PointsRow[]> {
  const { data, error } = await (await cloud()).rpc('points_board', { p_since: (since ?? new Date(0)).toISOString() })
  if (error) throw new Error(error.message)
  return data as PointsRow[]
}
