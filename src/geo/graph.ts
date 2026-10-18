// Graphe de "zones" : un pays peut avoir plusieurs zones disjointes (exclaves),
// qui ne se relient pas entre elles. Payer un pays = le deviner.
export interface Graph {
  country: string[]
  adj: number[][]
  nodesOf: Map<string, number[]>
}

export type Mark = 'optimal' | 'good' | 'close' | 'far'

export const MARK_EMOJI: Record<Mark, string> = {
  optimal: '✅',
  good: '🟩',
  close: '🟧',
  far: '🟥',
}

export function buildGraph(nodes: { country: string }[], edges: [number, number][]): Graph {
  const adj: number[][] = nodes.map(() => [])
  for (const [a, b] of edges) {
    if (a === b || adj[a].includes(b)) continue
    adj[a].push(b)
    adj[b].push(a)
  }
  const nodesOf = new Map<string, number[]>()
  nodes.forEach((n, i) => {
    const list = nodesOf.get(n.country) ?? []
    list.push(i)
    nodesOf.set(n.country, list)
  })
  return { country: nodes.map((n) => n.country), adj, nodesOf }
}

// Garde les indices de zones : seules les liaisons vers des pays refusés disparaissent.
export function filterGraph(g: Graph, allow: (country: string) => boolean): Graph {
  const ok = g.country.map(allow)
  const nodesOf = new Map<string, number[]>()
  for (const [c, nodes] of g.nodesOf) if (allow(c)) nodesOf.set(c, nodes)
  return {
    country: g.country,
    adj: g.adj.map((list, i) => (ok[i] ? list.filter((j) => ok[j]) : [])),
    nodesOf,
  }
}

interface Field {
  dist: number[]
  parent: number[]
}

// 0-1 BFS : entrer dans une zone coûte 1 si son pays n'est pas "gratuit".
function field(g: Graph, source: string, free: Set<string>): Field {
  const n = g.country.length
  const dist = new Array<number>(n).fill(Infinity)
  const parent = new Array<number>(n).fill(-1)
  const deque: number[] = []
  for (const s of g.nodesOf.get(source) ?? []) {
    dist[s] = 0
    deque.push(s)
  }
  while (deque.length) {
    const u = deque.shift()!
    for (const v of g.adj[u]) {
      const w = free.has(g.country[v]) ? 0 : 1
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w
        parent[v] = u
        if (w === 0) deque.unshift(v)
        else deque.push(v)
      }
    }
  }
  return { dist, parent }
}

function withEnds(guessed: Iterable<string>, start: string, end: string): Set<string> {
  const s = new Set(guessed)
  s.add(start)
  s.add(end)
  return s
}

function minOver(nodes: number[] | undefined, values: number[]): number {
  let best = Infinity
  for (const v of nodes ?? []) best = Math.min(best, values[v])
  return best
}

export function remaining(g: Graph, start: string, end: string, guessed: Set<string>): number {
  const { dist } = field(g, start, withEnds(guessed, start, end))
  return minOver(g.nodesOf.get(end), dist)
}

export function isSolved(g: Graph, start: string, end: string, guessed: Set<string>): boolean {
  return remaining(g, start, end, guessed) === 0
}

// Pays devinés reliés au départ uniquement par des pays devinés.
export function startConnected(g: Graph, start: string, guessed: Set<string>): Set<string> {
  const allowed = new Set(guessed)
  allowed.add(start)
  const seen = new Set<number>(g.nodesOf.get(start) ?? [])
  const stack = [...seen]
  while (stack.length) {
    const u = stack.pop()!
    for (const v of g.adj[u]) {
      if (!seen.has(v) && allowed.has(g.country[v])) {
        seen.add(v)
        stack.push(v)
      }
    }
  }
  const out = new Set<string>()
  for (const v of seen) if (g.country[v] !== start) out.add(g.country[v])
  return out
}

export function scoreGuess(g: Graph, start: string, end: string, previous: string[], guess: string): Mark {
  const before = remaining(g, start, end, new Set(previous))
  const now = new Set([...previous, guess])
  const after = remaining(g, start, end, now)
  if (after < before) return startConnected(g, start, now).has(guess) ? 'optimal' : 'good'
  const free = withEnds(now, start, end)
  const fromStart = field(g, start, free).dist
  const fromEnd = field(g, end, free).dist
  let via = Infinity
  for (const v of g.nodesOf.get(guess) ?? []) via = Math.min(via, fromStart[v] + fromEnd[v])
  return via <= after + 1 ? 'close' : 'far'
}

export function nextCountries(g: Graph, start: string, end: string, guessed: Set<string>): string[] {
  const free = withEnds(guessed, start, end)
  const fromStart = field(g, start, free).dist
  const fromEnd = field(g, end, free).dist
  const r = minOver(g.nodesOf.get(end), fromStart)
  const out = new Set<string>()
  g.country.forEach((c, v) => {
    if (!free.has(c) && fromStart[v] === 1 && fromStart[v] + fromEnd[v] - 1 === r) out.add(c)
  })
  return [...out]
}

export function shortestPath(g: Graph, start: string, end: string): string[] {
  const { dist, parent } = field(g, start, withEnds([], start, end))
  let best = -1
  for (const v of g.nodesOf.get(end) ?? []) if (best < 0 || dist[v] < dist[best]) best = v
  if (best < 0 || dist[best] === Infinity) return []
  const path: string[] = []
  for (let v = parent[best]; v >= 0; v = parent[v]) {
    const c = g.country[v]
    if (c !== start && c !== end && path[0] !== c) path.unshift(c)
  }
  return path
}

export function distancesFrom(g: Graph, start: string): Map<string, number> {
  const { dist } = field(g, start, new Set([start]))
  const out = new Map<string, number>()
  g.country.forEach((c, v) => {
    if (c === start || dist[v] === Infinity) return
    // le pays d'arrivée est gratuit : on retire son propre coût
    const d = dist[v] - 1
    if (!out.has(c) || d < out.get(c)!) out.set(c, d)
  })
  return out
}

export function guessLimit(shortest: number): number {
  if (shortest <= 3) return shortest + 4
  if (shortest <= 6) return shortest + 5
  if (shortest <= 9) return shortest + 6
  if (shortest <= 12) return shortest + 7
  return shortest + 8
}
