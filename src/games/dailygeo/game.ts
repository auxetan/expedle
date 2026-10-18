import { CONTINENT_NAMES, COUNTRY_BY_CODE, flagEmoji } from '../../geo/countries'
import type { World } from '../../geo/world'
import { msg, t } from '../../lib/i18n'
import { normalize, seededRng, shuffle } from '../../lib/util'
import { COUNTRY_STATS } from '../classement/data'
import { formatArea, formatGdp, formatPop } from '../countryle/game'
import { CURRENCIES, LANGUAGES } from '../quiz/facts'
import { pickTarget, targets as worldleTargets } from '../worldle/game'

export const MAX_GUESSES = 6

const STATS = new Map(COUNTRY_STATS.map((s) => [s.code, s]))
const byName = (table: string[][]) => new Map(table.map(([key, value]) => [normalize(key), value]))
const LANGUAGE = byName(LANGUAGES)
const CURRENCY = byName(CURRENCIES)

let pool: string[] | null = null
export function targets(world: World): string[] {
  pool ??= worldleTargets(world).filter((c) => STATS.has(c) && COUNTRY_BY_CODE.get(c)!.capital !== '—')
  return pool
}

export const target = (world: World, seed: string) => pickTarget(targets(world), 'dailygeo-' + seed)

export interface Clue {
  label: string
  value: string
}

// Six indices, du plus vague au plus parlant ; une donnée absente laisse sa place à une autre.
export function clues(code: string): Clue[] {
  const meta = COUNTRY_BY_CODE.get(code)!
  const stats = STATS.get(code)!
  const language = LANGUAGE.get(normalize(meta.name))
  const currency = CURRENCY.get(normalize(meta.name))
  return [
    { label: msg('Continent'), value: t(CONTINENT_NAMES[meta.continent]) },
    { label: msg('Population'), value: formatPop(stats.pop) },
    language ? { label: msg('Langue principale'), value: language } : { label: msg('Superficie'), value: formatArea(stats.area) },
    currency ? { label: msg('Monnaie'), value: currency } : { label: msg('PIB'), value: formatGdp(stats.gdp) },
    { label: msg('Capitale'), value: t('commence par « {letter} »', { letter: meta.capital[0] }) },
    { label: msg('Drapeau'), value: flagEmoji(code) },
  ]
}

// La capitale à retrouver parmi quatre du même continent.
export function capitalChoices(code: string, seed: string): string[] {
  const meta = COUNTRY_BY_CODE.get(code)!
  const rng = seededRng('dailygeo-capitale-' + seed)
  const same = [...COUNTRY_BY_CODE.values()].filter((c) => !c.territory && c.code !== code && c.continent === meta.continent && c.capital !== '—')
  return shuffle([meta.capital, ...shuffle(same, rng).slice(0, 3).map((c) => c.capital)], rng)
}

// Jusqu'à 80 points pour le pays (moins à chaque essai), 20 pour la capitale.
export function score(found: boolean, guesses: number, capital: boolean): number {
  return (found ? Math.round((80 * (MAX_GUESSES + 1 - guesses)) / MAX_GUESSES) : 0) + (capital ? 20 : 0)
}
