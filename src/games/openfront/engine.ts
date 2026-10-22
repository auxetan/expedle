// Moteur d'OpenFront : des joueurs se disputent une grille de terre avec leurs troupes,
// par la terre ou en bateau. Tout tient dans des tableaux typés pour tourner à dix tours par seconde.

export const WATER = -1
export const NEUTRAL = 0
export const WIN_SHARE = 0.8
export const MAX_BOATS = 3

const START_TROOPS = 600
const SPAWN_RADIUS = 3
const NEUTRAL_COST = 4
const BOAT_SPEED = 2

export interface MapGrid {
  w: number
  h: number
  // 1 pour la terre
  land: Uint8Array
}

export interface Player {
  id: number
  name: string
  human: boolean
  troops: number
  gold: number
  cells: number
  alive: boolean
  spawned: boolean
  // ses cases qui touchent une terre d'un autre propriétaire
  border: Set<number>
  killer?: number
}

export interface Attack {
  from: number
  to: number
  troops: number
}

export interface Boat {
  owner: number
  path: number[]
  at: number
  troops: number
  landing: number
}

export interface Game {
  w: number
  h: number
  // propriétaire de chaque case : WATER, NEUTRAL ou l'id du joueur
  owner: Int16Array
  players: Player[]
  attacks: Attack[]
  boats: Boat[]
  cities: Set<number>
  tick: number
  land: number
  // cases à redessiner
  changed: Set<number>
  rng: () => number
}

export function createGame(map: MapGrid, rng: () => number = Math.random): Game {
  const owner = new Int16Array(map.w * map.h)
  let land = 0
  for (let i = 0; i < owner.length; i++) {
    if (map.land[i]) land++
    else owner[i] = WATER
  }
  return { w: map.w, h: map.h, owner, players: [], attacks: [], boats: [], cities: new Set(), tick: 0, land, changed: new Set(), rng }
}

export function addPlayer(g: Game, name: string, human = false): Player {
  const p: Player = { id: g.players.length + 1, name, human, troops: START_TROOPS, gold: 0, cells: 0, alive: true, spawned: false, border: new Set() }
  g.players.push(p)
  return p
}

export const player = (g: Game, id: number) => g.players[id - 1]

// Les quatre voisines ; la carte se referme d'est en ouest, comme le globe.
export function neighbors(g: Game, i: number): number[] {
  const x = i % g.w
  const row = i - x
  const out = [row + ((x + g.w - 1) % g.w), row + ((x + 1) % g.w)]
  if (row > 0) out.push(i - g.w)
  if (row < (g.h - 1) * g.w) out.push(i + g.w)
  return out
}

function isBorder(g: Game, c: number): boolean {
  const o = g.owner[c]
  return neighbors(g, c).some((n) => g.owner[n] !== o && g.owner[n] !== WATER)
}

function refresh(g: Game, c: number) {
  const o = g.owner[c]
  if (o <= 0) return
  const border = player(g, o).border
  if (isBorder(g, c)) border.add(c)
  else border.delete(c)
}

function setOwner(g: Game, c: number, to: number) {
  const from = g.owner[c]
  if (from === to) return
  if (from > 0) {
    const p = player(g, from)
    p.cells--
    p.border.delete(c)
  }
  g.owner[c] = to
  if (to > 0) player(g, to).cells++
  g.changed.add(c)
  refresh(g, c)
  for (const n of neighbors(g, c)) {
    refresh(g, n)
    g.changed.add(n)
  }
}

export function spawn(g: Game, id: number, cell: number): boolean {
  const p = player(g, id)
  if (p.spawned || g.owner[cell] !== NEUTRAL) return false
  const cx = cell % g.w
  const cy = (cell - cx) / g.w
  for (let dy = -SPAWN_RADIUS; dy <= SPAWN_RADIUS; dy++) {
    const y = cy + dy
    if (y < 0 || y >= g.h) continue
    for (let dx = -SPAWN_RADIUS; dx <= SPAWN_RADIUS; dx++) {
      if (dx * dx + dy * dy > SPAWN_RADIUS * SPAWN_RADIUS) continue
      const c = y * g.w + ((cx + dx + g.w) % g.w)
      if (g.owner[c] === NEUTRAL) setOwner(g, c, id)
    }
  }
  p.spawned = true
  return true
}

