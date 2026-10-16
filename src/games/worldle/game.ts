import { COUNTRIES, COUNTRY_BY_CODE } from '../../geo/countries'
import { compassArrow, countryCenter, distanceKm, rhumbBearing } from '../../geo/measure'
import type { World } from '../../geo/world'
import { seededRng, shuffle } from '../../lib/util'

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
  const list = targets(world)
  return list[Math.floor(seededRng('worldle-' + day)() * list.length)]
}

// Comme Worldle : distance entre les centres, cap à la boussole, proximité sur 20 000 km.
export function evaluate(world: World, target: string, code: string): Guess {
  if (code === target) return { code, km: 0, arrow: '🎉', proximity: 100 }
  const from = countryCenter(world, code)
  const to = countryCenter(world, target)
  const km = Math.round(distanceKm(from, to))
  return { code, km, arrow: compassArrow(rhumbBearing(from, to)), proximity: Math.floor((Math.max(0, MAX_KM - km) / MAX_KM) * 100) }
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
