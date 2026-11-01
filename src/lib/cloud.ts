import type { SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { t } from './i18n'
import { mergePassports, passport, PASSPORT_CHANGED, savePassport, type Passport } from './passport'
import { plays, PLAYED, type Play } from './stats'
import { load, save, todayKey } from './util'
import { loadPurchases, loadUses, mergeWallets, saveWallet, WALLET_CHANGED, type Wallet } from './wallet'

// Le compte est facultatif : sans projet Supabase configuré dans .env.local, le site reste 100 % local.
const SUPABASE_URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').trim()
const KEY = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '').trim()
export const cloudEnabled = !!SUPABASE_URL && !!KEY

// Le client (≈ 50 Ko) ne se charge que si le compte est configuré.
let client: Promise<SupabaseClient> | null = null
function cloud(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    // hors des clés cg: pour que « Effacer ma progression » ne déconnecte pas ; flux implicite : le lien
    // reçu par email ouvre la session dans n'importe quel onglet, pas seulement celui qui l'a demandé
    createClient(SUPABASE_URL, KEY, {
      auth: { storageKey: 'meridien-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      // les parties en ligne envoient leurs tours plusieurs fois par seconde
      realtime: { params: { eventsPerSecond: 30 } },
    }),
  )
  return client
}

// Le canal temps réel des parties en ligne.
export const realtime = cloud

/* État du compte, partagé par tous les écrans */

export interface Account {
  state: 'off' | 'loading' | 'out' | 'in'
  email: string
  // un compte élève : ni email ni mot de passe, il n'existe que sur cet appareil
  anonymous: boolean
  userId: string
  // code ami, à donner pour être ajouté
  code: string
  syncing: boolean
  error: string
}

let account: Account = { state: cloudEnabled ? 'loading' : 'off', email: '', anonymous: false, userId: '', code: '', syncing: false, error: '' }
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
// Un élève garde un profil public neutre (« Joueur 1234 ») : son pseudo de l'appareil ne quitte pas l'appareil.
async function ensureProfile(sb: SupabaseClient, userId: string) {
  const local = load<PublicProfile>('profile', { name: '', avatar: '🧭' })
  const { data, error } = await sb.from('profiles').select('name, avatar, code').eq('id', userId).maybeSingle()
  if (error) throw error
  if (data) {
    set({ code: data.code ?? '' })
    if (account.anonymous) return
    save('profile', { name: data.name, avatar: data.avatar })
    window.dispatchEvent(new Event(PROFILE_CHANGED))
    return
  }
  const profile = { name: validName(local.name) && !account.anonymous ? local.name.trim() : defaultName(), avatar: local.avatar }
  const { data: created, error: insertError } = await sb.from('profiles').insert({ id: userId, ...profile }).select('code').single()
  if (insertError) throw insertError
  set({ code: created.code ?? '' })
  if (account.anonymous) return
  save('profile', profile)
  window.dispatchEvent(new Event(PROFILE_CHANGED))
}

export const PROFILE_CHANGED = 'cg:profile'

