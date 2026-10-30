import { COUNTRY_BY_CODE } from '../../geo/countries'
import { countryCenter, distanceKm } from '../../geo/measure'
import type { World } from '../../geo/world'
import { msg } from '../../lib/i18n'
import { due, FACETS, type Facet, type Savoir } from '../../lib/savoir'
import { shuffle } from '../../lib/util'
import { hasFlag } from '../flagle/game'
import { neighborRound } from '../worldle/game'

export const SESSION = 10

export interface Item {
  code: string
  facet: Facet
}

export interface Question extends Item {
  // des codes de pays, ou des capitales
  options: string[]
  answer: string
}

export const PROMPTS: Record<Facet, string> = {
  forme: msg('Quel est ce pays ?'),
  drapeau: msg('À quel pays appartient ce drapeau ?'),
  capitale: msg('Quelle est la capitale de ce pays ?'),
  position: msg('Où se trouve ce pays ?'),
  voisins: msg('Lequel de ces pays est son voisin ?'),
}

// les pays souverains dessinés sur la carte
const nations = (world: World) =>
  world.codes.filter((c) => {
    const meta = COUNTRY_BY_CODE.get(c)
    return meta && !meta.territory && meta.continent !== 'AN'
  })

// Ce qu'on peut demander d'un pays : sa silhouette et sa place s'il est sur la carte, son drapeau s'il est dessiné,
// sa capitale s'il en a une, ses voisins s'il en a.
export function askable(world: World, { code, facet }: Item): boolean {
  const meta = COUNTRY_BY_CODE.get(code)
  if (!meta || meta.territory) return false
  if (facet === 'drapeau') return hasFlag(code)
  if (facet === 'capitale') return meta.capital !== '—'
  if (facet === 'voisins') return (world.neighbors.get(code)?.size ?? 0) > 0
  return world.features.has(code)
}

// Les cartes de la séance : celles à revoir aujourd'hui, les plus fragiles d'abord, un angle après l'autre ; s'il en
// manque, des angles encore jamais demandés des pays déjà rencontrés.
export function pickItems(world: World, book: Savoir, now: number, rng: () => number): Item[] {
  const ready = due(now, book).filter((d) => askable(world, d))
  const queues = shuffle(FACETS, rng).map((facet) => ready.filter((d) => d.facet === facet))
  const items: Item[] = []
  while (items.length < SESSION && queues.some((q) => q.length))
    for (const q of queues) {
      const next = q.shift()
      if (next && items.length < SESSION) items.push({ code: next.code, facet: next.facet })
    }
  const fresh = Object.entries(book).flatMap(([code, cards]) => FACETS.filter((facet) => !cards[facet]).map((facet) => ({ code, facet })))
  return [...items, ...shuffle(fresh, rng).filter((it) => askable(world, it))].slice(0, SESSION)
}

const LETTERS: Record<Facet, string> = { forme: 'f', drapeau: 'd', capitale: 'c', position: 'p', voisins: 'v' }

// Les cartes viennent de celui qui lance le défi : sa graine les emporte (FRd, le drapeau de la France), précédées de
// ce qui tire les choix proposés.
export function encodeSession(items: Item[], salt: string): string {
  return `${salt}:${items.map((it) => it.code + LETTERS[it.facet]).join('.')}`
}

export function decodeSession(seed: string): Item[] {
  return (seed.split(':')[1] ?? '').split('.').flatMap((token) => {
    const facet = FACETS.find((f) => LETTERS[f] === token[2])
    return /^[A-Z]{2}[a-z]$/.test(token) && facet ? [{ code: token.slice(0, 2), facet }] : []
  })
}

// trois leurres, du même continent d'abord : il faut vraiment savoir, pas éliminer
function decoys(pool: string[], code: string, rng: () => number): string[] {
  const continent = COUNTRY_BY_CODE.get(code)!.continent
  const others = pool.filter((c) => c !== code)
  const near = shuffle(others.filter((c) => COUNTRY_BY_CODE.get(c)!.continent === continent), rng)
  const far = shuffle(others.filter((c) => COUNTRY_BY_CODE.get(c)!.continent !== continent), rng)
  return [...near, ...far].slice(0, 3)
}

// trois des six pays les plus proches : la carte montre une région, il faut y reconnaître le bon pays
function nearby(world: World, code: string, rng: () => number): string[] {
  const here = countryCenter(world, code)
  const close = nations(world)
    .filter((c) => c !== code)
    .map((c) => ({ c, km: distanceKm(here, countryCenter(world, c)) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 6)
    .map(({ c }) => c)
  return shuffle(close, rng).slice(0, 3)
}

function question(world: World, { code, facet }: Item, rng: () => number): Question {
  if (facet === 'voisins') {
    const { options, answer } = neighborRound(world, code, PROMPTS.voisins, rng)!
    return { code, facet, options, answer }
  }
  if (facet === 'capitale') {
    const capitalOf = (c: string) => COUNTRY_BY_CODE.get(c)!.capital
    const others = decoys(nations(world).filter((c) => capitalOf(c) !== '—'), code, rng).map(capitalOf)
    return { code, facet, options: shuffle([capitalOf(code), ...others], rng), answer: capitalOf(code) }
  }
  const others = facet === 'position' ? nearby(world, code, rng) : decoys(facet === 'drapeau' ? nations(world).filter(hasFlag) : nations(world), code, rng)
  return { code, facet, options: shuffle([code, ...others], rng), answer: code }
}

export const buildQuestions = (world: World, items: Item[], rng: () => number): Question[] => items.map((it) => question(world, it, rng))