export function citiesOf(g: Game, id: number): number {
  let n = 0
  for (const c of g.cities) if (g.owner[c] === id) n++
  return n
}

export function maxTroops(g: Game, p: Player): number {
  return (1000 + 60 * p.cells ** 0.8) * (1 + 0.3 * citiesOf(g, p.id))
}

export function cityCost(g: Game, id: number): number {
  return 1500 * 2 ** Math.min(citiesOf(g, id), 6)
}

export function buildCity(g: Game, id: number, cell: number): boolean {
  const p = player(g, id)
  const cost = cityCost(g, id)
  if (g.owner[cell] !== id || g.cities.has(cell) || p.gold < cost) return false
  p.gold -= cost
  g.cities.add(cell)
  g.changed.add(cell)
  return true
}

const density = (p: Player) => (p.cells ? p.troops / p.cells : 0)

// Ce que coûte la prise d'une case : un peu pour la terre libre, plus quand l'adversaire est nombreux.
export function cellCost(g: Game, to: number): number {
  return to === NEUTRAL ? NEUTRAL_COST : 4 + 1.5 * density(player(g, to))
}

function take(g: Game, from: number, cell: number) {
  const to = g.owner[cell]
  if (to > 0) {
    const d = player(g, to)
    d.troops = Math.max(0, d.troops - density(d))
    if (d.cells === 1) d.killer = from
  }
  setOwner(g, cell, from)
}

// Lance des troupes déjà retirées du stock : une attaque en sens inverse s'y use d'abord.
function launch(g: Game, from: number, to: number, troops: number) {
  const back = g.attacks.find((a) => a.from === to && a.to === from)
  if (back) {
    const clash = Math.min(back.troops, troops)
    back.troops -= clash
    troops -= clash
    if (back.troops <= 0) g.attacks.splice(g.attacks.indexOf(back), 1)
  }
  if (troops <= 0) return
  const same = g.attacks.find((a) => a.from === from && a.to === to)
  if (same) same.troops += troops
  else g.attacks.push({ from, to, troops })
}

export function startAttack(g: Game, from: number, to: number, troops: number) {
  const p = player(g, from)
  const sent = Math.min(troops, p.troops)
  if (from === to || sent < 1) return
  p.troops -= sent
  launch(g, from, to, sent)
}

function stepAttack(g: Game, a: Attack) {
  const p = player(g, a.from)
  // le front : les cases de la cible qui touchent l'attaquant, les plus entourées d'abord
  const contact = new Map<number, number>()
  for (const c of p.border) for (const n of neighbors(g, c)) if (g.owner[n] === a.to) contact.set(n, (contact.get(n) ?? 0) + 1)
  const front = [...contact.keys()]
  for (let i = front.length - 1; i > 0; i--) {
    const j = Math.floor(g.rng() * (i + 1))
    ;[front[i], front[j]] = [front[j], front[i]]
  }
  front.sort((x, y) => contact.get(y)! - contact.get(x)!)
  const k = Math.ceil(front.length / 5)
  for (let i = 0; i < k; i++) {
    const cost = cellCost(g, a.to)
    if (a.troops < cost) break
    a.troops -= cost
    take(g, a.from, front[i])
  }
  // plus rien à prendre, ou plus assez de monde : les survivants rentrent
  if (!front.length || a.troops < cellCost(g, a.to)) {
    p.troops += a.troops
    a.troops = 0
  }
}

export function coastal(g: Game, c: number): boolean {
  return g.owner[c] !== WATER && neighbors(g, c).some((n) => g.owner[n] === WATER)
}

// La côte la plus proche de la case visée, sur la terre du même propriétaire.
function landingNear(g: Game, cell: number): number {
  const o = g.owner[cell]
  const seen = new Set([cell])
  const queue = [cell]
  for (let q = 0; q < queue.length && q < 20_000; q++) {
    const c = queue[q]
    if (coastal(g, c)) return c
    for (const n of neighbors(g, c))
      if (g.owner[n] === o && !seen.has(n)) {
        seen.add(n)
        queue.push(n)
      }
  }
  return -1
}

