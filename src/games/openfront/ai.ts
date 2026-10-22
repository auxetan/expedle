// Les adversaires d'OpenFront. Les nations jouent par à-coups réguliers : elles s'étendent, ripostent,
// attaquent le voisin faible ou le traître, prennent la mer, bâtissent et, en difficile, lancent des bombes.
// Les tribus, plus petites, acceptent toute alliance et grignotent ce qui les entoure.
import {
  accept,
  addPlayer,
  agreeExtension,
  allied,
  build,
  isLand,
  isTraitor,
  launch,
  maxTroopsOf,
  neighbors,
  passable,
  player,
  priceOf,
  refuse,
  relation,
  requestAlliance,
  sendBoat,
  spawn,
  startAttack,
  unitsOf,
  type Game,
  type Player,
} from './engine'
import type { Level, UnitType } from './rules'

export interface Brain {
  id: number
  // un coup tous les `rate` tours, au tour `offset`
  rate: number
  offset: number
  // part du plafond de troupes à atteindre avant d'attaquer, et à garder en réserve
  trigger: number
  reserve: number
  // le tout premier coup est une expansion, quelles que soient les troupes
  started: boolean
}

const RATE: Record<Level, [number, number]> = { facile: [65, 100], moyen: [55, 70], difficile: [45, 60], impossible: [30, 50] }
const between = (g: Game, lo: number, hi: number) => lo + Math.floor(g.rng() * (hi - lo))

export function brainFor(g: Game, id: number): Brain {
  const [lo, hi] = player(g, id).kind === 'bot' ? [40, 80] : RATE[g.level]
  const rate = between(g, lo, hi)
  return { id, rate, offset: between(g, 0, rate), trigger: between(g, 50, 60) / 100, reserve: between(g, 30, 40) / 100, started: false }
}

export function runAi(g: Game, brains: Brain[]) {
  for (const b of brains) {
    const phase = g.tick % b.rate
    if (phase === b.offset) think(g, b)
    else if (player(g, b.id).kind === 'nation' && (phase === (b.offset + Math.floor(b.rate / 3)) % b.rate || phase === (b.offset + Math.floor((2 * b.rate) / 3)) % b.rate)) structures(g, player(g, b.id))
  }
}

export function think(g: Game, b: Brain) {
  const p = player(g, b.id)
  if (!p.alive || !p.spawned) return
  if (!b.started) {
    b.started = true
    startAttack(g, p.id, 0, p.troops / 5)
    return
  }
  diplomacy(g, p)
  if (p.kind === 'nation') {
    structures(g, p)
    nukes(g, p)
  }
  attack(g, p, b)
}

// --- diplomatie ---

function diplomacy(g: Game, p: Player) {
  for (const r of g.requests.filter((x) => x.to === p.id)) {
    const asker = player(g, r.from)
    const trusted = !isTraitor(g, asker) && relation(g, p.id, asker.id) > -20
    // une tribu dit toujours oui ; une nation, si l'autre est fiable et pas trop faible pour valoir quelque chose
    if (p.kind === 'bot' || (trusted && (asker.troops > p.troops * 0.4 || g.rng() < 0.5))) accept(g, r.from, p.id)
    else refuse(g, r.from, p.id)
  }
  for (const a of g.alliances)
    if ((a.a === p.id || a.b === p.id) && a.asked) {
      const other = a.a === p.id ? a.b : a.a
      if (p.kind === 'bot' || relation(g, p.id, other) >= 0) agreeExtension(g, p.id, other)
    }
}

// --- attaques ---

function around(g: Game, p: Player): { free: boolean; rivals: Player[] } {
  let free = false
  const seen = new Set<number>()
  const out = new Int32Array(4)
  for (const t of p.border) {
    const k = neighbors(g, t, out)
    for (let i = 0; i < k; i++) {
      const n = out[i]
      if (!passable(g, n)) continue
      const o = g.owner[n]
      if (!o) free = true
      else if (o !== p.id) seen.add(o)
    }
  }
  return { free, rivals: [...seen].map((id) => player(g, id)).sort((a, b) => a.troops - b.troops) }
}

function spare(g: Game, p: Player, b: Brain): number {
  return p.troops - maxTroopsOf(g, p) * b.reserve
}

function attack(g: Game, p: Player, b: Brain) {
  const max = maxTroopsOf(g, p)
  const ready = p.troops >= max * b.trigger
  const { free, rivals } = around(g, p)
  const enemies = rivals.filter((r) => !allied(g, p.id, r.id))

  // riposte contre qui nous attaque
  const attacker = g.attacks.find((a) => a.to === p.id && enemies.some((e) => e.id === a.from))
  if (attacker && spare(g, p, b) > 0) {
    startAttack(g, p.id, attacker.from, spare(g, p, b))
    return
  }
  if (free) {
    if (ready) startAttack(g, p.id, 0, spare(g, p, b))
    return
  }
  if (!enemies.length) {
    if (ready && g.rng() < 1 / 5) boat(g, p, spare(g, p, b))
    return
  }
  if (ready && g.rng() < 1 / 10) {
    boat(g, p, spare(g, p, b))
    return
  }
  // une nation menacée cherche un allié plus fort qu'elle
  if (p.kind === 'nation') for (const e of enemies) if (e.troops > p.troops * 1.5 && !isTraitor(g, e) && g.rng() < 0.1) requestAlliance(g, p.id, e.id)
  if (!ready) return
  const traitor = enemies.find((e) => isTraitor(g, e))
  const target = traitor ?? enemies[0]
  if (traitor || p.troops > target.troops * (p.kind === 'bot' ? 2 : 1.2)) startAttack(g, p.id, target.id, spare(g, p, b))
}

