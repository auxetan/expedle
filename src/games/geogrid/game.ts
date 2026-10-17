import { geoBounds } from 'd3-geo'
import { COUNTRY_BY_CODE, type Continent } from '../../geo/countries'
import { countryCenter } from '../../geo/measure'
import { CROSSINGS, type World } from '../../geo/world'
import { normalize, seededRng, shuffle } from '../../lib/util'
import { COUNTRY_STATS, type CountryStats } from '../classement/data'

export const MAX_GUESSES = 9

export interface Facts {
  code: string
  name: string
  continent: Continent
  stats: CountryStats | null
  neighbors: Set<string>
  south: boolean
  equator: boolean
}

export interface Criterion {
  id: string
  label: string
  test: (f: Facts) => boolean
}

// Pays sans accès à la mer (la Caspienne, fermée, ne compte pas comme une mer).
const LANDLOCKED = new Set(
  'AF AD AM AT AZ BY BT BO BW BF BI CF TD CZ SZ ET HU KZ XK KG LA LS LI LU MW ML MD MN NP NE MK PY RW SM RS SK SS CH TJ UG VA ZM ZW UZ TM'.split(' '),
)
const FRANCOPHONE = new Set('FR BE CH LU MC CA HT SN CI ML BF NE TD CM CF CG CD GA GN BJ TG MG KM DJ RW BI SC VU GQ'.split(' '))
const EU = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' '))

const stat = (key: keyof Omit<CountryStats, 'code'>, ok: (v: number) => boolean) => (f: Facts) => !!f.stats && f.stats[key] > 0 && ok(f.stats[key])
const borders = (code: string) => (f: Facts) => f.neighbors.has(code)
const initial = (f: Facts) => normalize(f.name)[0]?.toUpperCase()

// Lignes : où se trouve le pays. Colonnes : ce qu'il est.
export const ROWS: Criterion[] = [
  { id: 'eu', label: 'En Europe', test: (f) => f.continent === 'EU' },
  { id: 'af', label: 'En Afrique', test: (f) => f.continent === 'AF' },
  { id: 'as', label: 'En Asie', test: (f) => f.continent === 'AS' },
  { id: 'am', label: 'Dans les Amériques', test: (f) => f.continent === 'NA' || f.continent === 'SA' },
  { id: 'sud', label: 'Dans l’hémisphère Sud', test: (f) => f.south },
  { id: 'enclave', label: 'Sans accès à la mer', test: (f) => LANDLOCKED.has(f.code) },
  { id: 'ile', label: 'Sans frontière terrestre', test: (f) => f.neighbors.size === 0 },
  { id: 'voisins', label: 'Au moins 5 voisins', test: (f) => f.neighbors.size >= 5 },
  { id: 'ru', label: 'Voisin de la Russie', test: borders('RU') },
  { id: 'cn', label: 'Voisin de la Chine', test: borders('CN') },
  { id: 'br', label: 'Voisin du Brésil', test: borders('BR') },
  { id: 'de', label: 'Voisin de l’Allemagne', test: borders('DE') },
  { id: 'equateur', label: 'Traversé par l’équateur', test: (f) => f.equator },
]