let profileTimer = 0
export function pushProfile(profile: PublicProfile) {
  if (account.state !== 'in' || account.anonymous || !validName(profile.name)) return
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

/* Passeport */

export interface StampRow {
  code: string
  n: number
  first_at: string
  last_at: string
  games: string[]
}

export const toStampRows = (book: Passport): StampRow[] =>
  Object.entries(book).map(([code, s]) => ({ code, n: s.n, first_at: new Date(s.first).toISOString(), last_at: new Date(s.last).toISOString(), games: s.games }))

export const fromStampRows = (rows: StampRow[]): Passport =>
  Object.fromEntries(rows.map((r) => [r.code, { n: r.n, first: new Date(r.first_at).getTime(), last: new Date(r.last_at).getTime(), games: r.games }]))

export const PASSPORT_SYNCED = 'cg:passport-synced'

// À la connexion, le passeport du compte rejoint celui de l'appareil ; ensuite chaque tampon part au serveur,
// qui fusionne lui-même pour ne jamais revenir en arrière.
async function syncPassport(sb: SupabaseClient, full: boolean) {
  let book = passport()
  if (full) {
    const { data, error } = await sb.from('passport_stamps').select('code, n, first_at, last_at, games')
    if (error) throw error
    const merged = mergePassports(book, fromStampRows(data as StampRow[]))
    if (JSON.stringify(merged) !== JSON.stringify(book)) {
      savePassport(merged)
      window.dispatchEvent(new Event(PASSPORT_SYNCED))
    }
    book = merged
  }
  const rows = toStampRows(book)
  if (!rows.length) return
  const { error } = await sb.rpc('merge_passport', { p_rows: rows })
  if (error) throw error
}

/* Portefeuille */

// tant que la migration du portefeuille n'est pas passée, la table manque : le reste se synchronise quand même
const MISSING_TABLE = new Set(['PGRST205', '42P01'])

// À la connexion, les achats et jokers utilisés du compte rejoignent ceux de l'appareil ; ensuite le portefeuille
// réuni repart vers le compte.
async function syncWallet(sb: SupabaseClient, full: boolean) {
  let wallet: Wallet = { purchases: loadPurchases(), uses: loadUses() }
  if (full) {
    const { data, error } = await sb.from('wallets').select('purchases, uses').maybeSingle()
    if (error) {
      if (MISSING_TABLE.has(error.code)) return
      throw error
    }
    if (data) {
      const merged = mergeWallets(wallet, data as Wallet)
      if (merged.purchases.length !== wallet.purchases.length || merged.uses.length !== wallet.uses.length) saveWallet(merged)
      wallet = merged
    }
  }
  if (!wallet.purchases.length && !wallet.uses.length) return
  const { error } = await sb.from('wallets').upsert({ user_id: account.userId, ...wallet, updated_at: new Date().toISOString() })
  if (error && !MISSING_TABLE.has(error.code)) throw error
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
      await syncPassport(sb, full)
      await syncWallet(sb, full)
      set({ syncing: false })
    } catch (e) {
      set({ syncing: false, error: e instanceof Error ? e.message : t('Synchronisation impossible.') })
    }
  })
  return queue
}

// Attend que les envois en cours soient faits : un classement lu ensuite compte la partie qu'on vient de finir.
export const whenSynced = () => queue

let started = false

// Écoute la session (rétablie au chargement, ouverte par un code, fermée ailleurs) et envoie chaque partie terminée.
export function startCloud() {
  if (!cloudEnabled || started) return
  started = true
  void cloud().then((sb) =>
    sb.auth.onAuthStateChange((event, session) => {
      set({
        state: session ? 'in' : 'out',
        email: session?.user.email ?? '',
        anonymous: session?.user.is_anonymous ?? false,
        userId: session?.user.id ?? '',
        ...(session ? {} : { code: '' }),
      })
      // pas d'appel à Supabase dans ce rappel : la bibliothèque attend qu'il se termine
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) setTimeout(() => void sync(true))
    }),
  )
  window.addEventListener(PLAYED, () => void sync(false))
  // un achat ou un joker utilisé part aussitôt : un autre appareil le verra à sa prochaine connexion
  window.addEventListener(WALLET_CHANGED, () => void sync(false))
  // les tampons arrivent en rafale (une route de Travle, une série de Seterra) : un envoi groupé suffit
  let stamps = 0
  window.addEventListener(PASSPORT_CHANGED, () => {
    clearTimeout(stamps)
    stamps = window.setTimeout(() => void sync(false), 1500)
  })
}

/* Connexion par email : un lien (modèle par défaut de Supabase) ou un code à 6 chiffres (modèle personnalisé) */

function french(e: { message?: string; status?: number; code?: string }): string {
  // tant que le projet utilise l'envoi d'emails par défaut de Supabase, seuls ses membres reçoivent l'email
  if (e.code === 'email_address_not_authorized') return t('Les emails de connexion ne partent pas encore vers cette adresse. Réessaie plus tard.')
  if (e.code === 'over_email_send_rate_limit' || e.status === 429) return t('Trop de demandes : attends une minute avant de redemander un email.')
  if (e.code === 'otp_expired' || /expired|invalid/i.test(e.message ?? '')) return t('Code incorrect ou expiré. Vérifie-le ou demande-en un nouveau.')
  if (e.code === 'email_address_invalid' || /email/i.test(e.message ?? '')) return t('Cette adresse email n’est pas valide.')
  return e.message || t('Une erreur est survenue. Réessaie.')
}

