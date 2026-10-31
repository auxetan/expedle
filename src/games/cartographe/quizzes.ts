import type { Continent } from '../../geo/countries'
import { msg, t } from '../../lib/i18n'

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

export const ASK_LABEL: Record<Ask, string> = { pays: msg('les pays'), capitales: msg('les capitales'), drapeaux: msg('les drapeaux') }

// La France : ses régions, et ses départements par leur nom, leur numéro ou leur préfecture.
export type FranceAsk = 'regions' | 'departements' | 'numeros' | 'prefectures'

export const FRANCE_ASKS: FranceAsk[] = ['regions', 'departements', 'numeros', 'prefectures']

const FRANCE_LABEL: Record<FranceAsk, string> = {
  regions: msg('les régions'),
  departements: msg('les départements'),
  numeros: msg('les numéros des départements'),
  prefectures: msg('les préfectures'),
}

export function parseFranceId(id: string): FranceAsk | null {
  const ask = id.replace(/^france-/, '') as FranceAsk
  return id.startsWith('france-') && FRANCE_ASKS.includes(ask) ? ask : null
}

// Le titre d'un quiz, dans la langue du site.
export function quizTitle(id: string): string | null {
  const france = parseFranceId(id)
  if (france) return t('{region} : {ask}', { region: t('France'), ask: t(FRANCE_LABEL[france]) })
  const q = parseQuizId(id)
  return q && t('{region} : {ask}', { region: t(q.region.name), ask: t(ASK_LABEL[q.ask]) })
}

export function quizId(region: string, ask: Ask): string {
  return ask === 'pays' ? region : `${region}-${ask}`
}

export function parseQuizId(id: string): { region: Region; ask: Ask } | null {
  const [regionId, ask = 'pays'] = id.split(/-(?=capitales$|drapeaux$)/)
  const region = REGIONS.find((r) => r.id === regionId)
  if (!region || !['pays', 'capitales', 'drapeaux'].includes(ask)) return null
  return { region, ask: ask as Ask }
}
