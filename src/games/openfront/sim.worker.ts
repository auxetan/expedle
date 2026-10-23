/// <reference lib="webworker" />
// La simulation d'OpenFront, hors du fil de l'affichage : le moteur et l'IA tournent ici à dix tours par seconde,
// et l'affichage ne reçoit à chaque tour que ce qui a changé. Un calcul long ne fige donc jamais l'image.
import { mulberry32 } from '../../lib/util'
import { populate, runAi, type Brain } from './ai'
import { addPlayer, createGame, player, spawn, step, type Game } from './engine'
import { anchors } from './labels'
import { execute, hashOf, playTurn, type Turn } from './lockstep'
import { PLAYER_FIELDS, type FromSim, type Snapshot, type ToSim } from './protocol'
import { TICK_MS } from './rules'

// le joueur de cet écran : le seul humain en solo, sa place dans le salon en ligne
let me = 1
let g: Game
let brains: Brain[] = []
let running = false
let speed = 1
let timer = 0
// chemin de chaque bateau et train tel qu'envoyé à l'affichage : un bateau pris ou rappelé en change
let sent = new Map<number, Int32Array>()
let railKey = ''
// en ligne : les tours reçus, joués un par un au rythme du jeu, et le dernier joué
const queue: Turn[] = []
let turn = -1

const post = (msg: FromSim, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(msg, transfer)

function snapshot(full: boolean): Snapshot {
  const tiles = new Int32Array(g.dirtyCount * 2)
  for (let i = 0; i < g.dirtyCount; i++) {
    const t = g.dirty[i]
    g.dirtyMark[t] = 0
    tiles[2 * i] = t
    tiles[2 * i + 1] = g.owner[t] | (g.fallout[t] << 16)
  }
  g.dirtyCount = 0
  const players = new Float64Array(g.players.length * PLAYER_FIELDS)
  g.players.forEach((p, i) => {
    const o = i * PLAYER_FIELDS
    players.set([p.troops, p.gold, p.tiles, p.alive ? 1 : 0, p.spawned ? 1 : 0, p.traitorUntil, p.killer, p.cityLevels], o)
  })
  if (sent.size > 5000) sent = new Map([...g.boats, ...g.trains].filter((m) => sent.has(m.id)).map((m) => [m.id, sent.get(m.id)!]))
  const paths: Snapshot['paths'] = []
  for (const moving of [...g.boats, ...g.trains])
    if (sent.get(moving.id) !== moving.path) {
      sent.set(moving.id, moving.path)
      paths.push({ id: moving.id, path: moving.path })
    }
  const key = g.rails.map((r) => `${r.a}-${r.b}`).join()
  const rails = full || key !== railKey ? g.rails : undefined
  railKey = key
  const events = g.events
  g.events = []
  return {
    tick: g.tick,
    mirvs: g.mirvs,
    falloutTiles: g.falloutTiles,
    tiles,
    players,
    units: g.units,
    boats: g.boats.map((b) => ({ id: b.id, owner: b.owner, to: b.to, troops: b.troops, at: b.at, trade: b.trade, dst: b.dst, back: b.back })),
    paths,
    trains: g.trains.map((t) => ({ id: t.id, owner: t.owner, at: t.at })),
    rails,
    // le front n'intéresse l'affichage que pour les combats du joueur, pas pour la terre libre
    attacks: g.attacks.map((a) => ({ id: a.id, from: a.from, to: a.to, troops: a.troops, source: a.source, front: a.to && (a.from === me || a.to === me) ? Int32Array.from(a.front) : null })),
    nukes: g.nukes,
    missiles: g.missiles,
    shells: g.shells,
    blasts: g.blasts,
    alliances: g.alliances.map((a) => ({ ...a, extend: [...a.extend] })),
    requests: g.requests,
    events,
    labels: full || g.tick % 10 === 0 ? anchors(g) : undefined,
    me: { target: player(g, me).target, embargo: [...player(g, me).embargo] },
    turn,
  }
}

function send(full = false) {
  const snap = snapshot(full)
  post({ type: 'tick', snap }, [snap.tiles.buffer, snap.players.buffer])
}

function loop() {
  if (!running) return
  const start = performance.now()
  step(g)
  runAi(g, brains)
  send()
  timer = self.setTimeout(loop, Math.max(0, TICK_MS / speed - (performance.now() - start)))
}

// En ligne, un tour par dixième de seconde ; avec du retard en file, on rattrape sans attendre.
function pump() {
  timer = 0
  const next = queue.shift()
  if (!next) return
  playTurn(g, brains, next, (intent, value) => intent.player === me && post({ type: 'reply', id: intent.id, value }))
  turn = next.n
  if (turn % 50 === 0) post({ type: 'hash', n: turn, h: hashOf(g) })
  send()
  timer = self.setTimeout(pump, queue.length > 2 ? 0 : TICK_MS)
}

self.onmessage = (e: MessageEvent<ToSim>) => {
  const m = e.data
  switch (m.type) {
    case 'init': {
      // la même graine partout : en ligne, chaque joueur fait tourner exactement la même partie
      g = createGame({ w: m.w, h: m.h, terrain: m.terrain }, m.level, mulberry32(m.seed), true, m.options)
      for (const name of m.humans) addPlayer(g, name, 'human')
      me = m.me
      brains = populate(g, m.seats, m.nations, m.tribes, (code) => m.names[code] ?? code)
      const snap = snapshot(true)
      post({ type: 'ready', players: g.players.map((p) => ({ id: p.id, name: p.name, kind: p.kind, code: p.code })), snap }, [snap.tiles.buffer, snap.players.buffer])
      break
    }
    case 'spawn':
      spawn(g, me, m.tile)
      send()
      break
    case 'turns':
      queue.push(...m.turns)
      if (!timer) timer = self.setTimeout(pump, 0)
      break
    case 'run':
      running = m.running
      clearTimeout(timer)
      if (running) timer = self.setTimeout(loop, TICK_MS / speed)
      break
    case 'speed':
      speed = m.value
      break
    case 'cmd':
      post({ type: 'reply', id: m.id, value: execute(g, me, m.cmd) })
      break
  }
}
