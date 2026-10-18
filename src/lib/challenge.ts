import { load, save } from './util'

// Un défi = un jeu et une graine. Chaque jeu tire sa partie de la graine : le lien rejoue le même tirage.

export interface Result {
  pts: number
  s?: number
  ms?: number
  win?: boolean
}

export interface Rival {
  name: string
  avatar: string
  r: Result
}

export interface Challenge {
  seed: string
  // celui qui a envoyé le lien et son score, pour comparer même sans compte
  by: Rival | null
}

const SEED = /^[A-Za-z0-9._~:,-]{1,400}$/

export const newSeed = () => Math.random().toString(36).slice(2, 10)

export function encodeResult(r: Result): string {
  return [r.pts, r.s ?? '', r.ms === undefined ? '' : Math.round(r.ms), r.win === undefined ? '' : r.win ? 1 : 0].join('~')
}

export function decodeResult(text: string): Result | null {
  const [pts, s, ms, win] = text.split('~')
  const n = Number(pts)
  if (!pts || !Number.isFinite(n)) return null
  const r: Result = { pts: Math.max(0, Math.min(100, n)) }
  if (s && Number.isFinite(Number(s))) r.s = Number(s)
  if (ms && Number.isFinite(Number(ms))) r.ms = Number(ms)
  if (win === '1' || win === '0') r.win = win === '1'
  return r
}

export function readChallenge(params = new URLSearchParams(location.hash.split('?')[1] ?? '')): Challenge | null {
  const seed = params.get('defi')
  if (!seed || !SEED.test(seed)) return null
  const r = decodeResult(params.get('r') ?? '')
  const name = (params.get('par') ?? '').trim().slice(0, 24)
  return { seed, by: r && name ? { name, avatar: (params.get('av') || '🧭').slice(0, 8), r } : null }
}

// path : la page du jeu sans le #, par exemple /worldle ou /classement/classique?facile=1.
export function challengeUrl(path: string, seed: string, mine?: Result, me?: { name: string; avatar: string }): string {
  const [page, query] = path.split('?')
  const q = new URLSearchParams(query)
  q.set('defi', seed)
  if (mine && me?.name) {
    q.set('par', me.name)
    q.set('av', me.avatar)
    q.set('r', encodeResult(mine))
  }
  return `${location.origin}${location.pathname}#${page}?${q}`
}

// Meilleur score d'abord, puis le plus rapide.
export function compare(a: Result, b: Result): number {
  return b.pts - a.pts || (a.ms ?? Infinity) - (b.ms ?? Infinity)
}

/* Les défis joués sur cet appareil, pour la page Défis sans compte */

export interface LocalChallenge {
  game: string
  seed: string
  at: number
  mine?: Result
  by?: Rival | null
}

export function localChallenges(): LocalChallenge[] {
  return load<LocalChallenge[]>('defis', [])
}

// Le premier essai reste celui qui compte ; un rejeu ne remplace pas le score.
export function rememberChallenge(entry: LocalChallenge): void {
  const list = localChallenges()
  const old = list.find((c) => c.game === entry.game && c.seed === entry.seed)
  const merged: LocalChallenge = { ...entry, mine: old?.mine ?? entry.mine, by: entry.by ?? old?.by }
  save('defis', [merged, ...list.filter((c) => c !== old)].slice(0, 100))
}
