// Moteur d'OpenFront : la carte, les joueurs, les attaques case par case, les bateaux, les bâtiments,
// les bombes et les alliances. Dix tours par seconde, tout en tableaux typés pour tenir 2 millions de cases.
import { Heap } from './heap'
import {
  ALLIANCE_TICKS,
  BLAST,
  BUILD_TICKS,
  DEFENSE_RANGE,
  EXTEND_WINDOW,
  goldPerTick,
  landCost,
  MAX_BOATS,
  maxTroops,
  neutralCost,
  NUKE_ALLY_BREAK,
  nukeDeaths,
  PORT_RANGE,
  priority,
  REQUEST_COOLDOWN,
  REQUEST_TICKS,
  RETREAT_LOSS,
  SAM_COOLDOWN,
  samRange,
  SHELL_DAMAGE,
  SILO_COOLDOWN,
  SPAWN_RADIUS,
  startTroops,
  STRUCTURE_MIN_DIST,
  terrainOf,
  TRAITOR_TICKS,
  troopGrowth,
  unitCost,
  WARSHIP_HP,
  WIN_SHARE,
  type Buyable,
  type Kind,
  type Level,
  type NukeType,
  type UnitType,
} from './rules'

// Un octet par case, au format des cartes d'OpenFront : terre, rivage, océan et relief sur 5 bits (31 : infranchissable).
export const LAND = 0x80
export const SHORE = 0x40
export const OCEAN = 0x20
const MAG = 0x1f
const IMPASSABLE = 31

export interface GameMap {
  w: number
  h: number
  terrain: Uint8Array
}

export interface Player {
  id: number
  name: string
  kind: Kind
  // code pays des nations, pour le drapeau
  code: string
  troops: number
  gold: number
  tiles: number
  alive: boolean
  spawned: boolean
  // ses cases qui touchent une case d'un autre propriétaire (ou la mer)
  border: Set<number>
  traitorUntil: number
  // ce que ce joueur pense des autres, de -100 à 100
  relations: Map<number, number>
  // dernière demande d'alliance envoyée à chacun
  asked: Map<number, number>
  cityLevels: number
  killer: number
  spawn: number[]
}

export interface Attack {
  id: number
  from: number
  to: number
  troops: number
  heap: Heap
  front: Set<number>
  // case de débarquement, ou -1 pour une attaque par la terre
  source: number
}

export interface Boat {
  id: number
  owner: number
  to: number
  troops: number
  path: Int32Array
  at: number
  dst: number
  // navire marchand : l'or qu'il rapportera, et le port d'arrivée
  trade: boolean
  gold: number
  port: number
}

export interface Unit {
  id: number
  type: UnitType
  owner: number
  tile: number
  level: number
  ready: number
  cooldown: number
  hp: number
  // navires de guerre : le port d'attache et le point visé
  home: number
  goal: number
}

export interface Nuke {
  id: number
  type: NukeType | 'ogive'
  owner: number
  from: number
  dst: number
  start: number
  ticks: number
}

export interface Shell {
  from: number
  owner: number
  target: 'boat' | 'unit'
  id: number
  tile: number
  hit: number
}

export interface Alliance {
  a: number
  b: number
  until: number
  extend: Set<number>
  asked: boolean
}

export interface Request {
  from: number
  to: number
  until: number
}

export type EventType = 'request' | 'accepted' | 'refused' | 'expired' | 'extend' | 'eliminated' | 'nuke' | 'intercepted' | 'betrayed'

export interface GameEvent {
  type: EventType
  from: number
  to: number
  tick: number
}

export interface Blast {
  tile: number
  radius: number
  tick: number
}

export interface Game {
  w: number
  h: number
  terrain: Uint8Array
  owner: Uint16Array
  fallout: Uint8Array
  falloutTiles: number
  players: Player[]
  attacks: Attack[]
  boats: Boat[]
  units: Unit[]
  unitAt: Map<number, Unit>
  nukes: Nuke[]
  shells: Shell[]
  alliances: Alliance[]
  requests: Request[]
  events: GameEvent[]
  blasts: Blast[]
  tick: number
  // terres franchissables, la base des 80 % à prendre
  land: number
  level: Level
  rng: () => number
  mirvs: number
  nextId: number
  // cases à redessiner
  dirty: Int32Array
  dirtyCount: number
  dirtyMark: Uint8Array
  // mémoire de travail des parcours (mer, côtes, encerclements)
  prev: Int32Array
  seen: Uint32Array
  stamp: number
  queue: Int32Array
  routes: Map<string, Int32Array | null>
  // postes de défense achevés de chaque joueur, relevés à chaque tour
  posts: Map<number, number[]>
}

