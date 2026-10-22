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
  RAIL_RANGE,
  REQUEST_COOLDOWN,
  REQUEST_TICKS,
  RETREAT_LOSS,
  SAM_COOLDOWN,
  SAM_SPEED,
  samRange,
  SHELL_DAMAGE,
  SILO_COOLDOWN,
  SPAWN_RADIUS,
  startTroops,
  STRUCTURE_MIN_DIST,
  terrainOf,
  TRAIN_CAP,
  TRAIN_SPEED,
  trainGold,
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
  // silos et défenses antiaériennes : un emplacement de tir par niveau, chacun avec sa fin de recharge
  slots: number[]
  hp: number
  // navires de guerre : le port d'attache et le point visé
  home: number
  goal: number
}

export interface Rail {
  a: number
  b: number
  path: Int32Array
}

export interface Train {
  id: number
  owner: number
  path: Int32Array
  at: number
  // gare de destination
  to: number
}

export interface Missile {
  id: number
  owner: number
  from: number
  nuke: number
  start: number
  ticks: number
}

export interface Nuke {
  id: number
  type: NukeType | 'ogive'
  owner: number
  from: number
  dst: number
  start: number
  ticks: number
  // déjà visée par une défense antiaérienne
  targeted: boolean
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
  rails: Rail[]
  trains: Train[]
  missiles: Missile[]
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
  // numéro du bassin de chaque eau (-1 pour la terre), et distances de travail des routes maritimes
  basin: Int32Array
  dist: Float32Array
  // la carte en blocs de 8×8 cases : un premier itinéraire grossier sur les blocs d'eau
  // borne la recherche fine à un couloir, ce qui la rend rapide même d'un océan à l'autre
  blocks: Blocks
}

const BLOCK = 8

interface Blocks {
  w: number
  h: number
  water: Uint8Array
  seen: Uint32Array
  prev: Int32Array
  dist: Float32Array
  band: Uint32Array
  stamp: number
}

function blocksOf(w: number, h: number, terrain: Uint8Array): Blocks {
  const bw = Math.ceil(w / BLOCK)
  const bh = Math.ceil(h / BLOCK)
  const water = new Uint8Array(bw * bh)
  for (let t = 0; t < w * h; t++) if (!(terrain[t] & LAND)) water[Math.floor(Math.floor(t / w) / BLOCK) * bw + Math.floor((t % w) / BLOCK)] = 1
  const n = bw * bh
  return { w: bw, h: bh, water, seen: new Uint32Array(n), prev: new Int32Array(n), dist: new Float32Array(n), band: new Uint32Array(n), stamp: 0 }
}