export async function sendCode(email: string): Promise<void> {
  const { error } = await (await cloud()).auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname },
  })
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

export async function dailyBoard(game: string, day: string, friends = false): Promise<DailyRow[]> {
  const { data, error } = await (await cloud()).rpc('daily_board', { p_game: game, p_day: day, p_friends: friends })
  if (error) throw new Error(error.message)
  return data as DailyRow[]
}

export async function pointsBoard(since: Date | null, friends = false): Promise<PointsRow[]> {
  const { data, error } = await (await cloud()).rpc('points_board', { p_since: (since ?? new Date(0)).toISOString(), p_friends: friends })
  if (error) throw new Error(error.message)
  return data as PointsRow[]
}

/* Défis et amis */

export interface ChallengeRow extends DailyRow {
  code: string
  friend: boolean
}

export interface ChallengeItem {
  game: string
  seed: string
  at: string
  // qui a envoyé le défi, quand il a été reçu plutôt que joué de sa propre initiative
  from_name: string | null
  from_avatar: string | null
  played: boolean
  players: number
  my_rank: number | null
  leader_name: string | null
  leader_pts: number | null
}

export interface Friend {
  name: string
  avatar: string
  code: string
  mutual: boolean
  week_points: number
}

// Seul le premier essai compte : un deuxième envoi pour le même défi est ignoré.
export async function submitChallenge(game: string, seed: string, r: { pts: number; s?: number; ms?: number; win?: boolean }): Promise<void> {
  if (account.state !== 'in') return
  // le score pointe vers le profil, créé par la synchronisation en cours à la première connexion
  await queue
  const { error } = await (await cloud()).from('challenge_scores').upsert(
    {
      game,
      seed,
      pts: Math.round(Math.max(0, Math.min(100, r.pts))),
      score: r.s ?? null,
      ms: r.ms === undefined ? null : Math.min(86400000, Math.round(r.ms)),
      win: r.win ?? null,
    },
    { onConflict: 'game,seed,user_id', ignoreDuplicates: true },
  )
  if (error) throw new Error(error.message)
}

export async function challengeBoard(game: string, seed: string): Promise<ChallengeRow[]> {
  const { data, error } = await (await cloud()).rpc('challenge_board', { p_game: game, p_seed: seed })
  if (error) throw new Error(error.message)
  return data as ChallengeRow[]
}

export async function myChallenges(): Promise<ChallengeItem[]> {
  const { data, error } = await (await cloud()).rpc('my_challenges')
  if (error) throw new Error(error.message)
  return data as ChallengeItem[]
}

export async function sendChallenge(game: string, seed: string, codes: string[]): Promise<number> {
  const { data, error } = await (await cloud()).rpc('send_challenge', { p_game: game, p_seed: seed, p_codes: codes })
  if (error) throw new Error(error.message)
  return data as number
}

export async function myFriends(): Promise<Friend[]> {
  const { data, error } = await (await cloud()).rpc('my_friends')
  if (error) throw new Error(error.message)
  return data as Friend[]
}

export async function addFriend(code: string): Promise<Friend> {
  const { data, error } = await (await cloud()).rpc('add_friend', { p_code: code })
  if (error) {
    if (error.message.includes('unknown_code')) throw new Error(t('Aucun joueur n’a ce code.'))
    if (error.message.includes('own_code')) throw new Error(t('C’est ton propre code.'))
    throw new Error(error.message)
  }
  return { ...(data as Friend[])[0], mutual: false, week_points: 0 }
}

export async function removeFriend(code: string): Promise<void> {
  const { error } = await (await cloud()).rpc('remove_friend', { p_code: code })
  if (error) throw new Error(error.message)
}

/* Mode classe : un professeur (compte avec email) crée une classe, ses élèves la rejoignent avec son code et un
   pseudo, sur un compte anonyme. */

export interface ClassInfo {
  id: string
  code: string
  name: string
  // les jeux à faire, épinglés par le professeur : des adresses du site
  games: string[]
  // fermée, la classe n'accepte plus de nouveaux élèves
  open: boolean
  teacher: boolean
  // le pseudo de l'élève dans cette classe
  pseudo: string | null
  members: number
}