export function createGame(map: GameMap, level: Level, rng: () => number = Math.random): Game {
  const n = map.w * map.h
  let land = 0
  for (let t = 0; t < n; t++) if ((map.terrain[t] & LAND) !== 0 && (map.terrain[t] & MAG) !== IMPASSABLE) land++
  return {
    w: map.w,
    h: map.h,
    terrain: map.terrain,
    owner: new Uint16Array(n),
    fallout: new Uint8Array(n),
    falloutTiles: 0,
    players: [],
    attacks: [],
    boats: [],
    units: [],
    unitAt: new Map(),
    nukes: [],
    shells: [],
    alliances: [],
    requests: [],
    events: [],
    blasts: [],
    tick: 0,
    land,
    level,
    rng,
    mirvs: 0,
    nextId: 1,
    dirty: new Int32Array(n),
    dirtyCount: 0,
    dirtyMark: new Uint8Array(n),
    prev: new Int32Array(n),
    seen: new Uint32Array(n),
    stamp: 0,
    queue: new Int32Array(n),
    routes: new Map(),
    posts: new Map(),
  }
}

export function addPlayer(g: Game, name: string, kind: Kind, code = ''): Player {
  const p: Player = {
    id: g.players.length + 1,
    name,
    kind,
    code,
    troops: startTroops(kind, g.level),
    gold: 0,
    tiles: 0,
    alive: true,
    spawned: false,
    border: new Set(),
    traitorUntil: 0,
    relations: new Map(),
    asked: new Map(),
    cityLevels: 0,
    killer: 0,
    spawn: [],
  }
  g.players.push(p)
  return p
}

export const player = (g: Game, id: number) => g.players[id - 1]
export const isLand = (g: Game, t: number) => (g.terrain[t] & LAND) !== 0
export const passable = (g: Game, t: number) => (g.terrain[t] & LAND) !== 0 && (g.terrain[t] & MAG) !== IMPASSABLE
export const terrainAt = (g: Game, t: number) => terrainOf(g.terrain[t] & MAG)
export const isTraitor = (g: Game, p: Player) => p.traitorUntil > g.tick

const N1 = new Int32Array(4)
const N2 = new Int32Array(4)

// Les quatre voisines dans le tampon donné ; la carte ne se referme pas sur les bords.
export function neighbors(g: Game, t: number, out: Int32Array = N1): number {
  const x = t % g.w
  let k = 0
  if (x > 0) out[k++] = t - 1
  if (x < g.w - 1) out[k++] = t + 1
  if (t >= g.w) out[k++] = t - g.w
  if (t < g.w * (g.h - 1)) out[k++] = t + g.w
  return k
}

const dist2 = (g: Game, a: number, b: number) => {
  const dx = (a % g.w) - (b % g.w)
  const dy = Math.floor(a / g.w) - Math.floor(b / g.w)
  return dx * dx + dy * dy
}

export const distance = (g: Game, a: number, b: number) => Math.sqrt(dist2(g, a, b))

function markDirty(g: Game, t: number) {
  if (g.dirtyMark[t]) return
  g.dirtyMark[t] = 1
  g.dirty[g.dirtyCount++] = t
}

function isBorder(g: Game, t: number): boolean {
  const o = g.owner[t]
  const k = neighbors(g, t, N2)
  for (let i = 0; i < k; i++) if (g.owner[N2[i]] !== o || !isLand(g, N2[i])) return true
  return false
}

function refresh(g: Game, t: number) {
  const o = g.owner[t]
  if (!o) return
  const border = player(g, o).border
  if (isBorder(g, t)) border.add(t)
  else border.delete(t)
}

function setOwner(g: Game, t: number, to: number) {
  const from = g.owner[t]
  if (from === to) return
  if (from) {
    const p = player(g, from)
    p.tiles--
    p.border.delete(t)
  }
  g.owner[t] = to
  if (to) player(g, to).tiles++
  // les bâtiments passent au conquérant ; une case rendue à la nature perd le sien
  const unit = g.unitAt.get(t)
  if (unit) {
    if (to) unit.owner = to
    else removeUnit(g, unit)
    recountCities(g)
  }
  markDirty(g, t)
  refresh(g, t)
  const k = neighbors(g, t)
  const near = [N1[0], N1[1], N1[2], N1[3]]
  for (let i = 0; i < k; i++) {
    refresh(g, near[i])
    markDirty(g, near[i])
  }
}

function conquer(g: Game, id: number, t: number) {
  if (g.fallout[t]) {
    g.fallout[t] = 0
    g.falloutTiles--
  }
  setOwner(g, t, id)
}

export function event(g: Game, type: EventType, from: number, to: number) {
  g.events.push({ type, from, to, tick: g.tick })
}

// --- apparition ---

export function spawn(g: Game, id: number, center: number): boolean {
  if (!passable(g, center) || (g.owner[center] && g.owner[center] !== id)) return false
  const p = player(g, id)
  for (const t of p.spawn) if (g.owner[t] === id) setOwner(g, t, 0)
  p.spawn = []
  const cx = center % g.w
  const cy = Math.floor(center / g.w)
  for (let dy = -SPAWN_RADIUS; dy <= SPAWN_RADIUS; dy++)
    for (let dx = -SPAWN_RADIUS; dx <= SPAWN_RADIUS; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (dx * dx + dy * dy > SPAWN_RADIUS * SPAWN_RADIUS || x < 0 || y < 0 || x >= g.w || y >= g.h) continue
      const t = y * g.w + x
      if (passable(g, t) && !g.owner[t]) {
        setOwner(g, t, id)
        p.spawn.push(t)
      }
    }
  p.spawned = p.tiles > 0
  return p.spawned
}

