// Le niveau et les statistiques de Frontières, tirés des parties enregistrées dans ce navigateur.
import { msg } from '../../lib/i18n'
import type { Play } from '../../lib/stats'

export const GAME = 'openfront'

// passer du niveau n au suivant demande 100 × n points
const need = (level: number) => 100 * level

export interface Rank {
  level: number
  // points gagnés dans le niveau en cours, et points qu'il demande
  into: number
  need: number
  xp: number
}

export function rankOf(xp: number): Rank {
  let level = 1
  let into = xp
  while (into >= need(level)) into -= need(level++)
  return { level, into, need: need(level), xp }
}

export interface Tally {
  games: number
  wins: number
  // meilleure part des terres tenue, en %
  best: number
  // part moyenne tenue en fin de partie, en %
  average: number
  ms: number
  multi: number
}

export function tallyOf(list: Play[]): Tally {
  const mine = list.filter((p) => p.g === GAME)
  return {
    games: mine.length,
    wins: mine.filter((p) => p.win).length,
    best: Math.max(0, ...mine.map((p) => p.s ?? 0)),
    average: mine.length ? Math.round(mine.reduce((s, p) => s + (p.s ?? 0), 0) / mine.length) : 0,
    ms: mine.reduce((s, p) => s + (p.ms ?? 0), 0),
    multi: mine.filter((p) => p.sub === 'multi').length,
  }
}

export const xpOf = (list: Play[]) => list.filter((p) => p.g === GAME).reduce((s, p) => s + p.pts, 0)

// Les motifs de territoire de la boutique : ils se débloquent en montant de niveau.
export interface Skin {
  id: string
  name: string
  level: number
  // vrai pour les cases peintes de la teinte secondaire
  at: (x: number, y: number) => boolean
}

export const SKINS: Skin[] = [
  { id: 'uni', name: msg('Uni'), level: 1, at: () => false },
  { id: 'rayures', name: msg('Rayures'), level: 2, at: (x, y) => (x + y) % 6 < 2 },
  { id: 'damier', name: msg('Damier'), level: 3, at: (x, y) => ((x >> 2) + (y >> 2)) % 2 === 0 },
  { id: 'pois', name: msg('Pois'), level: 4, at: (x, y) => ((x % 6) - 2.5) ** 2 + ((y % 6) - 2.5) ** 2 < 2.5 },
  { id: 'grille', name: msg('Grille'), level: 5, at: (x, y) => x % 5 === 0 || y % 5 === 0 },
  { id: 'vagues', name: msg('Vagues'), level: 7, at: (x, y) => (y + Math.round(2 * Math.sin(x / 3)) + 60) % 6 < 2 },
  { id: 'chevrons', name: msg('Chevrons'), level: 10, at: (x, y) => (Math.abs((x % 8) - 4) + y) % 6 < 2 },
  { id: 'ecailles', name: msg('Écailles'), level: 15, at: (x, y) => ((x % 6) - 3) ** 2 + ((y % 4) * 1.5) ** 2 > 9 },
]

export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0]
