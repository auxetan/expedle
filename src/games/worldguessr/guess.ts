import { COUNTRY_BY_CODE, type Continent } from '../../geo/countries'
import type { World } from '../../geo/world'

export interface Mode {
  id: string
  label: string
  continents: Continent[] | null
  codes?: string[]
  // distance qui fait passer de 5 000 à ~1 800 points, comme le barème de GeoGuessr pour cette carte
  scaleKm: number
  view: { center: [number, number]; zoom: number }
}

export const MODES: Mode[] = [
  { id: 'monde', label: 'Monde', continents: null, scaleKm: 14916, view: { center: [20, 10], zoom: 1 } },
  { id: 'europe', label: 'Europe', continents: ['EU'], scaleKm: 4500, view: { center: [52, 15], zoom: 3 } },
  { id: 'afrique', label: 'Afrique', continents: ['AF'], scaleKm: 8000, view: { center: [2, 18], zoom: 3 } },
  { id: 'asie', label: 'Asie', continents: ['AS'], scaleKm: 9000, view: { center: [32, 90], zoom: 2 } },
  { id: 'ameriques', label: 'Amériques', continents: ['NA', 'SA'], scaleKm: 13000, view: { center: [12, -80], zoom: 2 } },
  { id: 'oceanie', label: 'Océanie', continents: ['OC'], scaleKm: 6000, view: { center: [-22, 150], zoom: 3 } },
  { id: 'france', label: 'France', continents: null, codes: ['FR'], scaleKm: 1300, view: { center: [46.6, 2.4], zoom: 5 } },
]

export function score(km: number, scaleKm: number): number {
  return Math.round(5000 * Math.exp((-10 * km) / scaleKm))
}

// Un pays du mode (et de `allowed` s'il est donné), au prorata de la racine de sa surface :
// la Russie sort plus souvent que Malte, sans écraser le reste du monde.
export function pickCountry(world: World, mode: Mode, rng: () => number, allowed?: Set<string>): string | null {
  const codes = (
    mode.codes ??
    world.codes.filter((c) => {
      const m = COUNTRY_BY_CODE.get(c)
      return m && !m.territory && m.continent !== 'AN' && (!mode.continents || mode.continents.includes(m.continent))
    })
  ).filter((c) => !allowed || allowed.has(c))
  if (!codes.length) return null
  const weights = codes.map((c) => Math.sqrt(world.parts.filter((p) => p.code === c).reduce((s, p) => s + p.area, 0)))
  let r = rng() * weights.reduce((a, b) => a + b, 0)
  return codes[weights.findIndex((w) => (r -= w) <= 0)] ?? codes[0]
}