// --- troupes et relations ---

export function maxTroopsOf(g: Game, p: Player): number {
  return maxTroops(p.kind, g.level, p.tiles, p.cityLevels)
}

function recountCities(g: Game) {
  for (const p of g.players) p.cityLevels = 0
  for (const u of g.units) if (u.type === 'ville' && u.ready <= g.tick && u.owner) player(g, u.owner).cityLevels += u.level
}

export const relation = (g: Game, of: number, toward: number) => player(g, of).relations.get(toward) ?? 0

export function changeRelation(g: Game, of: number, toward: number, delta: number) {
  const p = player(g, of)
  p.relations.set(toward, Math.max(-100, Math.min(100, (p.relations.get(toward) ?? 0) + delta)))
}

const ANGER: Record<Level, number> = { facile: -60, moyen: -70, difficile: -80, impossible: -100 }

// --- attaques ---

function touches(g: Game, t: number, id: number): boolean {
  const k = neighbors(g, t, N2)
  for (let i = 0; i < k; i++) if (g.owner[N2[i]] === id) return true
  return false
}

function addNeighbors(g: Game, a: Attack, t: number) {
  const k = neighbors(g, t)
  const near = [N1[0], N1[1], N1[2], N1[3]]
  for (let i = 0; i < k; i++) {
    const n = near[i]
    if (g.owner[n] !== a.to || !passable(g, n)) continue
    a.front.add(n)
    let own = 0
    const m = neighbors(g, n, N2)
    for (let j = 0; j < m; j++) if (g.owner[N2[j]] === a.from) own++
    a.heap.push(n, priority(g.rng(), own, terrainAt(g, n), g.tick))
  }
}

// La cible n'aime pas être attaquée, et retire la demande d'alliance qu'elle avait faite.
function hostility(g: Game, from: number, to: number) {
  if (!to) return
  g.requests = g.requests.filter((r) => !(r.from === to && r.to === from))
  if (g.level === 'facile' || relation(g, to, from) > -50) changeRelation(g, to, from, ANGER[g.level])
}

export function startAttack(g: Game, from: number, to: number, troops: number, source = -1, deduct = true): boolean {
  const p = player(g, from)
  if (from === to || !p.alive || (to && (allied(g, from, to) || !player(g, to).alive))) return false
  const sent = deduct ? Math.min(troops, p.troops) : troops
  if (sent < 1) return false
  if (deduct) p.troops -= sent
  hostility(g, from, to)
  const a: Attack = { id: g.nextId++, from, to, troops: sent, heap: new Heap(), front: new Set(), source }
  // deux attaques en sens inverse s'annulent, la plus forte continue
  const back = g.attacks.find((b) => b.from === to && b.to === from)
  if (back && to) {
    if (back.troops > a.troops) {
      back.troops -= a.troops
      return true
    }
    a.troops -= back.troops
    back.troops = 0
  }
  // une nouvelle attaque par la terre sur la même cible reprend les troupes des précédentes
  for (const other of g.attacks)
    if (source < 0 && other.from === from && other.to === to && other.source < 0 && other.troops > 0) {
      a.troops += other.troops
      other.troops = 0
    }
  g.attacks = g.attacks.filter((b) => b.troops > 0)
  if (source >= 0) addNeighbors(g, a, source)
  else for (const t of p.border) addNeighbors(g, a, t)
  if (!a.heap.size) {
    p.troops += a.troops
    return false
  }
  g.attacks.push(a)
  return true
}

function hasPost(g: Game, owner: number, t: number): boolean {
  for (const tile of g.posts.get(owner) ?? []) if (dist2(g, tile, t) <= DEFENSE_RANGE * DEFENSE_RANGE) return true
  return false
}

function eliminate(g: Game, p: Player, by: number) {
  p.alive = false
  p.killer = by
  if (by) player(g, by).gold += p.kind === 'human' ? p.gold / 2 : p.gold
  p.gold = 0
  p.troops = 0
  g.alliances = g.alliances.filter((a) => a.a !== p.id && a.b !== p.id)
  event(g, 'eliminated', by, p.id)
}

function stepAttack(g: Game, a: Attack): boolean {
  const p = player(g, a.from)
  const target = a.to ? player(g, a.to) : null
  if (!p.alive || (target && (!target.alive || allied(g, a.from, a.to)))) {
    p.troops += a.troops
    return false
  }
  const borderSize = a.front.size + Math.floor(g.rng() * 5)
  let budget = 1
  while (budget > 0) {
    if (a.troops < 1) return false
    if (!a.heap.size) {
      p.troops += a.troops
      return false
    }
    const t = a.heap.pop()
    a.front.delete(t)
    if (g.owner[t] !== a.to || !passable(g, t) || !touches(g, t, a.from)) continue
    addNeighbors(g, a, t)
    const fallout = g.fallout[t] ? g.falloutTiles / g.land : null
    const cost = target
      ? landCost(
          { kind: p.kind, tiles: p.tiles },
          a.troops,
          terrainAt(g, t),
          { kind: target.kind, tiles: target.tiles, troops: target.troops, traitor: isTraitor(g, target), post: hasPost(g, target.id, t) },
          borderSize,
          fallout,
        )
      : neutralCost(p.kind, terrainAt(g, t), a.troops, borderSize, fallout)
    budget -= cost.fraction
    a.troops -= cost.loss
    if (target) target.troops = Math.max(0, target.troops - cost.defenderLoss)
    conquer(g, a.from, t)
    if (target && target.tiles === 0 && target.alive) eliminate(g, target, a.from)
  }
  return true
}

