import { countryName, flagEmoji } from '../../geo/countries'
import { getWorld } from '../../geo/world'
import { CITY_STATS, COUNTRY_STATS, RANK_LISTS, type CityStats, type CountryStats } from './data'
import { rankBy, rankFromList } from './ranking'
import { msg } from '../../lib/i18n'

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
    byValue('pop', '👥', msg('Population'), (c) => c.pop),
    byValue('area', '🗺️', msg('Superficie'), (c) => c.area),
    byValue('tiny', '🏝️', msg('Minuscule'), (c) => c.area, 'asc'),
    byValue('gdp', '💰', msg('PIB'), (c) => c.gdp),
    byValue('gdpcap', '💎', msg('PIB par habitant'), (c) => (c.gdp && c.pop ? c.gdp / c.pop : 0)),
    byValue('tourism', '✈️', msg('Tourisme'), (c) => c.tourists),
    byValue('football', '⚽', msg('Football'), (c) => c.fifa, 'asc'),
    byValue('peak', '🏔️', msg('Altitude'), (c) => c.peak),
    byValue('forest', '🌳', msg('Forêts'), (c) => c.forest),
    byValue('life', '❤️', msg('Espérance de vie'), (c) => c.life),
    byValue('density', '🏙️', msg('Densité'), (c) => (c.area ? c.pop / c.area : 0)),
    {
      id: 'neighbors',
      icon: '🧭',
      label: msg('Pays voisins'),
      ranks: rankBy(
        COUNTRY_STATS.map((c) => ({ id: c.code, value: neighbors.get(c.code)?.size ?? 0 })),
        'desc',
      ),
    },
    { id: 'coffee', icon: '☕', label: msg('Production de café'), ranks: rankFromList(RANK_LISTS.coffee) },
    { id: 'oil', icon: '🛢️', label: msg('Pétrole'), ranks: rankFromList(RANK_LISTS.oil) },
    { id: 'gas', icon: '⛽', label: msg('Gaz naturel'), ranks: rankFromList(RANK_LISTS.gas) },
    { id: 'medals', icon: '🥇', label: msg('Médailles olympiques'), ranks: rankFromList(RANK_LISTS.medals) },
    { id: 'unesco', icon: '🏛️', label: msg('Patrimoine UNESCO'), ranks: rankFromList(RANK_LISTS.unesco) },
    { id: 'coast', icon: '🏖️', label: msg('Littoral'), ranks: rankFromList(RANK_LISTS.coast) },
    { id: 'nobel', icon: '🎓', label: msg('Prix Nobel'), ranks: rankFromList(RANK_LISTS.nobel) },
    { id: 'corruption', icon: '🕵️', label: msg('Corruption'), ranks: rankFromList(RANK_LISTS.corruption) },
    { id: 'basketball', icon: '🏀', label: msg('Basketball'), ranks: rankFromList(RANK_LISTS.basketball) },
    { id: 'pollution', icon: '🏭', label: msg('Pollution'), ranks: rankFromList(RANK_LISTS.pollution) },
    { id: 'gastronomie', icon: '🍲', label: msg('Gastronomie'), ranks: rankFromList(RANK_LISTS.gastronomie) },
    { id: 'militaire', icon: '🪖', label: msg('Militaire'), ranks: rankFromList(RANK_LISTS.militaire) },
    { id: 'passeport', icon: '🚫', label: msg('Pire passeport'), ranks: rankFromList(RANK_LISTS.passeport) },
    { id: 'idh', icon: '📊', label: msg('Développement humain'), ranks: rankFromList(RANK_LISTS.idh) },
    { id: 'biodiversite', icon: '🦜', label: msg('Biodiversité'), ranks: rankFromList(RANK_LISTS.biodiversite) },
    { id: 'rugby', icon: '🏉', label: msg('Rugby'), ranks: rankFromList(RANK_LISTS.rugby) },
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
    cityCat('pop', '👥', msg('Population'), (c) => c.pop, 'desc'),
    cityCat('heat', '☀️', msg('Chaleur annuelle moyenne'), (c) => c.temp, 'desc', true),
    cityCat('elev', '⛰️', msg('Élévation'), (c) => c.elev, 'desc', true),
    cityCat('gdp', '💰', msg('PIB'), (c) => c.gdp, 'desc'),
    cityCat('rain', '🌧️', msg('Pluie'), (c) => c.rain, 'desc'),
    cityCat('north', '📍', msg('Plus au nord'), (c) => c.lat, 'desc', true),
    cityCat('south', '🧭', msg('Plus au sud'), (c) => c.lat, 'asc', true),
    cityCat('tourism', '📸', msg('Tourisme'), (c) => c.tourists, 'desc'),
  ]
  return cityCats
}

export function cityEntities(): Entity[] {
  return CITY_STATS.map((c) => ({ id: c.name, name: c.name, flag: flagEmoji(c.cc) }))
}
