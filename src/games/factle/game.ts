import { pick } from '../../lib/util'
import { countryCategories, type Category } from '../classement/categories'

export const SIZE = 5
export const MAX_TRIES = 5

export interface Question {
  category: Category
  // les cinq premiers, du 1er au 5e
  top: string[]
}

export type Mark = 'exact' | 'top' | 'near' | 'far'

// Les classements de GeoHunter dont le haut est net : cinq pays aux rangs 1 à 5, sans ex æquo.
let all: Question[] | null = null
export function questions(): Question[] {
  all ??= countryCategories().flatMap((category) => {
    const top = Array.from({ length: SIZE }, (_, i) => [...category.ranks].filter(([, r]) => r === i + 1).map(([code]) => code))
    return top.every((codes) => codes.length === 1) ? [{ category, top: top.map(([code]) => code) }] : []
  })
  return all
}

export const question = (rng: () => number): Question => pick(questions(), rng)

export function mark(q: Question, position: number, code: string): Mark {
  if (q.top[position] === code) return 'exact'
  if (q.top.includes(code)) return 'top'
  return (q.category.ranks.get(code) ?? Infinity) <= 10 ? 'near' : 'far'
}

// Victoire : 100 points au premier essai, 20 de moins par essai ; défaite : 10 par bonne place trouvée.
export function score(won: boolean, tries: number, exact: number): number {
  return won ? 100 - 20 * (tries - 1) : 10 * exact
}