// Rappel des troupes d'une attaque : contre un joueur, un quart reste sur le terrain.
export function retreat(g: Game, id: number) {
  const a = g.attacks.find((x) => x.id === id)
  if (!a) return
  player(g, a.from).troops += a.troops * (a.to ? 1 - RETREAT_LOSS : 1)
  a.troops = 0
  g.attacks = g.attacks.filter((x) => x !== a)
}

// --- mer : côtes, routes, bateaux ---

const isWater = (g: Game, t: number) => (g.terrain[t] & LAND) === 0

function coastal(g: Game, t: number): boolean {
  const k = neighbors(g, t, N2)
  for (let i = 0; i < k; i++) if (isWater(g, N2[i])) return true
  return false
}

function nextStamp(g: Game): number {
  if (++g.stamp === 0xffffffff) {
    g.seen.fill(0)
    g.stamp = 1
  }
  return g.stamp
}

// La côte la plus proche de la case visée, sur la terre du même propriétaire.
function shoreNear(g: Game, tile: number): number {
  const o = g.owner[tile]
  const s = nextStamp(g)
  let head = 0
  let tail = 0
  g.queue[tail++] = tile
  g.seen[tile] = s
  while (head < tail && head < 400_000) {
    const t = g.queue[head++]
    if (coastal(g, t)) return t
    const k = neighbors(g, t)
    for (let i = 0; i < k; i++) {
      const n = N1[i]
      if (g.seen[n] !== s && g.owner[n] === o && passable(g, n)) {
        g.seen[n] = s
        g.queue[tail++] = n
      }
    }
  }
  return -1
}

const D8 = [-1, 1, 0, 0, -1, -1, 1, 1]
const E8 = [0, 0, -1, 1, -1, 1, -1, 1]

// Parcours de la mer en huit directions depuis les eaux devant `start`, jusqu'à une eau qui vérifie `done`.
// Le chemin rendu va de cette eau-là jusqu'à `start` : un bateau y avance d'une case par tour.
function sail(g: Game, start: number, done: (water: number) => boolean): Int32Array | null {
  const s = nextStamp(g)
  let head = 0
  let tail = 0
  const k = neighbors(g, start)
  for (let i = 0; i < k; i++)
    if (isWater(g, N1[i]) && g.seen[N1[i]] !== s) {
      g.seen[N1[i]] = s
      g.prev[N1[i]] = -1
      g.queue[tail++] = N1[i]
    }
  while (head < tail) {
    const t = g.queue[head++]
    if (done(t)) {
      const path: number[] = []
      for (let c = t; c >= 0; c = g.prev[c]) path.push(c)
      return Int32Array.from(path)
    }
    const x = t % g.w
    const y = Math.floor(t / g.w)
    for (let d = 0; d < 8; d++) {
      const nx = x + D8[d]
      const ny = y + E8[d]
      if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue
      const n = ny * g.w + nx
      if (g.seen[n] === s || !isWater(g, n)) continue
      g.seen[n] = s
      g.prev[n] = t
      g.queue[tail++] = n
    }
  }
  return null
}

function landsOn(g: Game, water: number, id: number): boolean {
  const k = neighbors(g, water, N2)
  for (let i = 0; i < k; i++) if (g.owner[N2[i]] === id) return true
  return false
}

export const boatsOf = (g: Game, id: number) => g.boats.filter((b) => b.owner === id && !b.trade).length

export function sendBoat(g: Game, from: number, tile: number, troops: number): boolean {
  const p = player(g, from)
  const to = g.owner[tile]
  if (!passable(g, tile) || to === from || (to && allied(g, from, to)) || boatsOf(g, from) >= MAX_BOATS) return false
  const dst = shoreNear(g, tile)
  if (dst < 0) return false
  const path = sail(g, dst, (w) => landsOn(g, w, from))
  const sent = Math.min(troops, p.troops)
  if (!path || sent < 1) return false
  p.troops -= sent
  hostility(g, from, to)
  g.boats.push({ id: g.nextId++, owner: from, to, troops: sent, path, at: 0, dst, trade: false, gold: 0, port: 0 })
  return true
}

function stepBoat(g: Game, b: Boat): boolean {
  if (++b.at < b.path.length) return true
  const p = player(g, b.owner)
  if (b.trade) {
    const port = g.units.find((u) => u.id === b.port)
    if (port && p.alive) {
      p.gold += b.gold
      player(g, port.owner).gold += b.gold
    }
    return false
  }
  const to = g.owner[b.dst]
  if (to === b.owner) p.troops += b.troops * (1 - RETREAT_LOSS)
  else if (to && allied(g, b.owner, to)) p.troops += b.troops
  else {
    conquer(g, b.owner, b.dst)
    if (to && player(g, to).tiles === 0 && player(g, to).alive) eliminate(g, player(g, to), b.owner)
    startAttack(g, b.owner, to, b.troops, b.dst, false)
  }
  return false
}

