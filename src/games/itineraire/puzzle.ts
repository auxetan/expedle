import { COUNTRIES, COUNTRY_BY_CODE } from '../../geo/countries'
import { distancesFrom, guessLimit } from '../../geo/graph'
import { getWorld } from '../../geo/world'
import { normalize, pick } from '../../lib/util'

export interface Puzzle {
  start: string
  end: string
  shortest: number
  maxGuesses: number
}

function candidates(): string[] {
  const w = getWorld()
  return w.codes.filter((c) => w.neighbors.has(c) && !COUNTRY_BY_CODE.get(c)?.territory)
}

export function makePuzzle(rng: () => number, minLen: number, maxLen: number): Puzzle {
  const w = getWorld()
  const pool = candidates()
  for (let attempt = 0; attempt < 200; attempt++) {
    const start = pick(pool, rng)
    const dist = distancesFrom(w.graph, start)
    const ends = pool.filter((c) => {
      const d = dist.get(c)
      return d !== undefined && d >= minLen && d <= maxLen
    })
    if (!ends.length) continue
    const end = pick(ends, rng)
    const shortest = dist.get(end)!
    return { start, end, shortest, maxGuesses: guessLimit(shortest) }
  }
  throw new Error('Aucun trajet trouvé')
}

export function puzzleFor(start: string, end: string): Puzzle | null {
  const d = distancesFrom(getWorld().graph, start).get(end)
  if (d === undefined || start === end) return null
  return { start, end, shortest: d, maxGuesses: guessLimit(d) }
}

export interface Suggestion {
  code: string
  label: string
  keys: string[]
}

let suggestionCache: Suggestion[] | null = null
export function allSuggestions(): Suggestion[] {
  if (suggestionCache) return suggestionCache
  const present = new Set(getWorld().codes)
  suggestionCache = COUNTRIES.filter((c) => present.has(c.code)).map((c) => ({
    code: c.code,
    label: c.name,
    keys: [c.name, ...c.aliases].map(normalize),
  }))
  return suggestionCache
}

export function matchSuggestions(query: string, limit = 6): { s: Suggestion; at: number }[] {
  const q = normalize(query)
  if (!q) return []
  const out: { s: Suggestion; at: number; key: number; alias: boolean }[] = []
  for (const s of allSuggestions()) {
    let best = -1
    let alias = false
    s.keys.forEach((k, i) => {
      const at = k.indexOf(q)
      if (at >= 0 && (best < 0 || at < best)) {
        best = at
        alias = i > 0
      }
    })
    if (best >= 0) out.push({ s, at: alias ? -1 : best, key: best, alias })
  }
  out.sort((a, b) => a.key - b.key || a.s.label.localeCompare(b.s.label, 'fr'))
  return out.slice(0, limit).map(({ s, at }) => ({ s, at }))
}

export function exactMatch(query: string): Suggestion | undefined {
  const q = normalize(query)
  return allSuggestions().find((s) => s.keys.includes(q))
}