export const COLUMNS: Criterion[] = [
  { id: 'pop-50', label: 'Plus de 50 M d’habitants', test: stat('pop', (v) => v > 50) },
  { id: 'pop-2', label: 'Moins de 2 M d’habitants', test: stat('pop', (v) => v < 2) },
  { id: 'area-1m', label: 'Plus d’1 M de km²', test: stat('area', (v) => v > 1000) },
  { id: 'area-50k', label: 'Moins de 50 000 km²', test: stat('area', (v) => v < 50) },
  { id: 'peak', label: 'Un sommet à plus de 4 000 m', test: stat('peak', (v) => v > 4000) },
  { id: 'forest', label: 'Couvert de forêts à plus de 50 %', test: stat('forest', (v) => v > 50) },
  { id: 'life', label: 'Espérance de vie de plus de 80 ans', test: stat('life', (v) => v > 80) },
  { id: 'gdp', label: 'PIB de plus de 1 000 Md$', test: stat('gdp', (v) => v > 1000) },
  { id: 'tourists', label: 'Plus de 20 M de touristes par an', test: stat('tourists', (v) => v > 20) },
  { id: 'fr', label: 'Le français y est langue officielle', test: (f) => FRANCOPHONE.has(f.code) },
  { id: 'ue', label: 'Membre de l’Union européenne', test: (f) => EU.has(f.code) },
  { id: 'ie', label: 'Nom en « -ie »', test: (f) => normalize(f.name).endsWith('ie') },
  ...['B', 'C', 'M', 'S'].map((l) => ({ id: `lettre-${l}`, label: `Nom qui commence par ${l}`, test: (f: Facts) => initial(f) === l })),
]

const cache = new WeakMap<World, Facts[]>()

export function countryFacts(world: World): Facts[] {
  let list = cache.get(world)
  if (list) return list
  const stats = new Map(COUNTRY_STATS.map((s) => [s.code, s]))
  list = world.codes
    .filter((c) => {
      const m = COUNTRY_BY_CODE.get(c)
      return m && !m.territory && m.continent !== 'AN'
    })
    .map((code) => {
      const meta = COUNTRY_BY_CODE.get(code)!
      // partie par partie : la boîte de la France avec la Réunion « traverserait » l'équateur
      const equator = world.parts.some((p) => {
        if (p.code !== code) return false
        const [[, south], [, north]] = geoBounds(p.feature)
        return south < 0 && north > 0
      })
      const land = [...(world.neighbors.get(code) ?? [])].filter((n) => !CROSSINGS.has(`${code}-${n}`))
      return {
        code,
        name: meta.name,
        continent: meta.continent,
        stats: stats.get(code) ?? null,
        neighbors: new Set(land),
        south: countryCenter(world, code)[1] < 0,
        equator,
      }
    })
  cache.set(world, list)
  return list
}

export interface Grid {
  rows: Criterion[]
  cols: Criterion[]
  // réponses valables de chaque case, ligne par ligne
  answers: string[][]
}

export function answersFor(facts: Facts[], row: Criterion, col: Criterion): string[] {
  return facts.filter((f) => row.test(f) && col.test(f)).map((f) => f.code)
}

// Peut-on remplir les neuf cases avec neuf pays différents ? (couplage par chemins augmentants)
export function solvable(answers: string[][]): boolean {
  const owner = new Map<string, number>()
  const tryCell = (cell: number, seen: Set<string>): boolean => {
    for (const code of answers[cell]) {
      if (seen.has(code)) continue
      seen.add(code)
      const other = owner.get(code)
      if (other === undefined || tryCell(other, seen)) {
        owner.set(code, cell)
        return true
      }
    }
    return false
  }
  return answers.every((_, cell) => tryCell(cell, new Set()))
}

// Trois lignes, trois colonnes, au moins deux réponses par case et une grille complète possible.
export function makeGrid(world: World, seed: string): Grid {
  const facts = countryFacts(world)
  const rng = seededRng('geogrid-' + seed)
  for (;;) {
    const rows = shuffle(ROWS, rng).slice(0, 3)
    const cols = shuffle(COLUMNS, rng).slice(0, 3)
    const answers = rows.flatMap((r) => cols.map((c) => answersFor(facts, r, c)))
    if (answers.every((a) => a.length >= 2) && solvable(answers)) return { rows, cols, answers }
  }
}

export type Check = 'ok' | 'wrong' | 'used'

export function check(grid: Grid, cells: (string | null)[], cell: number, code: string): Check {
  if (cells.includes(code)) return 'used'
  return grid.answers[cell].includes(code) ? 'ok' : 'wrong'
}

export const score = (cells: (string | null)[]) => Math.round((100 * cells.filter(Boolean).length) / 9)