// --- bâtiments ---

export const unitsOf = (g: Game, id: number, type: UnitType) => g.units.filter((u) => u.owner === id && u.type === type)

export function priceOf(g: Game, id: number, type: Buyable): number {
  if (type === 'mirv') return unitCost('mirv', g.mirvs)
  if (type === 'bombe' || type === 'hbombe') return unitCost(type, 0)
  return unitCost(type, unitsOf(g, id, type).length)
}

function removeUnit(g: Game, u: Unit) {
  g.units = g.units.filter((x) => x !== u)
  if (g.unitAt.get(u.tile) === u) g.unitAt.delete(u.tile)
}

export type BuildResult = 'ok' | 'or' | 'place' | 'port' | 'mer'

// La case où le bâtiment se poserait (ou le bâtiment voisin du même type à améliorer), sans rien dépenser.
export function buildSpot(g: Game, id: number, type: UnitType, tile: number): { tile: number; upgrade: Unit | null } | BuildResult {
  if (type === 'navire') {
    const ports = unitsOf(g, id, 'port').filter((u) => u.ready <= g.tick)
    if (!ports.length) return 'port'
    const port = ports.reduce((a, b) => (dist2(g, a.tile, tile) <= dist2(g, b.tile, tile) ? a : b))
    const k = neighbors(g, port.tile)
    for (let i = 0; i < k; i++) if (isWater(g, N1[i])) return { tile: N1[i], upgrade: null }
    return 'mer'
  }
  const near = g.units.find((u) => u.type === type && u.owner === id && dist2(g, u.tile, tile) < STRUCTURE_MIN_DIST * STRUCTURE_MIN_DIST)
  if (near && type !== 'poste') return { tile: near.tile, upgrade: near }
  let spot = tile
  if (type === 'port') {
    // le port se pose sur la côte la plus proche, à 20 cases au plus
    spot = -1
    let best = Infinity
    const cx = tile % g.w
    const cy = Math.floor(tile / g.w)
    for (let dy = -PORT_RANGE; dy <= PORT_RANGE; dy++)
      for (let dx = -PORT_RANGE; dx <= PORT_RANGE; dx++) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue
        const t = y * g.w + x
        const d = dx * dx + dy * dy
        if (d < best && g.owner[t] === id && coastal(g, t)) {
          best = d
          spot = t
        }
      }
    if (spot < 0) return 'mer'
  }
  if (g.owner[spot] !== id) return 'place'
  if (g.units.some((u) => u.type !== 'navire' && dist2(g, u.tile, spot) < STRUCTURE_MIN_DIST * STRUCTURE_MIN_DIST)) return 'place'
  return { tile: spot, upgrade: null }
}

export function build(g: Game, id: number, type: UnitType, tile: number): BuildResult {
  const p = player(g, id)
  const spot = buildSpot(g, id, type, tile)
  if (typeof spot === 'string') return spot
  const cost = priceOf(g, id, type)
  if (p.gold < cost) return 'or'
  p.gold -= cost
  if (spot.upgrade) {
    spot.upgrade.level++
    spot.upgrade.ready = g.tick + BUILD_TICKS[type]
  } else {
    const u: Unit = { id: g.nextId++, type, owner: id, tile: spot.tile, level: 1, ready: g.tick + BUILD_TICKS[type], cooldown: 0, hp: WARSHIP_HP, home: spot.tile, goal: -1 }
    if (type !== 'navire') g.unitAt.set(spot.tile, u)
    g.units.push(u)
  }
  recountCities(g)
  markDirty(g, spot.tile)
  return 'ok'
}

export function demolish(g: Game, id: number, tile: number): boolean {
  const u = g.units.find((x) => x.owner === id && x.type !== 'navire' && dist2(g, x.tile, tile) < STRUCTURE_MIN_DIST * STRUCTURE_MIN_DIST)
  if (!u) return false
  removeUnit(g, u)
  recountCities(g)
  markDirty(g, u.tile)
  return true
}

const atWar = (g: Game, a: number, b: number) => g.attacks.some((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a))

function nextTo(g: Game, water: number, tile: number): boolean {
  const k = neighbors(g, water, N2)
  for (let i = 0; i < k; i++) if (N2[i] === tile) return true
  return false
}

// Le commerce : de temps en temps, un port envoie un navire vers le port d'un joueur en paix avec lui.
function spawnTrade(g: Game) {
  const ports = g.units.filter((u) => u.type === 'port' && u.ready <= g.tick)
  if (ports.length < 2 || g.boats.filter((b) => b.trade).length >= 80) return
  for (const port of ports) {
    if (g.rng() * 12 > port.level) continue
    const partners = ports.filter((q) => q.owner !== port.owner && relation(g, q.owner, port.owner) > -50 && !atWar(g, q.owner, port.owner))
    if (!partners.length) continue
    const dest = partners[Math.floor(g.rng() * partners.length)]
    const key = `${port.id}-${dest.id}`
    if (!g.routes.has(key)) g.routes.set(key, sail(g, dest.tile, (w) => nextTo(g, w, port.tile)))
    const path = g.routes.get(key)
    if (!path) continue
    g.boats.push({ id: g.nextId++, owner: port.owner, to: dest.owner, troops: 0, path, at: 0, dst: dest.tile, trade: true, gold: Math.min(150_000, 20_000 + 100 * path.length), port: dest.id })
  }
}