// Quelques tirages au hasard sur la carte, la terre libre d'abord : chaque essai calcule une traversée.
function boat(g: Game, p: Player, troops: number) {
  for (let i = 0; i < 30; i++) {
    const t = Math.floor(g.rng() * g.owner.length)
    if (!isLand(g, t) || !passable(g, t) || g.owner[t] === p.id) continue
    if (g.owner[t] && (i < 20 || allied(g, p.id, g.owner[t]))) continue
    sendBoat(g, p.id, t, troops)
    return
  }
}

// --- bâtiments et bombes ---

function ownTile(g: Game, p: Player): number {
  const border = [...p.border]
  const a = border[Math.floor(g.rng() * border.length)]
  const b = p.spawn[Math.floor(g.rng() * p.spawn.length)] ?? a
  // un point entre le cœur et la frontière, pour ne pas tout bâtir en première ligne
  const k = 0.3 + g.rng() * 0.5
  const x = Math.round((b % g.w) * (1 - k) + (a % g.w) * k)
  const y = Math.round(Math.floor(b / g.w) * (1 - k) + Math.floor(a / g.w) * k)
  const t = y * g.w + x
  return g.owner[t] === p.id ? t : a
}

function wish(g: Game, p: Player): UnitType | null {
  const count = (type: UnitType) => unitsOf(g, p.id, type).length
  const enemiesHaveSilos = g.units.some((u) => u.type === 'silo' && u.owner !== p.id && !allied(g, p.id, u.owner))
  if (!count('port') && p.tiles > 300 && [...p.border].some((t) => !isLand(g, t - 1) || !isLand(g, t + 1))) return 'port'
  if (enemiesHaveSilos && !count('dca') && g.level !== 'facile') return 'dca'
  if (p.troops > maxTroopsOf(g, p) * 0.7 || count('ville') < p.tiles / 4000) return 'ville'
  if ((g.level === 'difficile' || g.level === 'impossible') && !count('silo') && p.tiles > 3000) return 'silo'
  if (count('poste') < 2 && g.rng() < 0.3) return 'poste'
  if (count('port') && count('navire') < 2 && g.rng() < 0.2) return 'navire'
  return null
}

function structures(g: Game, p: Player) {
  const type = wish(g, p)
  if (!type || p.gold < priceOf(g, p.id, type)) return
  for (let i = 0; i < 6; i++) if (build(g, p.id, type, ownTile(g, p)) === 'ok') return
}

function nukes(g: Game, p: Player) {
  if (g.level === 'facile' || !unitsOf(g, p.id, 'silo').some((s) => s.ready <= g.tick && s.cooldown <= g.tick)) return
  const type = p.gold >= priceOf(g, p.id, 'hbombe') ? 'hbombe' : p.gold >= priceOf(g, p.id, 'bombe') ? 'bombe' : null
  if (!type || (g.level === 'moyen' && g.rng() > 0.3)) return
  // la cible : l'ennemi le plus étendu, sur une de ses villes si possible
  const target = g.players.filter((o) => o.alive && o.id !== p.id && o.tiles && !allied(g, p.id, o.id)).sort((a, b) => b.tiles - a.tiles)[0]
  if (!target) return
  const cities = unitsOf(g, target.id, 'ville')
  const border = [...target.border]
  const tile = cities.length ? cities[Math.floor(g.rng() * cities.length)].tile : border[Math.floor(g.rng() * border.length)]
  if (tile !== undefined) launch(g, p.id, type, tile)
}

// --- mise en place ---

export interface SeatLike {
  code: string
  cell: number
  size: number
}

const SYLLABLES = ['ka', 'lo', 've', 'mi', 'ra', 'to', 'su', 'ne', 'ba', 'di', 'zo', 'fa', 're', 'tu', 'ni', 'sa', 'go', 'ly', 'pe', 'mo', 'an', 'or', 'il', 'ur']

function tribeName(g: Game): string {
  const n = 2 + Math.floor(g.rng() * 2)
  const s = Array.from({ length: n }, () => SYLLABLES[Math.floor(g.rng() * SYLLABLES.length)]).join('')
  return s[0].toUpperCase() + s.slice(1)
}

// Les nations prennent les plus grands pays, assez loin les unes des autres ; les tribus se dispersent sur le reste.
export function populate(g: Game, seats: SeatLike[], nations: number, tribes: number, name: (code: string) => string): Brain[] {
  const centers: number[] = []
  const far = (t: number, d: number) => centers.every((c) => ((c % g.w) - (t % g.w)) ** 2 + (Math.floor(c / g.w) - Math.floor(t / g.w)) ** 2 >= d * d)
  for (const s of [...seats].sort((a, b) => b.size - a.size)) {
    if (centers.length >= nations) break
    if (s.cell < 0 || !passable(g, s.cell) || !far(s.cell, 30)) continue
    const p = addPlayer(g, name(s.code), 'nation', s.code)
    if (spawn(g, p.id, s.cell)) centers.push(s.cell)
  }
  for (let i = 0, placed = 0; i < tribes * 40 && placed < tribes; i++) {
    const t = Math.floor(g.rng() * g.owner.length)
    if (!passable(g, t) || g.owner[t] || !far(t, 20)) continue
    const p = addPlayer(g, tribeName(g), 'bot')
    if (spawn(g, p.id, t)) {
      centers.push(t)
      placed++
    }
  }
  return g.players.filter((p) => p.kind !== 'human').map((p) => brainFor(g, p.id))
}