// Chaque eau reçoit le numéro de son bassin, en quatre directions comme les bateaux :
// entre deux bassins différents, aucune route n'existe, inutile de la chercher.
function basins(w: number, h: number, terrain: Uint8Array): Int32Array {
  const n = w * h
  const id = new Int32Array(n).fill(-1)
  const queue = new Int32Array(n)
  let next = 0
  for (let start = 0; start < n; start++) {
    if (terrain[start] & LAND || id[start] >= 0) continue
    let head = 0
    let tail = 0
    queue[tail++] = start
    id[start] = next
    while (head < tail) {
      const t = queue[head++]
      const x = t % w
      for (const m of [x > 0 ? t - 1 : -1, x < w - 1 ? t + 1 : -1, t >= w ? t - w : -1, t < n - w ? t + w : -1])
        if (m >= 0 && !(terrain[m] & LAND) && id[m] < 0) {
          id[m] = next
          queue[tail++] = m
        }
    }
    next++
  }
  return id
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
    rails: [],
    trains: [],
    missiles: [],
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
    basin: basins(map.w, map.h, map.terrain),
    dist: new Float32Array(n),
    blocks: blocksOf(map.w, map.h, map.terrain),
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

// tampons de voisines, un par niveau d'imbrication, pour ne rien allouer dans les boucles chaudes
const N1 = new Int32Array(4)
const N2 = new Int32Array(4)
const N3 = new Int32Array(4)
const N4 = new Int32Array(4)

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
  const k = neighbors(g, t, N3)
  for (let i = 0; i < k; i++) {
    refresh(g, N3[i])
    markDirty(g, N3[i])
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
  const k = neighbors(g, t, N4)
  for (let i = 0; i < k; i++) {
    const n = N4[i]
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

// Les côtes de la terre visée, de la plus proche à la plus lointaine (30 au plus, à 40 000 cases de parcours au plus).
function shoresNear(g: Game, tile: number): number[] {
  const o = g.owner[tile]
  const s = nextStamp(g)
  const found: number[] = []
  let head = 0
  let tail = 0
  g.queue[tail++] = tile
  g.seen[tile] = s
  while (head < tail && head < 40_000 && found.length < 30) {
    const t = g.queue[head++]
    if (coastal(g, t)) found.push(t)
    const k = neighbors(g, t)
    for (let i = 0; i < k; i++) {
      const n = N1[i]
      if (g.seen[n] !== s && g.owner[n] === o && passable(g, n)) {
        g.seen[n] = s
        g.queue[tail++] = n
      }
    }
  }
  return found
}

const blockOf = (g: Game, t: number) => Math.floor(Math.floor(t / g.w) / BLOCK) * g.blocks.w + Math.floor((t % g.w) / BLOCK)

// Itinéraire grossier de bloc d'eau en bloc d'eau ; ses blocs et ceux à deux pas forment le couloir permis
// à la recherche fine (marqués du tampon rendu). Rend 0 si les blocs ne se rejoignent pas.
function corridor(g: Game, starts: number[], goal: number): number {
  const b = g.blocks
  const s = ++b.stamp
  const heap = new Heap()
  const target = blockOf(g, goal)
  const tx = target % b.w
  const ty = (target - tx) / b.w
  const h = (c: number) => Math.abs((c % b.w) - tx) + Math.abs(Math.floor(c / b.w) - ty)
  for (const t of starts) {
    const c = blockOf(g, t)
    if (b.seen[c] === s) continue
    b.seen[c] = s
    b.dist[c] = 0
    b.prev[c] = -1
    heap.push(c, h(c))
  }
  while (heap.size) {
    const c = heap.pop()
    if (c === target) {
      for (let k = c; k >= 0; k = b.prev[k]) {
        const x = k % b.w
        const y = (k - x) / b.w
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            if (x + dx >= 0 && y + dy >= 0 && x + dx < b.w && y + dy < b.h) b.band[(y + dy) * b.w + x + dx] = s
      }
      return s
    }
    const x = c % b.w
    const d = b.dist[c] + 1
    for (const m of [x > 0 ? c - 1 : -1, x < b.w - 1 ? c + 1 : -1, c >= b.w ? c - b.w : -1, c < b.w * (b.h - 1) ? c + b.w : -1]) {
      if (m < 0 || !b.water[m] || (b.seen[m] === s && b.dist[m] <= d)) continue
      b.seen[m] = s
      b.dist[m] = d
      b.prev[m] = c
      heap.push(m, d + h(m))
    }
  }
  return 0
}

// Route maritime case par case, en quatre directions comme sur la grille, des eaux `starts` jusqu'à l'eau `goal`.
// La recherche reste dans le couloir des blocs ; si un isthme trompe le couloir, seul le joueur (`thorough`)
// a droit à une recherche sur tout le bassin, trop longue pour les bateaux de l'IA et le commerce.
function route(g: Game, starts: number[], goal: number, thorough: boolean): Int32Array | null {
  const band = corridor(g, starts, goal)
  return (band && search(g, starts, goal, band)) || (thorough ? search(g, starts, goal, 0) : null)
}

// A* sur la grille. L'heuristique, un rien gonflée et départagée par l'écart à la ligne droite,
// garde la recherche étroite et donne un escalier régulier plutôt qu'un L.
function search(g: Game, starts: number[], goal: number, band: number): Int32Array | null {
  const s = nextStamp(g)
  const heap = new Heap()
  const gx = goal % g.w
  const gy = (goal - gx) / g.w
  const sx = starts[0] % g.w
  const sy = (starts[0] - sx) / g.w
  const h = (t: number) => {
    const x = t % g.w
    const y = (t - x) / g.w
    return (Math.abs(x - gx) + Math.abs(y - gy)) * 1.001 + Math.abs((x - gx) * (sy - gy) - (sx - gx) * (y - gy)) * 0.0005
  }
  for (const t of starts) {
    if (g.seen[t] === s) continue
    g.seen[t] = s
    g.dist[t] = 0
    g.prev[t] = -1
    heap.push(t, h(t))
  }
  while (heap.size) {
    const t = heap.pop()
    if (t === goal) {
      const path: number[] = []
      for (let c = t; c >= 0; c = g.prev[c]) path.push(c)
      return Int32Array.from(path.reverse())
    }
    const d = g.dist[t] + 1
    const k = neighbors(g, t)
    for (let i = 0; i < k; i++) {
      const n = N1[i]
      if (!isWater(g, n) || (g.seen[n] === s && g.dist[n] <= d) || (band && g.blocks.band[blockOf(g, n)] !== band)) continue
      g.seen[n] = s
      g.dist[n] = d
      g.prev[n] = t
      heap.push(n, d + h(n))
    }
  }
  return null
}

// Les eaux qui bordent un joueur, rangées par bassin.
function coastsOf(g: Game, id: number): Map<number, number[]> {
  const coasts = new Map<number, number[]>()
  for (const t of player(g, id).border) {
    const k = neighbors(g, t, N2)
    for (let i = 0; i < k; i++) {
      const w = N2[i]
      if (!isWater(g, w)) continue
      const list = coasts.get(g.basin[w])
      if (list) list.push(w)
      else coasts.set(g.basin[w], [w])
    }
  }
  return coasts
}

const nearestTo = (g: Game, list: number[], target: number, count: number) =>
  list.length <= count ? list : [...list].sort((a, b) => dist2(g, a, target) - dist2(g, b, target)).slice(0, count)

// Où débarquer : la côte la plus proche de la case visée qui partage un bassin avec une côte du joueur.
// Une rive de lac intérieur est écartée d'emblée, sans chercher de route.
function landing(g: Game, from: number, tile: number, thorough: boolean): { dst: number; path: Int32Array } | null {
  const coasts = coastsOf(g, from)
  if (!coasts.size) return null
  for (const shore of shoresNear(g, tile)) {
    const k = neighbors(g, shore)
    const waters = Array.from(N1.subarray(0, k)).filter((w) => isWater(g, w) && coasts.has(g.basin[w]))
    for (const w of waters) {
      const path = route(g, nearestTo(g, coasts.get(g.basin[w])!, w, 40), w, thorough)
      if (path) return { dst: shore, path }
    }
  }
  return null
}

export const boatsOf = (g: Game, id: number) => g.boats.filter((b) => b.owner === id && !b.trade).length

// `thorough` : le joueur peut payer une longue recherche de route ; l'IA se contente du couloir.
export function sendBoat(g: Game, from: number, tile: number, troops: number, thorough = true): boolean {
  const p = player(g, from)
  const to = g.owner[tile]
  if (!passable(g, tile) || to === from || (to && allied(g, from, to)) || boatsOf(g, from) >= MAX_BOATS) return false
  const found = landing(g, from, tile, thorough)
  const sent = Math.min(troops, p.troops)
  if (!found || sent < 1) return false
  const { dst, path } = found
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
  // usines et ports se comptent ensemble, comme dans OpenFront
  if (type === 'usine' || type === 'port') return unitCost(type, unitsOf(g, id, 'usine').length + unitsOf(g, id, 'port').length)
  return unitCost(type, unitsOf(g, id, type).length)
}

function removeUnit(g: Game, u: Unit) {
  g.units = g.units.filter((x) => x !== u)
  if (g.unitAt.get(u.tile) === u) g.unitAt.delete(u.tile)
  if (STATIONS.has(u.type)) {
    g.rails = g.rails.filter((r) => r.a !== u.id && r.b !== u.id)
    g.trains = g.trains.filter((t) => t.to !== u.id)
  }
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
    spot.upgrade.slots.push(0)
    spot.upgrade.ready = g.tick + BUILD_TICKS[type]
  } else {
    const u: Unit = { id: g.nextId++, type, owner: id, tile: spot.tile, level: 1, ready: g.tick + BUILD_TICKS[type], cooldown: 0, slots: [0], hp: WARSHIP_HP, home: spot.tile, goal: -1 }
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

// La route d'un port à l'autre, s'ils donnent sur le même bassin.
function portRoute(g: Game, from: number, to: number): Int32Array | null {
  const waters = (t: number) => Array.from(N1.subarray(0, neighbors(g, t))).filter((w) => isWater(g, w))
  const arrival = waters(to)
  for (const w of waters(from)) {
    const goal = arrival.find((a) => g.basin[a] === g.basin[w])
    if (goal !== undefined) return route(g, [w], goal, false)
  }
  return null
}

// Le commerce : de temps en temps, un port envoie un navire vers le port d'un joueur en paix avec lui.
function spawnTrade(g: Game) {
  const ports = g.units.filter((u) => u.type === 'port' && u.ready <= g.tick)
  if (ports.length < 2 || g.boats.filter((b) => b.trade).length >= 80) return
  let charted = false
  for (const port of ports) {
    if (g.rng() * 12 > port.level) continue
    const partners = ports.filter((q) => q.owner !== port.owner && relation(g, q.owner, port.owner) > -50 && !atWar(g, q.owner, port.owner))
    if (!partners.length) continue
    // on commerce surtout avec les ports voisins : un tiers des partenaires, au moins quatre, les plus proches
    const near = partners.sort((a, b) => dist2(g, a.tile, port.tile) - dist2(g, b.tile, port.tile)).slice(0, Math.max(4, Math.ceil(partners.length / 3)))
    const dest = near[Math.floor(g.rng() * near.length)]
    const key = `${port.id}-${dest.id}`
    if (!g.routes.has(key)) {
      // une seule nouvelle route calculée par passage : les autres ports attendent le suivant
      if (charted) continue
      charted = true
      g.routes.set(key, portRoute(g, port.tile, dest.tile))
    }
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
  const silos = unitsOf(g, id, 'silo').filter((u) => u.ready <= g.tick && u.slots.some((c) => c <= g.tick))
  if (!silos.length) return 'silo'
  const cost = priceOf(g, id, type)
  if (p.gold < cost) return 'or'
  p.gold -= cost
  if (type === 'mirv') g.mirvs++
  const silo = silos.reduce((a, b) => (dist2(g, a.tile, tile) <= dist2(g, b.tile, tile) ? a : b))
  silo.slots[silo.slots.findIndex((c) => c <= g.tick)] = g.tick + SILO_COOLDOWN
  g.nukes.push({ id: g.nextId++, type, owner: id, from: silo.tile, dst: tile, start: g.tick, ticks: Math.max(1, Math.ceil(distance(g, silo.tile, tile) / BLAST[type].speed)), targeted: false })
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
    for (const t of tiles) g.nukes.push({ id: g.nextId++, type: 'ogive', owner: n.owner, from: n.dst, dst: t, start: g.tick + Math.floor(g.rng() * 20), ticks: Math.max(1, Math.ceil(distance(g, n.dst, t) / BLAST.ogive.speed)), targeted: false })
    return
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

// Où en est une bombe sur sa route, en case.
export function nukeAt(g: Game, n: Nuke, tick = g.tick): number {
  const k = Math.min(1, Math.max(0, (tick - n.start) / n.ticks))
  const x = Math.round((n.from % g.w) + ((n.dst % g.w) - (n.from % g.w)) * k)
  const y = Math.round(Math.floor(n.from / g.w) + (Math.floor(n.dst / g.w) - Math.floor(n.from / g.w)) * k)
  return y * g.w + x
}

// Une défense antiaérienne tire sur la bombe ennemie qui entre dans sa portée en visant sa zone ;
// son missile part de la défense et abat la bombe en vol. Les ogives d'un MIRV et le MIRV lui-même passent.
function stepSams(g: Game) {
  for (const n of g.nukes) {
    if (n.targeted || g.tick < n.start || n.type === 'ogive' || n.type === 'mirv') continue
    const at = nukeAt(g, n)
    for (const u of g.units) {
      if (u.type !== 'dca' || u.ready > g.tick || u.owner === n.owner || allied(g, u.owner, n.owner)) continue
      const range = samRange(u.level)
      const slot = u.slots.findIndex((c) => c <= g.tick)
      if (slot < 0 || dist2(g, u.tile, at) > range * range || dist2(g, u.tile, n.dst) > (range + 40) ** 2) continue
      u.slots[slot] = g.tick + SAM_COOLDOWN
      n.targeted = true
      g.missiles.push({ id: g.nextId++, owner: u.owner, from: u.tile, nuke: n.id, start: g.tick, ticks: Math.max(1, Math.ceil(distance(g, u.tile, at) / SAM_SPEED)) })
      break
    }
  }
  g.missiles = g.missiles.filter((m) => {
    if (g.tick < m.start + m.ticks) return true
    const n = g.nukes.find((x) => x.id === m.nuke)
    if (n) {
      g.nukes = g.nukes.filter((x) => x !== n)
      g.blasts.push({ tile: nukeAt(g, n), radius: 4, tick: g.tick })
      event(g, 'intercepted', m.owner, n.owner)
    }
    return false
  })
}

const STATIONS = new Set<UnitType>(['ville', 'port', 'usine'])

// Une ligne droite de case en case, ou null si elle passe par l'eau ou une montagne infranchissable.
function line(g: Game, a: number, b: number): Int32Array | null {
  const x0 = a % g.w
  const y0 = Math.floor(a / g.w)
  const x1 = b % g.w
  const y1 = Math.floor(b / g.w)
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  const path = new Int32Array(n + 1)
  for (let i = 0; i <= n; i++) {
    const t = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n)) * g.w + Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n))
    if (!passable(g, t)) return null
    path[i] = t
  }
  return path
}

// Une gare qui ouvre se relie par le rail aux gares amies proches, dès que l'une des deux est une usine.
function connect(g: Game, u: Unit) {
  for (const v of g.units) {
    if (v === u || !STATIONS.has(v.type) || v.ready > g.tick || (u.type !== 'usine' && v.type !== 'usine')) continue
    if ((v.owner !== u.owner && !allied(g, v.owner, u.owner)) || dist2(g, u.tile, v.tile) > RAIL_RANGE * RAIL_RANGE) continue
    if (g.rails.some((r) => (r.a === u.id && r.b === v.id) || (r.a === v.id && r.b === u.id))) continue
    const path = line(g, u.tile, v.tile)
    if (path) g.rails.push({ a: u.id, b: v.id, path })
  }
}

// Les usines lancent des trains sur leurs lignes ; chaque arrivée rapporte de l'or à l'usine et à la gare.
// Une ligne dont les deux bouts ne sont plus amis est coupée.
function stepTrains(g: Game) {
  const unit = new Map(g.units.map((u) => [u.id, u]))
  if (g.tick % 10 === 0)
    g.rails = g.rails.filter((r) => {
      const a = unit.get(r.a)
      const b = unit.get(r.b)
      return !!a && !!b && (a.owner === b.owner || allied(g, a.owner, b.owner))
    })
  for (const u of g.units) {
    if (u.type !== 'usine' || u.ready > g.tick || g.trains.length >= TRAIN_CAP || g.rng() * 120 > u.level) continue
    const lines = g.rails.filter((r) => r.a === u.id || r.b === u.id)
    if (!lines.length) continue
    const r = lines[Math.floor(g.rng() * lines.length)]
    const forward = r.a === u.id
    g.trains.push({ id: g.nextId++, owner: u.owner, path: forward ? r.path : r.path.slice().reverse(), at: 0, to: forward ? r.b : r.a })
  }
  g.trains = g.trains.filter((tr) => {
    tr.at += TRAIN_SPEED
    if (tr.at < tr.path.length - 1) return true
    const station = unit.get(tr.to)
    const gold = trainGold(tr.path.length)
    if (player(g, tr.owner).alive) player(g, tr.owner).gold += gold
    if (station && station.owner !== tr.owner) player(g, station.owner).gold += gold
    return false
  })
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
// On parcourt au plus 10 000 cases par passage : un grand empire n'est pas cerné, et ses enclaves se trouvent vite.
function annexEnclosed(g: Game, p: Player) {
  if (!p.alive || !p.tiles) return
  const s = nextStamp(g)
  let budget = 10_000
  for (const start of p.border) {
    if (budget <= 0) return
    if (g.seen[start] === s || g.owner[start] !== p.id) continue
    let head = 0
    let tail = 0
    g.queue[tail++] = start
    g.seen[start] = s
    let surrounder = 0
    let open = false
    while (head < tail && head < budget) {
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
    budget -= head
    if (open || head < tail || !surrounder || allied(g, p.id, surrounder)) continue
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
  for (const u of g.units) if (u.ready === g.tick && STATIONS.has(u.type)) connect(g, u)
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
  stepSams(g)
  stepTrains(g)
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
