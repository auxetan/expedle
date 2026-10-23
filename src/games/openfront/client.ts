// Côté affichage : une copie légère de la partie, tenue à jour par les envois du Worker, sur laquelle
// on dessine et on prépare les menus. En solo, les ordres du joueur partent vers le Worker, qui répond ;
// en ligne, ils partent vers l'hôte et reviennent dans un tour, joué chez tous.
import { addPlayer, createGame, markDirty, player, type Attack, type Game, type Options } from './engine'
import type { Heap } from './heap'
import type { Anchor } from './labels'
import type { WorldMap } from './map'
import type { Net } from './net'
import { PLAYER_FIELDS, type Command, type FromSim, type Reply, type Snapshot } from './protocol'
import { nukeFx, oneShot, type Fx } from './sprites'
import type { Level } from './rules'

export interface Setup {
  map: WorldMap
  level: Level
  // tous les humains dans l'ordre de leur numéro, et celui de cet écran
  humans: string[]
  me: number
  seed: number
  names: Record<string, string>
  nations: number
  tribes: number
  options: Options
  // en ligne seulement
  net?: Net
}

export class Sim {
  readonly g: Game
  labels: Anchor[] = []
  // instant d'arrivée du dernier tour, pour faire glisser bateaux et bombes jusqu'au suivant
  lastTick = 0
  speed = 1
  onTick: () => void = () => {}
  onReady: () => void = () => {}
  readonly me: number
  // en ligne, le dernier tour joué ; la partie ne tourne qu'après la phase de placement
  turn = -1
  readonly net: Net | undefined
  // les effets d'OpenFront en cours, que l'affichage joue puis retire
  fx: Fx[] = []
  private worker: Worker
  private asked = 0
  private waiting = new Map<number, (value: Reply) => void>()
  private paths = new Map<number, Int32Array>()

  constructor({ map, level, humans, me, seed, names, nations, tribes, options, net }: Setup) {
    this.g = createGame(map, level, Math.random, false, options)
    this.me = me
    this.net = net
    this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<FromSim>) => this.receive(e.data)
    this.worker.postMessage({ type: 'init', w: map.w, h: map.h, terrain: map.terrain, level, humans, me, seed, seats: map.seats, names, nations, tribes, options })
    net?.attach((turns) => this.worker.postMessage({ type: 'turns', turns }))
  }

  private receive(m: FromSim) {
    if (m.type === 'reply') {
      this.waiting.get(m.id)?.(m.value)
      this.waiting.delete(m.id)
      return
    }
    if (m.type === 'hash') return this.net?.hash(m.n, m.h)
    if (m.type === 'ready') for (const p of m.players) addPlayer(this.g, p.name, p.kind, p.code)
    this.apply(m.snap)
    this.lastTick = performance.now()
    if (m.type === 'ready') this.onReady()
    else this.onTick()
  }

  // Ce qui a changé d'un tour à l'autre déclenche les effets d'OpenFront : une explosion nouvelle (bombe ou
  // missile abattu), une unité disparue (navire coulé, bâtiment détruit), un obus arrivé, un joueur conquis.
  private effects(s: Snapshot) {
    const g = this.g
    const now = performance.now()
    for (const b of s.blasts)
      if (b.tick === s.tick) {
        if (b.radius > 4) this.fx.push(...nukeFx(b.tile, b.radius >= 80 ? 160 : 70, g.w, now))
        else this.fx.push(oneShot('sam', b.tile, now), { kind: 'samshock', tile: b.tile, at: now, life: 800, fadeIn: 0, fadeOut: 1, radius: 40 })
      }
    const left = new Set(s.units.map((u) => u.id))
    for (const u of g.units)
      if (!left.has(u.id)) {
        if (u.type === 'navire') this.fx.push(oneShot('unit', u.tile, now), oneShot('sinking', u.tile, now))
        else this.fx.push(oneShot('building', u.tile, now))
      }
    for (const shell of g.shells) if (shell.hit <= s.tick) this.fx.push(oneShot('mini', shell.tile, now))
    for (const e of s.events)
      if (e.type === 'eliminated' && e.from) {
        const where = this.labels.find((a) => a.id === e.to)
        if (where) this.fx.push({ ...oneShot('conquest', Math.round(where.y) * g.w + Math.round(where.x), now), life: 2500, fadeIn: 0.1, fadeOut: 0.6 })
      }
  }

  private apply(s: Snapshot) {
    const g = this.g
    if (g.players.length) this.effects(s)
    g.tick = s.tick
    g.mirvs = s.mirvs
    g.falloutTiles = s.falloutTiles
    for (let i = 0; i < s.tiles.length; i += 2) {
      const t = s.tiles[i]
      const v = s.tiles[i + 1]
      g.owner[t] = v & 0xffff
      g.fallout[t] = v >> 16
      markDirty(g, t)
    }
    g.players.forEach((p, i) => {
      const o = i * PLAYER_FIELDS
      p.troops = s.players[o]
      p.gold = s.players[o + 1]
      p.tiles = s.players[o + 2]
      p.alive = s.players[o + 3] === 1
      p.spawned = s.players[o + 4] === 1
      p.traitorUntil = s.players[o + 5]
      p.killer = s.players[o + 6]
      p.cityLevels = s.players[o + 7]
    })
    g.units = s.units
    for (const { id, path } of s.paths) this.paths.set(id, path)
    g.boats = s.boats.map((b) => ({ ...b, path: this.paths.get(b.id) ?? new Int32Array([b.dst]), gold: 0, port: 0 }))
    g.trains = s.trains.map((t) => ({ ...t, path: this.paths.get(t.id) ?? new Int32Array(1), to: 0 }))
    // les chemins des bateaux et trains arrivés ne servent plus
    if (s.tick % 50 === 0) for (const id of this.paths.keys()) if (!s.boats.some((b) => b.id === id) && !s.trains.some((t) => t.id === id)) this.paths.delete(id)
    if (s.rails) g.rails = s.rails
    // l'affichage ne se sert pas de la file de priorité des attaques
    g.attacks = s.attacks.map((a): Attack => ({ ...a, heap: undefined as unknown as Heap, front: new Set(a.front ?? []) }))
    g.nukes = s.nukes
    g.missiles = s.missiles
    g.shells = s.shells
    g.blasts = s.blasts
    g.alliances = s.alliances.map((a) => ({ ...a, extend: new Set(a.extend) }))
    g.requests = s.requests
    g.events.push(...s.events)
    if (s.labels) this.labels = s.labels
    this.turn = s.turn
    const me = player(g, this.me)
    me.target = s.me.target
    me.embargo = new Set(s.me.embargo)
  }

  send(cmd: Command): Promise<Reply> {
    const id = ++this.asked
    if (this.net) this.net.intent(id, cmd)
    else this.worker.postMessage({ type: 'cmd', id, cmd })
    return new Promise((resolve) => this.waiting.set(id, resolve))
  }

  spawn(tile: number) {
    if (this.net) this.send({ op: 'spawn', tile })
    else this.worker.postMessage({ type: 'spawn', tile })
  }

  // en ligne, la partie avance au rythme de l'hôte : ni pause ni vitesse
  run(running: boolean) {
    if (!this.net) this.worker.postMessage({ type: 'run', running })
  }

  setSpeed(value: number) {
    if (this.net) return
    this.speed = value
    this.worker.postMessage({ type: 'speed', value })
  }

  // part du tour suivant déjà écoulée, entre 0 et 1
  progress(now: number) {
    return Math.min(1, ((now - this.lastTick) * this.speed) / 100)
  }

  stop() {
    this.worker.terminate()
  }
}
