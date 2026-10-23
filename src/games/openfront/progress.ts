// Le niveau et les statistiques de Frontières, tirés des parties enregistrées dans ce navigateur.
import { msg } from '../../lib/i18n'
import type { Play } from '../../lib/stats'
import { load } from '../../lib/util'

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

// Les capsules, la monnaie d'OpenFront qu'on gagne en jouant : chaque partie en rapporte, une victoire bien plus,
// une partie en ligne le double ; chaque niveau gagné en offre cent de plus. Elles ne s'achètent pas.
export const capsOf = (p: Play) => (p.win ? 50 : 10) * (p.sub === 'multi' ? 2 : 1)

const LEVEL_CAPS = 100

export function earnedOf(list: Play[]): number {
  const mine = list.filter((p) => p.g === GAME)
  return mine.reduce((s, p) => s + capsOf(p), 0) + LEVEL_CAPS * (rankOf(xpOf(mine)).level - 1)
}

// Ce qu'il reste à dépenser, une fois payés les motifs achetés.
export const balanceOf = (list: Play[], owned: string[]) => earnedOf(list) - owned.reduce((s, id) => s + (SKINS.find((k) => k.id === id)?.price ?? 0), 0)

// Les motifs de territoire de la boutique, payés en capsules.
export interface Skin {
  id: string
  name: string
  price: number
  // vrai pour les cases peintes de la teinte secondaire
  at: (x: number, y: number) => boolean
}

export const SKINS: Skin[] = [
  { id: 'uni', name: msg('Uni'), price: 0, at: () => false },
  { id: 'rayures', name: msg('Rayures'), price: 150, at: (x, y) => (x + y) % 6 < 2 },
  { id: 'damier', name: msg('Damier'), price: 250, at: (x, y) => ((x >> 2) + (y >> 2)) % 2 === 0 },
  { id: 'pois', name: msg('Pois'), price: 400, at: (x, y) => ((x % 6) - 2.5) ** 2 + ((y % 6) - 2.5) ** 2 < 2.5 },
  { id: 'grille', name: msg('Grille'), price: 600, at: (x, y) => x % 5 === 0 || y % 5 === 0 },
  { id: 'briques', name: msg('Briques'), price: 800, at: (x, y) => y % 4 === 0 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0 },
  { id: 'vagues', name: msg('Vagues'), price: 1000, at: (x, y) => (y + Math.round(2 * Math.sin(x / 3)) + 60) % 6 < 2 },
  { id: 'losanges', name: msg('Losanges'), price: 1200, at: (x, y) => Math.abs((x % 8) - 3.5) + Math.abs((y % 8) - 3.5) < 2 },
  { id: 'chevrons', name: msg('Chevrons'), price: 1500, at: (x, y) => (Math.abs((x % 8) - 4) + y) % 6 < 2 },
  { id: 'ecailles', name: msg('Écailles'), price: 2000, at: (x, y) => ((x % 6) - 3) ** 2 + ((y % 4) * 1.5) ** 2 > 9 },
]

export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0]

export const loadOwned = () => load<string[]>('openfront-achats', [])

// le motif porté, s'il est toujours à soi
export function loadSkin() {
  const id = load<string>('openfront-motif', 'uni')
  return skinById(id).price === 0 || loadOwned().includes(id) ? id : 'uni'
}
