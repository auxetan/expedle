import type { World } from '../../geo/world'
import { seededRng, shuffle } from '../../lib/util'
import { targets as worldleTargets } from '../worldle/game'

export const MAX_GUESSES = 6
export const TILES = 6

// Les drapeaux de flag-icons (MIT), un fichier par pays, chargé seulement quand on en a besoin.
const FLAGS = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', { query: '?url', import: 'default' })
const keyOf = (code: string) => `/node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`

export const hasFlag = (code: string) => keyOf(code) in FLAGS
export const flagUrl = (code: string): Promise<string> => FLAGS[keyOf(code)]()

let pool: string[] | null = null
export function targets(world: World): string[] {
  pool ??= worldleTargets(world).filter(hasFlag)
  return pool
}

export function dailyTarget(world: World, day: string): string {
  const list = targets(world)
  return list[Math.floor(seededRng('flagle-' + day)() * list.length)]
}

// Ordre dans lequel les tuiles tombent, le même pour tout le monde un jour donné.
export function revealOrder(seed: string): number[] {
  return shuffle(
    Array.from({ length: TILES }, (_, i) => i),
    seededRng('flagle-tiles-' + seed),
  )
}

// Une tuile visible au départ, une de plus à chaque erreur ; tout le drapeau à la fin.
export function visibleTiles(wrong: number, over: boolean): number {
  return over ? TILES : Math.min(TILES, 1 + wrong)
}

// une victoire sur l'essai bonus d'un joker compte comme sur le dernier essai
export const score = (won: boolean, guesses: number) => (won ? Math.round((100 * (MAX_GUESSES + 1 - Math.min(guesses, MAX_GUESSES))) / MAX_GUESSES) : 0)