// Navires de guerre : patrouille autour du port d'attache, tirs sur les bateaux et navires ennemis à portée.
function stepWarship(g: Game, u: Unit) {
  if (u.goal < 0 || u.tile === u.goal) {
    const hx = u.home % g.w
    const hy = Math.floor(u.home / g.w)
    for (let i = 0; i < 20; i++) {
      const x = hx + Math.round((g.rng() - 0.5) * 120)
      const y = hy + Math.round((g.rng() - 0.5) * 120)
      if (x >= 0 && y >= 0 && x < g.w && y < g.h && isWater(g, y * g.w + x)) {
        u.goal = y * g.w + x
        break
      }
    }
  }
  if (u.goal >= 0 && g.tick % 2 === 0) {
    const x = u.tile % g.w
    const y = Math.floor(u.tile / g.w)
    const next = (y + Math.sign(Math.floor(u.goal / g.w) - y)) * g.w + x + Math.sign((u.goal % g.w) - x)
    if (isWater(g, next)) u.tile = next
    else u.goal = -1
  }
  if (u.cooldown > g.tick) return
  const range = 80 * 80
  const boat = g.boats.find((b) => b.owner !== u.owner && !allied(g, b.owner, u.owner) && dist2(g, b.path[Math.min(b.at, b.path.length - 1)], u.tile) < range)
  const enemy = boat ? null : g.units.find((v) => v.type === 'navire' && v.owner !== u.owner && !allied(g, v.owner, u.owner) && dist2(g, v.tile, u.tile) < range)
  if (!boat && !enemy) return
  g.shells.push({ from: u.tile, owner: u.owner, target: boat ? 'boat' : 'unit', id: boat ? boat.id : enemy!.id, tile: boat ? boat.path[Math.min(boat.at, boat.path.length - 1)] : enemy!.tile, hit: g.tick + 4 })
  u.cooldown = g.tick + 20
}

function stepShell(g: Game, s: Shell): boolean {
  if (g.tick < s.hit) return true
  if (s.target === 'boat') {
    const b = g.boats.find((x) => x.id === s.id)
    if (b) {
      // un navire marchand pris rapporte la moitié de son or au tireur ; un transport coule avec ses troupes
      if (b.trade) player(g, s.owner).gold += b.gold / 2
      g.boats = g.boats.filter((x) => x !== b)
    }
  } else {
    const v = g.units.find((x) => x.id === s.id)
    if (v && (v.hp -= SHELL_DAMAGE) <= 0) removeUnit(g, v)
  }
  return false
}

// --- bombes ---

export type LaunchResult = 'ok' | 'or' | 'silo'

export function launch(g: Game, id: number, type: NukeType, tile: number): LaunchResult {
  const p = player(g, id)
  const silos = unitsOf(g, id, 'silo').filter((u) => u.ready <= g.tick && u.cooldown <= g.tick)
  if (!silos.length) return 'silo'
  const cost = priceOf(g, id, type)
  if (p.gold < cost) return 'or'
  p.gold -= cost
  if (type === 'mirv') g.mirvs++
  const silo = silos.reduce((a, b) => (dist2(g, a.tile, tile) <= dist2(g, b.tile, tile) ? a : b))
  silo.cooldown = g.tick + SILO_COOLDOWN
  g.nukes.push({ id: g.nextId++, type, owner: id, from: silo.tile, dst: tile, start: g.tick, ticks: Math.max(1, Math.ceil(distance(g, silo.tile, tile) / BLAST[type].speed)) })
  const target = g.owner[tile]
  if (target && target !== id) {
    changeRelation(g, target, id, -100)
    event(g, 'nuke', id, target)
  }
  return 'ok'
}

