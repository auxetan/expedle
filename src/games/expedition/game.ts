// L'Expédition : chaque jour, un voyage de 5 à 7 pays, le même pour tout le monde. À chaque frontière, on reconnaît le
// pays pour obtenir son visa et un tampon dans son passeport. Une erreur ne bloque pas le voyage, mais à la troisième
// il s'arrête.
import { flagEmoji } from '../../geo/countries'
import { plural, t } from '../../lib/i18n'
import { seededRng, shuffle } from '../../lib/util'

export type Neighbors = Map<string, Set<string>>

// le voyage : sa route entière, départ et arrivée compris ; le Tour du monde n'a pas d'arrivée et s'invente en chemin
export interface Trip {
  start: string
  end: string
  route: string[]
}

export interface Run {
  // les pays traversés, départ compris ; le dernier est celui où l'on se trouve
  path: string[]
  // la réponse donnée à chaque douane
  picks: string[]
  mistakes: number
}

export type Status = 'en route' | 'arrivé' | 'interrompu'

export const CHANCES = 3

// les voisins, dans un ordre stable pour que tout le monde tire pareil
export const bordersOf = (neighbors: Neighbors, code: string): string[] => [...(neighbors.get(code) ?? [])].sort()

// Le nombre de frontières à passer pour rejoindre chaque pays.
export function hops(neighbors: Neighbors, from: string): Map<string, number> {
  const dist = new Map([[from, 0]])
  const queue = [from]
  for (let i = 0; i < queue.length; i++) {
    for (const n of bordersOf(neighbors, queue[i])) {
      if (dist.has(n)) continue
      dist.set(n, dist.get(queue[i])! + 1)
      queue.push(n)
    }
  }
  return dist
}

// Un plus court chemin, départ et arrivée compris ; à chaque embranchement, la graine choisit la même branche pour tous.
export function route(neighbors: Neighbors, from: string, to: string, rng: () => number = () => 0): string[] {
  const back = hops(neighbors, to)
  if (!back.has(from)) return []
  const path = [from]
  while (path.at(-1) !== to) {
    const at = path.at(-1)!
    const closer = bordersOf(neighbors, at).filter((n) => back.get(n) === back.get(at)! - 1)
    path.push(closer[Math.floor(rng() * closer.length)])
  }
  return path
}

const pick = <T>(list: T[], rng: () => number) => list[Math.floor(rng() * list.length)]

// Le voyage d'un jour : deux pays de régions différentes, à 5 à 7 frontières l'un de l'autre.
export function dailyTrip(neighbors: Neighbors, playable: string[], region: (code: string) => string | null, day: string): Trip {
  const rng = seededRng(`expedition:v2:${day}`)
  const pool = playable.filter((c) => (neighbors.get(c)?.size ?? 0) > 0)
  for (;;) {
    const start = pick(pool, rng)
    const dist = hops(neighbors, start)
    const ends = pool.filter((c) => (dist.get(c) ?? 0) >= 5 && dist.get(c)! <= 7 && region(c) !== region(start))
    if (!ends.length) continue
    const end = pick(ends, rng)
    return { start, end, route: route(neighbors, start, end, rng) }
  }
}

export const tourTrip = (start: string): Trip => ({ start, end: '', route: [start] })

export const startRun = (trip: Trip): Run => ({ path: [trip.start], picks: [], mistakes: 0 })

export const here = (run: Run) => run.path.at(-1)!

// Le pays de la prochaine douane : celui de la route du jour, ou, au Tour du monde, un voisin pas encore visité.
export function nextCountry(neighbors: Neighbors, trip: Trip, run: Run, seed: string): string | null {
  if (trip.end) return trip.route[run.path.length] ?? null
  const around = bordersOf(neighbors, here(run))
  const fresh = around.filter((c) => !run.path.includes(c))
  const list = fresh.length ? fresh : around
  return list.length ? pick(list, seededRng(`${seed}:${run.path.length}`)) : null
}

export function status(trip: Trip, run: Run): Status {
  if (run.mistakes >= CHANCES) return 'interrompu'
  return trip.end && here(run) === trip.end ? 'arrivé' : 'en route'
}

// La réponse à une douane : juste ou fausse, on passe la frontière, sauf quand c'était la dernière chance.
export function answer(run: Run, next: string, picked: string): Run {
  const mistakes = run.mistakes + (picked === next ? 0 : 1)
  return { path: mistakes >= CHANCES ? run.path : [...run.path, next], picks: [...run.picks, picked], mistakes }
}

// les frontières qui restent jusqu'à l'arrivée
export const left = (trip: Trip, run: Run) => (trip.end ? trip.route.length - run.path.length : Infinity)

// Sur 100 : une arrivée en vaut 100, moins 20 par erreur ; un voyage interrompu, la part du chemin faite, jusqu'à 40.
export function score(trip: Trip, run: Run): number {
  if (status(trip, run) === 'arrivé') return 100 - 20 * run.mistakes
  return Math.round((40 * (run.path.length - 1)) / Math.max(1, trip.route.length - 1))
}

export const stars = (trip: Trip, run: Run) => (status(trip, run) === 'arrivé' ? CHANCES - run.mistakes : 0)

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

// Ce que Pépite dit en route : l'arrivée en vue, la dernière chance, le record du Tour du monde à portée.
export function remark(trip: Trip, run: Run, best: number | null): string | null {
  if (status(trip, run) !== 'en route') return null
  if (run.mistakes === CHANCES - 1) return t('Plus qu’une chance !')
  if (!trip.end) {
    const need = best === null ? Infinity : best + 1 - (run.path.length - 1)
    if (need <= 0) return t('Nouveau record !')
    return need <= 3 ? plural(need, 'Encore un tampon pour battre ton record', 'Encore {n} tampons pour battre ton record') : null
  }
  const n = left(trip, run)
  if (n === 1) return t('Dernière frontière !')
  return n <= 3 ? t('Plus que {n} frontières', { n }) : null
}

export function shareText(trip: Trip, run: Run, day: string, name: (code: string) => string): string {
  const [, m, d] = day.split('-')
  const s = stars(trip, run)
  return [
    `🧭 ${t('Expédition du {date}', { date: `${d}/${m}` })} · ${name(trip.start)} → ${name(trip.end)}`,
    `${run.path.map(flagEmoji).join('')} ${status(trip, run) === 'arrivé' ? '🏁' : '⛔'}`,
    `${'★'.repeat(s)}${'☆'.repeat(CHANCES - s)} · ${plural(run.mistakes, '{n} erreur', '{n} erreurs')}`,
    'expedle.com',
  ].join('\n')
}
