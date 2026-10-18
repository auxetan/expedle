import { COUNTRIES, COUNTRY_BY_CODE } from '../../geo/countries'
import { compassArrow, countryCenter, distanceKm, rhumbBearing } from '../../geo/measure'
import type { World } from '../../geo/world'
import { msg } from '../../lib/i18n'
import { normalize, seededRng, shuffle } from '../../lib/util'
import { CURRENCIES, LANGUAGES, US_CAPITALS } from '../quiz/facts'

export const MAX_GUESSES = 6
const MAX_KM = 20000

export interface Guess {
  code: string
  km: number
  arrow: string
  proximity: number
}

let pool: string[] | null = null
export function targets(world: World): string[] {
  pool ??= world.codes.filter((c) => {
    const meta = COUNTRY_BY_CODE.get(c)
    return meta && !meta.territory && meta.continent !== 'AN'
  })
  return pool
}

export function dailyTarget(world: World, day: string): string {
  return pickTarget(targets(world), 'worldle-' + day)
}

export function pickTarget(list: string[], key: string): string {
  return list[Math.floor(seededRng(key)() * list.length)]
}

// Comme Worldle : distance entre les centres, cap à la boussole, proximité sur 20 000 km (moins pour une carte plus petite).
export function evaluate(world: World, target: string, code: string, maxKm = MAX_KM): Guess {
  if (code === target) return { code, km: 0, arrow: '🎉', proximity: 100 }
  const from = countryCenter(world, code)
  const to = countryCenter(world, target)
  const km = Math.round(distanceKm(from, to))
  return { code, km, arrow: compassArrow(rhumbBearing(from, to)), proximity: Math.floor((Math.max(0, maxKm - km) / maxKm) * 100) }
}

export function squares(proximity: number): string {
  const green = Math.floor(proximity / 20)
  const yellow = proximity - green * 20 >= 10 ? 1 : 0
  return '🟩'.repeat(green) + '🟨'.repeat(yellow) + '⬜'.repeat(5 - green - yellow)
}

// Manches bonus : retrouver le drapeau, puis la capitale, parmi des voisins du même continent.
export function bonusChoices(target: string, rng: () => number): { flags: string[]; capitals: string[] } {
  const meta = COUNTRY_BY_CODE.get(target)!
  const same = COUNTRIES.filter((c) => !c.territory && c.code !== target && c.continent === meta.continent && c.capital !== '—')
  const others = shuffle(same, rng)
  return {
    flags: shuffle([target, ...others.slice(0, 5).map((c) => c.code)], rng),
    capitals: shuffle([meta.capital, ...others.slice(5, 8).map((c) => c.capital)], rng),
  }
}

// Une manche bonus : une question et ses choix ; un choix est un code de pays (drapeau, voisin) ou un texte.
export interface BonusRound {
  id: string
  question: string
  options: string[]
  answer: string
}

const byName = (table: string[][]) => new Map(table.map(([key, value]) => [normalize(key), value]))

function factRound(id: string, question: string, table: string[][], name: string, rng: () => number): BonusRound | null {
  const answer = byName(table).get(normalize(name))
  if (!answer) return null
  const others = shuffle([...new Set(table.map((row) => row[1]))].filter((v) => v !== answer), rng).slice(0, 3)
  return { id, question, options: shuffle([answer, ...others], rng), answer }
}

// Les leurres sont des voisins de voisins : proches, mais sans frontière commune avec le lieu mystère.
export function neighborRound(world: World, target: string, question: string, rng: () => number): BonusRound | null {
  const next = [...(world.neighbors.get(target) ?? [])]
  if (!next.length) return null
  const answer = next[Math.floor(rng() * next.length)]
  const ring = [...new Set(next.flatMap((c) => [...(world.neighbors.get(c) ?? [])]))].filter((c) => c !== target && !next.includes(c))
  const pool = ring.length >= 3 ? ring : world.codes.filter((c) => c !== target && !next.includes(c))
  return { id: 'neighbor', question, options: shuffle([answer, ...shuffle(pool, rng).slice(0, 3)], rng), answer }
}

export function worldBonus(world: World, target: string, rng: () => number): BonusRound[] {
  const meta = COUNTRY_BY_CODE.get(target)!
  const { flags, capitals } = bonusChoices(target, rng)
  return [
    { id: 'flag', question: msg('Quel est le drapeau de ce pays ?'), options: flags, answer: target },
    { id: 'capital', question: msg('Quelle est sa capitale ?'), options: capitals, answer: meta.capital },
    factRound('currency', msg('Quelle est sa monnaie ?'), CURRENCIES, meta.name, rng),
    factRound('language', msg('Quelle langue y parle-t-on surtout ?'), LANGUAGES, meta.name, rng),
    neighborRound(world, target, msg('Lequel de ces pays est son voisin ?'), rng),
  ].filter((r): r is BonusRound => r !== null)
}

// name : le nom français de l'État, celui des tables de faits.
export function stateBonus(world: World, target: string, name: string, rng: () => number): BonusRound[] {
  return [
    factRound('capital', msg('Quelle est la capitale de cet État ?'), US_CAPITALS, name, rng),
    neighborRound(world, target, msg('Lequel de ces États est son voisin ?'), rng),
  ].filter((r): r is BonusRound => r !== null)
}
