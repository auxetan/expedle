// L'Expédition : chaque jour, relier deux pays par la terre en passant les frontières. Pour entrer dans un pays, il faut
// le reconnaître à la douane ; chaque frontière coûte un vivre, chaque erreur deux. Une frontière fermée et une réserve
// de vivres, tirées de la même graine, font de chaque journée une expédition dont tout le monde parle.
import { flagEmoji } from '../../geo/countries'
import { t } from '../../lib/i18n'
import { seededRng, shuffle } from '../../lib/util'

export type Neighbors = Map<string, Set<string>>
export type Edge = [string, string]

export interface Expedition {
  start: string
  // vide pour le Tour du monde, qui n'a pas de destination
  end: string
  // la frontière fermée du jour, sur le meilleur chemin : tout le monde fait le même détour
  closed: Edge | null
  // un pays un peu à l'écart du chemin, où l'on trouve des vivres en entrant
  cache: string | null
  // les frontières du meilleur chemin, fermeture comprise
  optimal: number
  supplies: number
}

export interface Run {
  // les pays traversés depuis le départ, compris ; le dernier est celui où l'on se trouve
  path: string[]
  supplies: number
  // les pays dont le nom s'est révélé après une erreur à la douane
  revealed: string[]
  misses: number
  customs: { asked: number; ok: number }
  cacheTaken: boolean
}

export type Status = 'en route' | 'arrivé' | 'bloqué'

const STEP_COST = 1
const MISS_COST = 2
const CACHE_GAIN = 2
// des vivres en plus du meilleur chemin : de quoi se tromper deux fois et demie
const SPARE = 5
const CUSTOMS_EVERY = 3
export const TOUR_SUPPLIES = 8

export const closedBetween = (closed: Edge | null, a: string, b: string) => !!closed && ((closed[0] === a && closed[1] === b) || (closed[0] === b && closed[1] === a))

// les voisins par lesquels on peut passer, dans un ordre stable pour que tout le monde tire pareil
export const bordersOf = (neighbors: Neighbors, code: string, closed: Edge | null = null): string[] =>
  [...(neighbors.get(code) ?? [])].filter((n) => !closedBetween(closed, code, n)).sort()

// Le nombre de frontières à passer pour rejoindre chaque pays.
export function hops(neighbors: Neighbors, from: string, closed: Edge | null = null): Map<string, number> {
  const dist = new Map([[from, 0]])
  const queue = [from]
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]
    for (const n of bordersOf(neighbors, c, closed)) {
      if (dist.has(n)) continue
      dist.set(n, dist.get(c)! + 1)
      queue.push(n)
    }
  }
  return dist
}

// Un meilleur chemin, départ et arrivée compris.
export function route(neighbors: Neighbors, from: string, to: string, closed: Edge | null = null): string[] {
  const back = hops(neighbors, to, closed)
  if (!back.has(from)) return []
  const path = [from]
  while (path.at(-1) !== to) path.push(bordersOf(neighbors, path.at(-1)!, closed).find((n) => back.get(n) === back.get(path.at(-1)!)! - 1)!)
  return path
}

const pick = <T>(list: T[], rng: () => number) => list[Math.floor(rng() * list.length)]

// L'expédition d'un jour : deux pays de régions différentes, à 7 à 11 frontières l'un de l'autre.
export function dailyExpedition(neighbors: Neighbors, playable: string[], region: (code: string) => string | null, day: string): Expedition {
  const rng = seededRng(`expedition:${day}`)
  const pool = playable.filter((c) => (neighbors.get(c)?.size ?? 0) > 0)
  for (;;) {
    const start = pick(pool, rng)
    const dist = hops(neighbors, start)
    const ends = pool.filter((c) => (dist.get(c) ?? 0) >= 7 && dist.get(c)! <= 11 && region(c) !== region(start))
    if (!ends.length) continue
    const end = pick(ends, rng)
    const best = route(neighbors, start, end)
    // fermer une frontière du meilleur chemin quand le détour reste raisonnable (3 frontières au plus)
    let closed: Edge | null = null
    for (const i of shuffle([...best.keys()].slice(1), rng)) {
      const edge: Edge = [best[i - 1], best[i]]
      const detour = hops(neighbors, start, edge).get(end)
      if (detour !== undefined && detour > dist.get(end)! && detour <= dist.get(end)! + 3) {
        closed = edge
        break
      }
    }
    const fromStart = hops(neighbors, start, closed)
    const fromEnd = hops(neighbors, end, closed)
    const optimal = fromStart.get(end)!
    // une réserve qui vaut un petit détour : un ou deux pas de plus pour deux vivres
    const caches = pool.filter((c) => {
      const via = (fromStart.get(c) ?? Infinity) + (fromEnd.get(c) ?? Infinity)
      return c !== start && c !== end && via > optimal && via <= optimal + 2
    })
    return { start, end, closed, cache: caches.length ? pick(caches, rng) : null, optimal, supplies: optimal + SPARE }
  }
}

// Le Tour du monde : un départ au hasard, pas de destination, autant de pays que possible.
export const tourExpedition = (start: string): Expedition => ({ start, end: '', closed: null, cache: null, optimal: 0, supplies: TOUR_SUPPLIES })

