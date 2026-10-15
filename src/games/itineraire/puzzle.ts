import type { Atlas, AtlasId } from '../../geo/atlas'
import { distancesFrom, filterGraph, guessLimit, type Graph } from '../../geo/graph'
import { normalize, pick } from '../../lib/util'

export type Extra = 'defaut' | 'aucun' | 'illimite'

export interface RouteRules {
  region?: string | null
  avoid?: string | null
  extra?: Extra
}

export interface Puzzle extends RouteRules {
  atlas: AtlasId
  start: string
  end: string
  shortest: number
  maxGuesses: number
}

export function routeGraph(atlas: Atlas, rules: RouteRules): Graph {
  if (!rules.region && !rules.avoid) return atlas.graph
  return filterGraph(atlas.graph, (c) => (!rules.region || atlas.region(c) === rules.region) && c !== rules.avoid)
}

function limit(shortest: number, extra: Extra = 'defaut'): number {
  if (extra === 'aucun') return shortest
  if (extra === 'illimite') return Infinity
  return guessLimit(shortest)
}

export function makePuzzle(
  atlas: Atlas,
  rng: () => number,
  minLen: number,
  maxLen: number,
  rules: RouteRules & { start?: string | null; end?: string | null } = {},
): Puzzle | null {
  const { start: fixedStart, end: fixedEnd, ...routeRules } = rules
  const g = routeGraph(atlas, routeRules)
  const pool = atlas.playable.filter((c) => (!rules.region || atlas.region(c) === rules.region) && c !== rules.avoid)
  for (let attempt = 0; attempt < 200; attempt++) {
    const start = fixedStart ?? pick(pool, rng)
    const dist = distancesFrom(g, start)
    const ends = fixedEnd
      ? [fixedEnd].filter((c) => dist.has(c))
      : pool.filter((c) => {
          const d = dist.get(c)
          return d !== undefined && d >= minLen && d <= maxLen
        })
    if (!ends.length) {
      if (fixedStart) return null
      continue
    }
    const end = pick(ends, rng)
    const shortest = dist.get(end)!
    return { atlas: atlas.id, start, end, shortest, maxGuesses: limit(shortest, routeRules.extra), ...routeRules }
  }
  return null
}

export function puzzleFor(atlas: Atlas, start: string, end: string, rules: RouteRules = {}): Puzzle | null {
  if (start === end) return null
  const d = distancesFrom(routeGraph(atlas, rules), start).get(end)
  if (d === undefined) return null
  return { atlas: atlas.id, start, end, shortest: d, maxGuesses: limit(d, rules.extra), ...rules }
}

export interface Suggestion {
  code: string
  label: string
  keys: string[]
}

const suggestionCache = new Map<AtlasId, Suggestion[]>()
export function allSuggestions(atlas: Atlas): Suggestion[] {
  const cached = suggestionCache.get(atlas.id)
  if (cached) return cached
  const list = atlas.codes
    .map((code) => ({ code, label: atlas.name(code), keys: [atlas.name(code), ...atlas.aliases(code)].map(normalize) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  suggestionCache.set(atlas.id, list)
  return list
}

// D'abord les noms qui commencent par la saisie, puis ceux qui la contiennent ; tout est listé.
export function matchSuggestions(atlas: Atlas, query: string): { s: Suggestion; at: number }[] {
  const q = normalize(query)
  if (!q) return []
  const out: { s: Suggestion; at: number; group: number }[] = []
  for (const s of allSuggestions(atlas)) {
    const at = s.keys[0].indexOf(q)
    if (at === 0) out.push({ s, at, group: 0 })
    else if (s.keys.slice(1).some((k) => k.startsWith(q))) out.push({ s, at, group: 1 })
    else if (at > 0) out.push({ s, at, group: 2 })
    else if (s.keys.slice(1).some((k) => k.includes(q))) out.push({ s, at: -1, group: 3 })
  }
  out.sort((a, b) => a.group - b.group || a.s.label.localeCompare(b.s.label, 'fr'))
  return out.map(({ s, at }) => ({ s, at }))
}

export function exactMatch(atlas: Atlas, query: string): Suggestion | undefined {
  const q = normalize(query)
  return allSuggestions(atlas).find((s) => s.keys.includes(q))
}
