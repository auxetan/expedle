import { countryName, flagEmoji } from '../../geo/countries'
import { getWorld } from '../../geo/world'
import { CITY_STATS, COUNTRY_STATS, RANK_LISTS, type CityStats, type CountryStats } from './data'
import { rankBy, rankFromList } from './ranking'

export interface Entity {
  id: string
  name: string
  flag: string
}

export interface Category {
  id: string
  icon: string
  label: string
  ranks: Map<string, number>
}

function byValue(
  id: string,
  icon: string,
  label: string,
  value: (c: CountryStats) => number,
  dir: 'asc' | 'desc' = 'desc',
): Category {
  return { id, icon, label, ranks: rankBy(COUNTRY_STATS.map((c) => ({ id: c.code, value: value(c) })), dir) }
}

let countryCats: Category[] | null = null
export function countryCategories(): Category[] {
  if (countryCats) return countryCats
  const neighbors = getWorld().neighbors
  countryCats = [
    byValue('pop', '👥', 'Population', (c) => c.pop),
    byValue('area', '🗺️', 'Superficie', (c) => c.area),
    byValue('tiny', '🏝️', 'Minuscule', (c) => c.area, 'asc'),
    byValue('gdp', '💰', 'PIB', (c) => c.gdp),
    byValue('gdpcap', '💎', 'PIB par habitant', (c) => (c.gdp && c.pop ? c.gdp / c.pop : 0)),
    byValue('tourism', '✈️', 'Tourisme', (c) => c.tourists),
    byValue('football', '⚽', 'Football', (c) => c.fifa, 'asc'),
    byValue('peak', '🏔️', 'Altitude', (c) => c.peak),
    byValue('forest', '🌳', 'Forêts', (c) => c.forest),
    byValue('life', '❤️', 'Espérance de vie', (c) => c.life),
    byValue('density', '🏙️', 'Densité', (c) => (c.area ? c.pop / c.area : 0)),
    {
      id: 'neighbors',
      icon: '🧭',
      label: 'Pays voisins',
      ranks: rankBy(
        COUNTRY_STATS.map((c) => ({ id: c.code, value: neighbors.get(c.code)?.size ?? 0 })),
        'desc',
      ),
    },
    { id: 'coffee', icon: '☕', label: 'Production de café', ranks: rankFromList(RANK_LISTS.coffee) },
    { id: 'oil', icon: '🛢️', label: 'Pétrole', ranks: rankFromList(RANK_LISTS.oil) },
    { id: 'gas', icon: '⛽', label: 'Gaz naturel', ranks: rankFromList(RANK_LISTS.gas) },
    { id: 'medals', icon: '🥇', label: 'Médailles olympiques', ranks: rankFromList(RANK_LISTS.medals) },
    { id: 'unesco', icon: '🏛️', label: 'Patrimoine UNESCO', ranks: rankFromList(RANK_LISTS.unesco) },
    { id: 'coast', icon: '🏖️', label: 'Littoral', ranks: rankFromList(RANK_LISTS.coast) },
    { id: 'nobel', icon: '🎓', label: 'Prix Nobel', ranks: rankFromList(RANK_LISTS.nobel) },
  ]
  return countryCats
}

export function countryEntities(): Entity[] {
  return COUNTRY_STATS.map((c) => ({ id: c.code, name: countryName(c.code), flag: flagEmoji(c.code) }))
}

function cityCat(id: string, icon: string, label: string, value: (c: CityStats) => number, dir: 'asc' | 'desc', any = false): Category {
  return {
    id,
    icon,
    label,
    ranks: rankBy(
      CITY_STATS.map((c) => ({ id: c.name, value: value(c) })),
      dir,
      any ? () => true : undefined,
    ),
  }
}

let cityCats: Category[] | null = null
export function cityCategories(): Category[] {
  cityCats ??= [
    cityCat('pop', '👥', 'Population', (c) => c.pop, 'desc'),
    cityCat('heat', '☀️', 'Chaleur annuelle moyenne', (c) => c.temp, 'desc', true),
    cityCat('elev', '⛰️', 'Élévation', (c) => c.elev, 'desc', true),
    cityCat('gdp', '💰', 'PIB', (c) => c.gdp, 'desc'),
    cityCat('rain', '🌧️', 'Pluie', (c) => c.rain, 'desc'),
    cityCat('north', '📍', 'Plus au nord', (c) => c.lat, 'desc', true),
    cityCat('south', '🧭', 'Plus au sud', (c) => c.lat, 'asc', true),
    cityCat('tourism', '📸', 'Tourisme', (c) => c.tourists, 'desc'),
  ]
  return cityCats
}

export function cityEntities(): Entity[] {
  return CITY_STATS.map((c) => ({ id: c.name, name: c.name, flag: flagEmoji(c.cc) }))
}
