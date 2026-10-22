/// <reference lib="webworker" />
// La simulation d'OpenFront, hors du fil de l'affichage : le moteur et l'IA tournent ici à dix tours par seconde,
// et l'affichage ne reçoit à chaque tour que ce qui a changé. Un calcul long ne fige donc jamais l'image.
import { populate, runAi, type Brain } from './ai'
import {
  accept,
  addPlayer,
  agreeExtension,
  attackAt,
  breakAlliance,
  build,
  createGame,
  demolish,
  donateGold,
  donateTroops,
  launch,
  moveWarship,
  player,
  refuse,
  requestAlliance,
  recallBoat,
  retreat,
  sendBoat,
  sendEmoji,
  setTarget,
  spawn,
  step,
  toggleEmbargo,
  type Game,
} from './engine'
import { anchors } from './labels'
import { PLAYER_FIELDS, type Command, type FromSim, type Reply, type Snapshot, type ToSim } from './protocol'
import { TICK_MS } from './rules'

const ME = 1
let g: Game
let brains: Brain[] = []
let running = false
let speed = 1
let timer = 0
// chemin de chaque bateau et train tel qu'envoyé à l'affichage : un bateau pris ou rappelé en change
let sent = new Map<number, Int32Array>()
let railKey = ''

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
    // le front n'intéresse l'affichage que pour les attaques du joueur et celles qu'il subit
    attacks: g.attacks.map((a) => ({ id: a.id, from: a.from, to: a.to, troops: a.troops, source: a.source, front: a.from === ME || a.to === ME ? Int32Array.from(a.front) : null })),
    nukes: g.nukes,
    missiles: g.missiles,
    shells: g.shells,
    blasts: g.blasts,
    alliances: g.alliances.map((a) => ({ ...a, extend: [...a.extend] })),
    requests: g.requests,
    events,
    labels: full || g.tick % 10 === 0 ? anchors(g) : undefined,
    me: { target: player(g, ME).target, embargo: [...player(g, ME).embargo] },
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

function run(c: Command): Reply {
  const me = player(g, ME)
  switch (c.op) {
    case 'attack':
      return attackAt(g, ME, c.tile, (me.troops * c.ratio) / 100)
    case 'boat':
      return sendBoat(g, ME, c.tile, (me.troops * c.ratio) / 100)
    case 'build':
      return build(g, ME, c.unit, c.tile)
    case 'launch':
      return launch(g, ME, c.nuke, c.tile)
    case 'demolish':
      return demolish(g, ME, c.tile)
    case 'ally':
      return requestAlliance(g, ME, c.to)
    case 'accept':
      accept(g, c.from, ME)
      return true
    case 'refuse':
      refuse(g, c.from, ME)
      return true
    case 'betray':
      breakAlliance(g, ME, c.other)
      return true
    case 'extend':
      agreeExtension(g, ME, c.other)
      return true
    case 'troops':
      donateTroops(g, ME, c.to, (me.troops * c.ratio) / 100)
      return true
    case 'gold':
      donateGold(g, ME, c.to, me.gold * c.share)
      return true
    case 'retreat':
      retreat(g, c.attack)
      return true
    case 'recall':
      recallBoat(g, c.boat)
      return true
    case 'emoji':
      return sendEmoji(g, ME, c.to, c.emoji)
    case 'target':
      setTarget(g, ME, c.other)
      return true
    case 'embargo':
      toggleEmbargo(g, ME, c.other)
      return true
    case 'move':
      return moveWarship(g, ME, c.unit, c.tile)
  }
}

self.onmessage = (e: MessageEvent<ToSim>) => {
  const m = e.data
  switch (m.type) {
    case 'init': {
      g = createGame({ w: m.w, h: m.h, terrain: m.terrain }, m.level, Math.random, true, m.options)
      addPlayer(g, m.name, 'human')
      brains = populate(g, m.seats, m.nations, m.tribes, (code) => m.names[code] ?? code)
      const snap = snapshot(true)
      post({ type: 'ready', players: g.players.map((p) => ({ id: p.id, name: p.name, kind: p.kind, code: p.code })), snap }, [snap.tiles.buffer, snap.players.buffer])
      break
    }
    case 'spawn':
      spawn(g, ME, m.tile)
      send()
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
      post({ type: 'reply', id: m.id, value: run(m.cmd) })
      break
  }
}