export interface ClassRow {
  rank: number
  pseudo: string
  points: number
  plays: number
  me: boolean
}

// tant que la migration des classes n'est pas passée, ses fonctions et ses tables manquent
const CLASSES_MISSING = new Set(['PGRST202', 'PGRST205', '42P01', '42883'])

function classError(e: { code?: string; message: string }): Error {
  if (CLASSES_MISSING.has(e.code ?? '')) return new Error(t('Le mode classe n’est pas encore ouvert sur Expedle. Reviens bientôt !'))
  const known: Record<string, string> = {
    unknown_code: t('Aucune classe n’a ce code. Vérifie-le auprès de ton professeur.'),
    closed: t('Cette classe n’accepte plus de nouveaux élèves.'),
    pseudo_taken: t('Ce pseudo est déjà pris dans la classe : choisis-en un autre.'),
    bad_pseudo: t('Ton pseudo doit faire de 2 à 20 caractères, sans @.'),
    bad_name: t('Le nom de la classe doit faire de 2 à 40 caractères.'),
    own_class: t('C’est ta propre classe : tu la suis déjà comme professeur.'),
    anonymous: t('Pour créer une classe, connecte-toi avec ton email.'),
  }
  return new Error(known[e.message] ?? e.message)
}

// Avant toute connexion : une fonction absente (migration pas encore passée) ne donne pas la même erreur qu'une
// fonction réservée aux comptes. Aucun compte élève n'est créé tant que le mode classe n'est pas ouvert.
export async function classesReady(): Promise<boolean> {
  const { error } = await (await cloud()).rpc('my_classes')
  return !error || !CLASSES_MISSING.has(error.code)
}

export async function myClasses(): Promise<ClassInfo[]> {
  const { data, error } = await (await cloud()).rpc('my_classes')
  if (error) throw classError(error)
  return data as ClassInfo[]
}

export async function createClass(name: string): Promise<ClassInfo> {
  const { data, error } = await (await cloud()).rpc('create_class', { p_name: name.trim() })
  if (error) throw classError(error)
  return { ...(data as Omit<ClassInfo, 'teacher' | 'pseudo' | 'members'>), teacher: true, pseudo: null, members: 0 }
}

// Un élève n'a ni email ni mot de passe : sans compte, il en reçoit un anonyme, propre à cet appareil.
export async function joinClass(code: string, pseudo: string): Promise<{ id: string; name: string }> {
  const sb = await cloud()
  if (account.state !== 'in') {
    const { error } = await sb.auth.signInAnonymously()
    if (error) {
      if (error.code === 'anonymous_provider_disabled') throw new Error(t('Les comptes élèves ne sont pas encore ouverts sur Expedle. Reviens bientôt !'))
      if (error.status === 429) throw new Error(t('Trop de demandes : attends une minute avant de réessayer.'))
      throw new Error(error.message || t('Une erreur est survenue. Réessaie.'))
    }
  }
  const { data, error } = await sb.rpc('join_class', { p_code: code, p_pseudo: pseudo.trim() })
  if (error) throw classError(error)
  return (data as { id: string; name: string }[])[0]
}

export async function classBoard(id: string, since: Date): Promise<ClassRow[]> {
  const { data, error } = await (await cloud()).rpc('class_board', { p_class: id, p_since: since.toISOString() })
  if (error) throw classError(error)
  return data as ClassRow[]
}

export async function updateClass(id: string, patch: Partial<Pick<ClassInfo, 'games' | 'open'>>): Promise<void> {
  const { error } = await (await cloud()).from('classes').update(patch).eq('id', id)
  if (error) throw classError(error)
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await (await cloud()).from('classes').delete().eq('id', id)
  if (error) throw classError(error)
}

// Le professeur retire un élève (désigné par son pseudo, unique dans la classe) ; un élève quitte sa classe.
export async function removeMember(classId: string, pseudo: string): Promise<void> {
  const { error } = await (await cloud()).from('class_members').delete().eq('class_id', classId).eq('pseudo', pseudo)
  if (error) throw classError(error)
}

export async function leaveClass(classId: string): Promise<void> {
  const { error } = await (await cloud()).from('class_members').delete().eq('class_id', classId).eq('user_id', account.userId)
  if (error) throw classError(error)
}