// Le plus court chemin par la mer, des côtes du joueur jusqu'au point de débarquement.
function seaPath(g: Game, from: number, landing: number): number[] | null {
  const prev = new Int32Array(g.w * g.h).fill(-2)
  const queue: number[] = []
  for (const n of neighbors(g, landing))
    if (g.owner[n] === WATER) {
      prev[n] = -1
      queue.push(n)
    }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]
    if (neighbors(g, c).some((n) => g.owner[n] === from)) {
      const path = []
      for (let i = c; i >= 0; i = prev[i]) path.push(i)
      return path
    }
    for (const n of neighbors(g, c))
      if (g.owner[n] === WATER && prev[n] === -2) {
        prev[n] = c
        queue.push(n)
      }
  }
  return null
}

export function sendBoat(g: Game, from: number, cell: number, troops: number): boolean {
  const to = g.owner[cell]
  const p = player(g, from)
  if (to === WATER || to === from || g.boats.filter((b) => b.owner === from).length >= MAX_BOATS) return false
  const landing = landingNear(g, cell)
  const path = landing < 0 ? null : seaPath(g, from, landing)
  const sent = Math.min(troops, p.troops)
  if (!path || sent < 1) return false
  p.troops -= sent
  g.boats.push({ owner: from, path, at: 0, troops: sent, landing })
  return true
}

function stepBoat(g: Game, b: Boat) {
  b.at += BOAT_SPEED
  if (b.at < b.path.length - 1) return
  const to = g.owner[b.landing]
  const p = player(g, b.owner)
  if (to === b.owner) p.troops += b.troops
  else if (b.troops >= cellCost(g, to)) {
    b.troops -= cellCost(g, to)
    take(g, b.owner, b.landing)
    launch(g, b.owner, to, b.troops)
  }
  b.troops = 0
}

// Est-ce que la terre de la case visée touche le joueur ? Sinon il faudra un bateau.
function reachable(g: Game, from: number, cell: number): boolean {
  const o = g.owner[cell]
  const seen = new Set([cell])
  const queue = [cell]
  for (let q = 0; q < queue.length; q++) {
    for (const n of neighbors(g, queue[q])) {
      if (g.owner[n] === from) return true
      if (g.owner[n] === o && !seen.has(n)) {
        seen.add(n)
        queue.push(n)
      }
    }
  }
  return false
}

export type Order = 'terre' | 'mer'

// Le clic du joueur : attaque par la terre si le territoire visé le touche, en bateau sinon.
export function attackAt(g: Game, from: number, cell: number, troops: number): Order | null {
  const to = g.owner[cell]
  if (to === WATER || to === from) return null
  if (reachable(g, from, cell)) {
    startAttack(g, from, to, troops)
    return 'terre'
  }
  return sendBoat(g, from, cell, troops) ? 'mer' : null
}

export function step(g: Game) {
  g.tick++
  for (const p of g.players) {
    if (!p.alive || !p.spawned) continue
    const max = maxTroops(g, p)
    p.troops = Math.max(0, p.troops + (1.5 + p.troops ** 0.7 / 6) * (1 - p.troops / max))
    p.gold += 0.5 + p.cells ** 0.7 / 30
  }
  for (const a of g.attacks) stepAttack(g, a)
  for (const b of g.boats) stepBoat(g, b)
  for (const p of g.players)
    if (p.alive && p.spawned && p.cells === 0) {
      p.alive = false
      p.troops = 0
    }
  g.attacks = g.attacks.filter((a) => a.troops > 0 && player(g, a.from).alive)
  g.boats = g.boats.filter((b) => b.troops > 0 && player(g, b.owner).alive)
}

export function winner(g: Game): number {
  const alive = g.players.filter((p) => p.alive && p.spawned)
  const top = alive.find((p) => p.cells >= WIN_SHARE * g.land)
  if (top) return top.id
  return alive.length === 1 && g.players.every((p) => p.spawned) ? alive[0].id : 0
}