function detonate(g: Game, n: Nuke) {
  if (n.type === 'mirv') {
    // le MIRV se sépare en ogives réparties sur le territoire visé
    const target = g.owner[n.dst]
    const tiles: number[] = []
    for (let i = 0; i < 4000 && tiles.length < 100; i++) {
      const x = (n.dst % g.w) + Math.round((g.rng() - 0.5) * 300)
      const y = Math.floor(n.dst / g.w) + Math.round((g.rng() - 0.5) * 300)
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue
      const t = y * g.w + x
      if (target && g.owner[t] === target) tiles.push(t)
    }
    for (const t of tiles) g.nukes.push({ id: g.nextId++, type: 'ogive', owner: n.owner, from: n.dst, dst: t, start: g.tick + Math.floor(g.rng() * 20), ticks: Math.max(1, Math.ceil(distance(g, n.dst, t) / BLAST.ogive.speed)) })
    return
  }
  // une défense antiaérienne ennemie à portée abat la bombe (pas les ogives d'un MIRV)
  if (n.type !== 'ogive') {
    const sam = g.units.find((u) => u.type === 'dca' && u.ready <= g.tick && u.cooldown <= g.tick && u.owner !== n.owner && !allied(g, u.owner, n.owner) && dist2(g, u.tile, n.dst) <= samRange(u.level) ** 2)
    if (sam) {
      sam.cooldown = g.tick + SAM_COOLDOWN
      event(g, 'intercepted', sam.owner, n.owner)
      return
    }
  }
  const { inner, outer } = BLAST[n.type]
  // un rayon irrégulier, tiré entre l'intérieur et l'extérieur, lissé tout autour
  const raw = Array.from({ length: 36 }, () => inner + g.rng() * (outer - inner))
  const radii = raw.map((r, i) => (raw[(i + 35) % 36] + r + raw[(i + 1) % 36]) / 3)
  const cx = n.dst % g.w
  const cy = Math.floor(n.dst / g.w)
  const hit = new Map<number, number>()
  for (let dy = -outer; dy <= outer; dy++)
    for (let dx = -outer; dx <= outer; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue
      const r = radii[Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 36) % 36]
      if (dx * dx + dy * dy > r * r) continue
      const t = y * g.w + x
      const o = g.owner[t]
      if (o) {
        hit.set(o, (hit.get(o) ?? 0) + 1)
        setOwner(g, t, 0)
      }
      if (passable(g, t) && !g.fallout[t]) {
        g.fallout[t] = 1
        g.falloutTiles++
        markDirty(g, t)
      }
    }
  for (const [id, count] of hit) {
    const p = player(g, id)
    const before = p.tiles + count
    for (let i = 0; i < count; i++) {
      p.troops = Math.max(0, p.troops - nukeDeaths(p.troops, before - i))
      for (const a of g.attacks) if (a.from === id) a.troops -= nukeDeaths(a.troops, before - i)
    }
    if (allied(g, id, n.owner) && count > NUKE_ALLY_BREAK) breakAlliance(g, n.owner, id)
    if (p.tiles === 0 && p.alive) eliminate(g, p, n.owner)
  }
  for (const u of [...g.units]) if (u.type === 'navire' && dist2(g, u.tile, n.dst) <= outer * outer) removeUnit(g, u)
  g.boats = g.boats.filter((b) => dist2(g, b.path[Math.min(b.at, b.path.length - 1)], n.dst) > outer * outer)
  g.blasts.push({ tile: n.dst, radius: outer, tick: g.tick })
  recountCities(g)
}

// --- alliances ---

export const allianceOf = (g: Game, a: number, b: number) => g.alliances.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))
export const allied = (g: Game, a: number, b: number) => !!allianceOf(g, a, b)

export type AskResult = 'envoyée' | 'alliés' | 'attendre' | null

export function requestAlliance(g: Game, from: number, to: number): AskResult {
  if (!to || from === to || allied(g, from, to) || !player(g, to).alive) return null
  const last = player(g, from).asked.get(to)
  if (last !== undefined && g.tick - last < REQUEST_COOLDOWN) return 'attendre'
  // une demande croisée vaut accord
  if (g.requests.some((r) => r.from === to && r.to === from)) {
    accept(g, to, from)
    return 'alliés'
  }
  player(g, from).asked.set(to, g.tick)
  g.requests.push({ from, to, until: g.tick + REQUEST_TICKS })
  event(g, 'request', from, to)
  return 'envoyée'
}

export function accept(g: Game, from: number, to: number) {
  g.requests = g.requests.filter((r) => !(r.from === from && r.to === to) && !(r.from === to && r.to === from))
  if (allied(g, from, to)) return
  g.alliances.push({ a: from, b: to, until: g.tick + ALLIANCE_TICKS, extend: new Set(), asked: false })
  changeRelation(g, from, to, 20)
  changeRelation(g, to, from, 20)
  event(g, 'accepted', to, from)
}

export function refuse(g: Game, from: number, to: number) {
  g.requests = g.requests.filter((r) => !(r.from === from && r.to === to))
  event(g, 'refused', to, from)
}

// Rompre une alliance fait de soi un traître pendant 30 secondes : défense affaiblie, et tout le monde s'en souvient.
export function breakAlliance(g: Game, by: number, other: number) {
  const a = allianceOf(g, by, other)
  if (!a) return
  g.alliances = g.alliances.filter((x) => x !== a)
  player(g, by).traitorUntil = g.tick + TRAITOR_TICKS
  for (const p of g.players) if (p.id !== by) changeRelation(g, p.id, by, p.id === other ? -100 : -30)
  event(g, 'betrayed', by, other)
}

export function agreeExtension(g: Game, by: number, other: number) {
  const a = allianceOf(g, by, other)
  if (!a) return
  a.extend.add(by)
  if (a.extend.has(a.a) && a.extend.has(a.b)) {
    a.until = g.tick + ALLIANCE_TICKS
    a.extend.clear()
    a.asked = false
  }
}

export function donateTroops(g: Game, from: number, to: number, amount: number) {
  if (!allied(g, from, to)) return
  const p = player(g, from)
  const n = Math.min(amount, p.troops)
  p.troops -= n
  player(g, to).troops += n
}

