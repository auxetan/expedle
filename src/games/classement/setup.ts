import { hashString, seededRng, shuffle, todayKey, weekKey } from '../../lib/util'
import { cityCategories, cityEntities, countryCategories, countryEntities, type Category, type Entity } from './categories'
import { COUNTRY_STATS } from './data'
import { MISSING_RANK, optimalAssignment, rankBy } from './ranking'

export type Mode = 'classique' | 'facile' | 'villes' | 'jour' | 'hebdo'

export const MODE_LABEL: Record<Mode, string> = {
  classique: 'Classique',
  facile: 'Facile',
  villes: 'Villes',
  jour: 'Défi du jour',
  hebdo: 'Hebdo',
}

export const WEEKLY_THEMES: { name: string; icon: string; cats: string[] }[] = [
  { name: 'Patrimoine culturel', icon: '🏛️', cats: ['unesco', 'tourism', 'nobel', 'medals', 'football', 'life', 'gdpcap', 'pop'] },
  { name: 'Nature et reliefs', icon: '🏔️', cats: ['peak', 'forest', 'coast', 'area', 'tiny', 'neighbors', 'density', 'coffee'] },
  { name: 'Économie et ressources', icon: '💰', cats: ['gdp', 'gdpcap', 'oil', 'gas', 'coffee', 'tourism', 'pop', 'density'] },
]

export function weeklyTheme(week = weekKey()) {
  return WEEKLY_THEMES[hashString('classement-' + week) % WEEKLY_THEMES.length]
}

// 80 pays parmi les plus connus : meilleurs cumuls de rangs population + PIB
let easyPool: Set<string> | null = null
function easyCodes(): Set<string> {
  if (easyPool) return easyPool
  const pop = rankBy(COUNTRY_STATS.map((c) => ({ id: c.code, value: c.pop })), 'desc')
  const gdp = rankBy(COUNTRY_STATS.map((c) => ({ id: c.code, value: c.gdp })), 'desc')
  const tour = rankBy(COUNTRY_STATS.map((c) => ({ id: c.code, value: c.tourists })), 'desc')
  const score = (code: string) => (pop.get(code) ?? 200) + (gdp.get(code) ?? 200) + (tour.get(code) ?? 200)
  easyPool = new Set([...COUNTRY_STATS].sort((a, b) => score(a.code) - score(b.code)).slice(0, 80).map((c) => c.code))
  return easyPool
}

export interface Setup {
  entities: Entity[]
  categories: Category[]
}

export function setupFor(mode: Mode): Setup {
  if (mode === 'villes') return { entities: shuffle(cityEntities()).slice(0, 8), categories: cityCategories() }
  if (mode === 'hebdo') {
    const rng = seededRng('classement-hebdo-' + weekKey())
    const ids = weeklyTheme().cats
    return {
      entities: shuffle(countryEntities(), rng).slice(0, 8),
      categories: countryCategories().filter((c) => ids.includes(c.id)),
    }
  }
  const rng = mode === 'jour' ? seededRng('classement-' + todayKey()) : Math.random
  const pool = mode === 'facile' ? countryEntities().filter((e) => easyCodes().has(e.id)) : countryEntities()
  return { entities: shuffle(pool, rng).slice(0, 8), categories: shuffle(countryCategories(), rng).slice(0, 8) }
}

export function rankMatrix({ entities, categories }: Setup): number[][] {
  return entities.map((e) => categories.map((c) => Math.min(MISSING_RANK, c.ranks.get(e.id) ?? MISSING_RANK)))
}

export function dailyObjective(): number {
  return optimalAssignment(rankMatrix(setupFor('jour'))).total
}
