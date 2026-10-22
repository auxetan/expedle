// Côté affichage : une copie légère de la partie, tenue à jour par les envois du Worker, sur laquelle
// on dessine et on prépare les menus ; les ordres du joueur partent vers le Worker, qui répond.
import { addPlayer, createGame, markDirty, type Attack, type Game } from './engine'
import type { Heap } from './heap'
import type { Anchor } from './labels'
import type { WorldMap } from './map'
import { PLAYER_FIELDS, type Command, type FromSim, type Reply, type Snapshot } from './protocol'
import type { Level } from './rules'

export class Sim {
  readonly g: Game
  labels: Anchor[] = []
  // instant d'arrivée du dernier tour, pour faire glisser bateaux et bombes jusqu'au suivant
  lastTick = 0
  speed = 1
  onTick: () => void = () => {}
  onReady: () => void = () => {}
  private worker: Worker
  private asked = 0
  private waiting = new Map<number, (value: Reply) => void>()
  private paths = new Map<number, Int32Array>()

  constructor(map: WorldMap, level: Level, name: string, names: Record<string, string>, nations: number, tribes: number) {
    this.g = createGame(map, level, Math.random, false)
    this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<FromSim>) => this.receive(e.data)
    this.worker.postMessage({ type: 'init', w: map.w, h: map.h, terrain: map.terrain, level, name, seats: map.seats, names, nations, tribes })
  }

  private receive(m: FromSim) {
    if (m.type === 'reply') {
      this.waiting.get(m.id)?.(m.value)
      this.waiting.delete(m.id)
      return
    }
    if (m.type === 'ready') for (const p of m.players) addPlayer(this.g, p.name, p.kind, p.code)
    this.apply(m.snap)
    this.lastTick = performance.now()
    if (m.type === 'ready') this.onReady()
    else this.onTick()
  }

  private apply(s: Snapshot) {
    const g = this.g
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
  }

  send(cmd: Command): Promise<Reply> {
    const id = ++this.asked
    this.worker.postMessage({ type: 'cmd', id, cmd })
    return new Promise((resolve) => this.waiting.set(id, resolve))
  }

  spawn(tile: number) {
    this.worker.postMessage({ type: 'spawn', tile })
  }

  run(running: boolean) {
    this.worker.postMessage({ type: 'run', running })
  }

  setSpeed(value: number) {
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