export function donateGold(g: Game, from: number, to: number, amount: number) {
  if (!allied(g, from, to)) return
  const p = player(g, from)
  const n = Math.min(amount, p.gold)
  p.gold -= n
  player(g, to).gold += n
}

function stepDiplomacy(g: Game) {
  for (const r of g.requests) if (r.until <= g.tick) event(g, 'refused', r.to, r.from)
  g.requests = g.requests.filter((r) => r.until > g.tick)
  for (const a of g.alliances) {
    if (!a.asked && a.until - g.tick <= EXTEND_WINDOW) {
      a.asked = true
      event(g, 'extend', a.a, a.b)
    }
    if (a.until <= g.tick) event(g, 'expired', a.a, a.b)
  }
  g.alliances = g.alliances.filter((a) => a.until > g.tick)
}

// --- encerclement ---

// Un morceau de territoire entièrement cerné par un seul ennemi, sans accès à la mer ni à la terre libre, lui revient.
function annexEnclosed(g: Game, p: Player) {
  if (!p.alive || !p.tiles) return
  const s = nextStamp(g)
  for (const start of [...p.border]) {
    if (g.seen[start] === s || g.owner[start] !== p.id) continue
    let head = 0
    let tail = 0
    g.queue[tail++] = start
    g.seen[start] = s
    let surrounder = 0
    let open = false
    while (head < tail) {
      const t = g.queue[head++]
      const k = neighbors(g, t)
      for (let i = 0; i < k; i++) {
        const n = N1[i]
        const o = g.owner[n]
        if (o === p.id) {
          if (g.seen[n] !== s) {
            g.seen[n] = s
            g.queue[tail++] = n
          }
        } else if (isLand(g, n) && !passable(g, n)) continue
        else if (!isLand(g, n) || !o || (surrounder && o !== surrounder)) open = true
        else surrounder = o
      }
    }
    if (open || !surrounder || allied(g, p.id, surrounder)) continue
    const cluster = Array.from(g.queue.subarray(0, tail))
    p.troops *= 1 - tail / p.tiles
    p.killer = surrounder
    for (const t of cluster) setOwner(g, t, surrounder)
    return
  }
}

// --- le tour ---

export function step(g: Game) {
  g.tick++
  for (const p of g.players) {
    if (!p.alive || !p.spawned) continue
    p.troops += troopGrowth(p.kind, g.level, p.troops, maxTroopsOf(g, p))
    p.gold += goldPerTick(p.kind)
  }
  if (g.units.some((u) => u.ready === g.tick)) recountCities(g)
  g.posts.clear()
  for (const u of g.units)
    if (u.type === 'poste' && u.ready <= g.tick) {
      if (!g.posts.has(u.owner)) g.posts.set(u.owner, [])
      g.posts.get(u.owner)!.push(u.tile)
    }
  g.attacks = g.attacks.filter((a) => stepAttack(g, a))
  g.boats = g.boats.filter((b) => stepBoat(g, b))
  const due = g.nukes.filter((n) => g.tick >= n.start + n.ticks)
  g.nukes = g.nukes.filter((n) => g.tick < n.start + n.ticks)
  for (const n of due) detonate(g, n)
  for (const u of g.units) if (u.type === 'navire' && u.ready <= g.tick) stepWarship(g, u)
  g.shells = g.shells.filter((s) => stepShell(g, s))
  if (g.tick % 10 === 0) spawnTrade(g)
  stepDiplomacy(g)
  const alive = g.players.filter((p) => p.alive && p.spawned)
  if (alive.length) annexEnclosed(g, alive[g.tick % alive.length])
  for (const p of g.players) if (p.alive && p.spawned && p.tiles === 0) eliminate(g, p, p.killer)
  g.blasts = g.blasts.filter((b) => g.tick - b.tick < 15)
}

export function winner(g: Game): number {
  const top = g.players.find((p) => p.alive && p.tiles >= WIN_SHARE * g.land)
  return top ? top.id : 0
}

// Le territoire visé touche-t-il le joueur par la terre ? Sinon il faudra un bateau.
export function reachable(g: Game, from: number, tile: number): boolean {
  const o = g.owner[tile]
  if (!passable(g, tile)) return false
  const s = nextStamp(g)
  let head = 0
  let tail = 0
  g.queue[tail++] = tile
  g.seen[tile] = s
  while (head < tail) {
    const t = g.queue[head++]
    const k = neighbors(g, t)
    for (let i = 0; i < k; i++) {
      const n = N1[i]
      if (g.owner[n] === from) return true
      if (g.seen[n] !== s && g.owner[n] === o && passable(g, n)) {
        g.seen[n] = s
        g.queue[tail++] = n
      }
    }
  }
  return false
}

export type Order = 'terre' | 'mer'

// Le clic gauche : attaque par la terre si le territoire visé touche le joueur, en bateau sinon.
export function attackAt(g: Game, from: number, tile: number, troops: number): Order | null {
  const to = g.owner[tile]
  if (!passable(g, tile) || to === from || (to && allied(g, from, to))) return null
  if (reachable(g, from, tile)) return startAttack(g, from, to, troops) ? 'terre' : null
  return sendBoat(g, from, tile, troops) ? 'mer' : null
}
