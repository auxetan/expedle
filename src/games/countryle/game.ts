import { CONTINENT_NAMES, COUNTRY_BY_CODE } from '../../geo/countries'
import { compassArrow, countryCenter, distanceKm, rhumbBearing } from '../../geo/measure'
import type { World } from '../../geo/world'
import { seededRng } from '../../lib/util'
import { COUNTRY_STATS } from '../classement/data'
import { locale, t } from '../../lib/i18n'

export const MAX_GUESSES = 8

const STATS = new Map(COUNTRY_STATS.map((s) => [s.code, s]))

export type Heat = 'hit' | 'near' | 'far'

export interface Clue {
  value: number | null
  // le pays mystère est plus grand (up) ou plus petit (down) que la proposition
  trend: 'up' | 'down' | null
  heat: Heat
}

export interface Row {
  code: string
  continent: { label: string; hit: boolean }
  hemisphere: { label: 'Nord' | 'Sud'; hit: boolean }
  pop: Clue
  area: Clue
  gdp: Clue
  km: number
  arrow: string
}

let pool: string[] | null = null

// Pays souverains dont on connaît population, superficie et PIB.
export function targets(world: World): string[] {
  pool ??= world.codes.filter((c) => {
    const meta = COUNTRY_BY_CODE.get(c)
    const s = STATS.get(c)
    return meta && !meta.territory && meta.continent !== 'AN' && s && s.pop > 0 && s.area > 0 && s.gdp > 0
  })
  return pool
}

export function dailyTarget(world: World, day: string): string {
  const list = targets(world)
  return list[Math.floor(seededRng('countryle-' + day)() * list.length)]
}

// À 10 % près c'est gagné (vert), dans un facteur 2 c'est proche (jaune).
export function compare(guess: number | undefined, target: number): Clue {
  if (!guess) return { value: null, trend: null, heat: 'far' }
  const ratio = guess / target
  const heat: Heat = ratio >= 0.9 && ratio <= 1.1 ? 'hit' : ratio >= 0.5 && ratio <= 2 ? 'near' : 'far'
  return { value: guess, trend: guess === target ? null : target > guess ? 'up' : 'down', heat }
}

const hemisphereOf = (world: World, code: string): 'Nord' | 'Sud' => (countryCenter(world, code)[1] >= 0 ? 'Nord' : 'Sud')

export function evaluate(world: World, target: string, code: string): Row {
  const t = STATS.get(target)!
  const g = STATS.get(code)
  const tc = COUNTRY_BY_CODE.get(target)!.continent
  const gc = COUNTRY_BY_CODE.get(code)?.continent
  const from = countryCenter(world, code)
  const to = countryCenter(world, target)
  const won = code === target
  return {
    code,
    continent: { label: gc ? CONTINENT_NAMES[gc] : '—', hit: gc === tc },
    hemisphere: { label: hemisphereOf(world, code), hit: hemisphereOf(world, code) === hemisphereOf(world, target) },
    pop: compare(g?.pop, t.pop),
    area: compare(g?.area, t.area),
    gdp: compare(g?.gdp, t.gdp),
    km: won ? 0 : Math.round(distanceKm(from, to)),
    arrow: won ? '🎯' : compassArrow(rhumbBearing(from, to)),
  }
}

const HEAT_SQUARE: Record<Heat, string> = { hit: '🟩', near: '🟨', far: '⬜' }

export function shareLine(r: Row): string {
  const yesNo = (hit: boolean) => (hit ? '🟩' : '⬜')
  return [yesNo(r.continent.hit), yesNo(r.hemisphere.hit), HEAT_SQUARE[r.pop.heat], HEAT_SQUARE[r.area.heat], HEAT_SQUARE[r.gdp.heat]].join('') + r.arrow
}

// une victoire sur l'essai bonus d'un joker compte comme sur le dernier essai
export const score = (won: boolean, guesses: number) => (won ? Math.round((100 * (MAX_GUESSES + 1 - Math.min(guesses, MAX_GUESSES))) / MAX_GUESSES) : 0)

// Population en millions, superficie en milliers de km², PIB en milliards de dollars.
export function formatPop(m: number): string {
  if (m >= 1000) return t('{n} Md', { n: (m / 1000).toLocaleString(locale(), { maximumFractionDigits: 2 }) })
  if (m >= 1) return t('{n} M', { n: m.toLocaleString(locale(), { maximumFractionDigits: 1 }) })
  return t('{n} k', { n: Math.round(m * 1000).toLocaleString(locale()) })
}

export function formatArea(k: number): string {
  return `${Math.round(k * 1000).toLocaleString(locale())} km²`
}

export function formatGdp(md: number): string {
  return t('{n} Md$', { n: md.toLocaleString(locale(), { maximumFractionDigits: md < 10 ? 1 : 0 }) })
}
