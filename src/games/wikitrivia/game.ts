import { shuffle } from '../../lib/util'
import { EVENTS } from '../quiz/facts'

export interface Card {
  name: string
  year: number
}

// Une carte de départ posée sur la frise, puis quinze à placer.
export const DECK = 16
export const LIVES = 3

export function deck(rng: () => number): Card[] {
  return shuffle(
    EVENTS.map(([name, year]) => ({ name, year: Number(year) })),
    rng,
  ).slice(0, DECK)
}

// Frise triée ; la carte va bien à l'emplacement index (avant la carte index) si les années l'encadrent.
// Deux événements de la même année se placent dans un sens comme dans l'autre.
export function fits(timeline: Card[], index: number, card: Card): boolean {
  const before = timeline[index - 1]
  const after = timeline[index]
  return (!before || before.year <= card.year) && (!after || card.year <= after.year)
}

export function sorted(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.year - b.year)
}

export const score = (placed: number) => Math.round((100 * placed) / (DECK - 1))
