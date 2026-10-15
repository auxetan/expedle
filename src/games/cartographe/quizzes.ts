import { COUNTRIES, type Continent } from '../../geo/countries'
import { getWorld } from '../../geo/world'

export type Ask = 'pays' | 'capitales' | 'drapeaux'

export interface Region {
  id: string
  name: string
  continents: Continent[]
  rotate: [number, number]
  box: [[number, number], [number, number]]
  world?: boolean
}

export const REGIONS: Region[] = [
  { id: 'europe', name: 'Europe', continents: ['EU'], rotate: [-15, -52], box: [[-24, 34], [44, 71]] },
  { id: 'afrique', name: 'Afrique', continents: ['AF'], rotate: [-17, -2], box: [[-19, -36], [52, 38]] },
  { id: 'asie', name: 'Asie', continents: ['AS'], rotate: [-88, -30], box: [[26, -11], [148, 55]] },
  { id: 'amerique-nord', name: 'Amérique du Nord', continents: ['NA'], rotate: [96, -38], box: [[-135, 7], [-55, 70]] },
  { id: 'amerique-sud', name: 'Amérique du Sud', continents: ['SA'], rotate: [60, 20], box: [[-82, -56], [-34, 13]] },
  { id: 'oceanie', name: 'Océanie', continents: ['OC'], rotate: [-160, 18], box: [[110, -48], [200, 10]] },
  { id: 'monde', name: 'Monde', continents: ['EU', 'AF', 'AS', 'NA', 'SA', 'OC'], rotate: [-10, 0], box: [[-180, -58], [180, 80]], world: true },
]

export const ASK_LABEL: Record<Ask, string> = { pays: 'les pays', capitales: 'les capitales', drapeaux: 'les drapeaux' }

export function quizId(region: string, ask: Ask): string {
  return ask === 'pays' ? region : `${region}-${ask}`
}

export function parseQuizId(id: string): { region: Region; ask: Ask } | null {
  const [regionId, ask = 'pays'] = id.split(/-(?=capitales$|drapeaux$)/)
  const region = REGIONS.find((r) => r.id === regionId)
  if (!region || !['pays', 'capitales', 'drapeaux'].includes(ask)) return null
  return { region, ask: ask as Ask }
}

export function quizMembers(region: Region): string[] {
  const present = new Set(getWorld().codes)
  return COUNTRIES.filter(
    (c) => !c.territory && present.has(c.code) && region.continents.includes(c.continent) && c.capital !== '—',
  ).map((c) => c.code)
}