export const startRun = (exp: Expedition): Run => ({ path: [exp.start], supplies: exp.supplies, revealed: [], misses: 0, customs: { asked: 0, ok: 0 }, cacheTaken: false })

export const here = (run: Run) => run.path.at(-1)!

// un pays déjà traversé ou révélé se passe sans douane
export const known = (run: Run, code: string) => run.path.includes(code) || run.revealed.includes(code)

export function status(exp: Expedition, run: Run): Status {
  if (exp.end && here(run) === exp.end) return 'arrivé'
  return run.supplies <= 0 ? 'bloqué' : 'en route'
}

// Une frontière passée.
export function cross(exp: Expedition, run: Run, to: string): Run {
  const cache = to === exp.cache && !run.cacheTaken
  return { ...run, path: [...run.path, to], supplies: run.supplies - STEP_COST + (cache ? CACHE_GAIN : 0), cacheTaken: run.cacheTaken || cache }
}

// Une erreur à la douane : le pays se révèle, on reste où l'on est.
export const miss = (run: Run, to: string): Run => ({ ...run, supplies: run.supplies - MISS_COST, revealed: [...run.revealed, to], misses: run.misses + 1 })

// les pays différents traversés, départ compris
export const visited = (run: Run) => new Set(run.path).size

// une question de douane renforcée toutes les trois frontières passées
export const customsDue = (run: Run) => Math.floor((run.path.length - 1) / CUSTOMS_EVERY) > run.customs.asked

export const answerCustoms = (run: Run, ok: boolean): Run => ({
  ...run,
  supplies: run.supplies + (ok ? 1 : 0),
  customs: { asked: run.customs.asked + 1, ok: run.customs.ok + (ok ? 1 : 0) },
})

// Sur 100 : l'arrivée en vaut 50, chaque vivre gardé (jusqu'à 5) 10 de plus ; en panne, la part du chemin faite, jusqu'à 40.
export function score(neighbors: Neighbors, exp: Expedition, run: Run): number {
  if (status(exp, run) === 'arrivé') return 50 + 10 * Math.min(5, Math.max(0, run.supplies))
  const left = hops(neighbors, here(run), exp.closed).get(exp.end) ?? exp.optimal
  return Math.round(40 * Math.max(0, 1 - left / exp.optimal))
}

export function stars(exp: Expedition, run: Run): number {
  if (status(exp, run) !== 'arrivé') return 0
  return run.supplies >= 5 ? 3 : run.supplies >= 3 ? 2 : 1
}

// Quatre noms à la douane : le bon, d'autres voisins du pays d'où l'on vient, puis des pays proches ou de la même région.
export function choices(neighbors: Neighbors, region: (code: string) => string | null, pool: string[], from: string, to: string, rng: () => number): string[] {
  const out = [to]
  const add = (list: string[]) => {
    for (const c of shuffle(list, rng)) if (out.length < 4 && !out.includes(c)) out.push(c)
  }
  add(bordersOf(neighbors, from).filter((c) => c !== to).slice(0, 2))
  add(bordersOf(neighbors, to).filter((c) => c !== from))
  add(pool.filter((c) => region(c) === region(to)))
  add(pool)
  return shuffle(out, rng)
}

export type CustomsQuestion = { kind: 'capitale'; options: string[]; answer: string } | { kind: 'population'; than: string; answer: 'plus' | 'moins' }

// La douane renforcée, sur le pays où l'on vient d'entrer : sa capitale parmi quatre, ou s'il est plus peuplé que le
// pays d'où l'on vient (quand on connaît les deux populations).
export function customsQuestion(
  code: string,
  prev: string,
  pool: string[],
  region: (code: string) => string | null,
  capital: (code: string) => string,
  pop: (code: string) => number | undefined,
  rng: () => number,
): CustomsQuestion {
  const [a, b] = [pop(code), pop(prev)]
  if (rng() >= 0.5 && a && b && a !== b) return { kind: 'population', than: prev, answer: a > b ? 'plus' : 'moins' }
  const answer = capital(code)
  const options = [answer]
  const others = shuffle(pool.filter((c) => c !== code && region(c) === region(code)), rng).concat(shuffle(pool.filter((c) => c !== code), rng))
  for (const c of others) if (options.length < 4 && capital(c) && !options.includes(capital(c))) options.push(capital(c))
  return { kind: 'capitale', options: shuffle(options, rng), answer }
}

export function shareText(exp: Expedition, run: Run, day: string, name: (code: string) => string): string {
  const [, m, d] = day.split('-')
  const done = status(exp, run) === 'arrivé'
  const crossed = run.path.length - 1
  return [
    `🧭 ${t('Expédition du {date}', { date: `${d}/${m}` })} · ${name(exp.start)} → ${name(exp.end)}`,
    `${run.path.map(flagEmoji).join('')} ${done ? '🏁' : `⛺ ${name(here(run))}`}`,
    `${t('{n} frontières (record possible {best})', { n: crossed, best: exp.optimal })} · 🎒 ${Math.max(0, run.supplies)}`,
    'expedle.com',
  ].join('\n')
}
