// Le tour par tour partagé, comme sur OpenFront : chaque joueur fait tourner la même partie à partir de la même
// graine, et tous reçoivent les mêmes ordres, dans le même ordre. Seuls les ordres circulent, jamais la carte.
import { runAi, type Brain } from './ai'
import {
  accept,
  agreeExtension,
  attackAt,
  breakAlliance,
  build,
  demolish,
  donateGold,
  donateTroops,
  launch,
  moveWarship,
  player,
  recallBoat,
  refuse,
  requestAlliance,
  retreat,
  sendBoat,
  sendChat,
  sendEmoji,
  setTarget,
  spawn,
  step,
  toggleEmbargo,
  type Game,
} from './engine'
import type { Command, Reply } from './protocol'
import { SPAWN_TICKS } from './rules'

// les premiers tours servent à choisir son point de départ ; la partie ne tourne qu'ensuite.
// Comme sur OpenFront, on laisse deux fois plus de temps qu'en solo pour se placer à plusieurs.
export const SPAWN_TURNS = 2 * SPAWN_TICKS

// un ordre, au nom d'un joueur ; `id` permet à son seul auteur de retrouver la réponse
export interface Intent {
  player: number
  id: number
  cmd: Command
}

export interface Turn {
  n: number
  intents: Intent[]
}

// Exécute l'ordre d'un joueur. En ligne, chacun ne peut agir que sur ce qui est à lui.
export function execute(g: Game, id: number, c: Command, turn = Infinity): Reply {
  const me = player(g, id)
  switch (c.op) {
    case 'spawn':
      return turn < SPAWN_TURNS && spawn(g, id, c.tile)
    case 'attack':
      return attackAt(g, id, c.tile, (me.troops * c.ratio) / 100)
    case 'boat':
      return sendBoat(g, id, c.tile, (me.troops * c.ratio) / 100)
    case 'build':
      return build(g, id, c.unit, c.tile)
    case 'launch':
      return launch(g, id, c.nuke, c.tile)
    case 'demolish':
      return demolish(g, id, c.tile)
    case 'ally':
      return requestAlliance(g, id, c.to)
    case 'accept':
      if (!g.requests.some((r) => r.from === c.from && r.to === id)) return false
      accept(g, c.from, id)
      return true
    case 'refuse':
      refuse(g, c.from, id)
      return true
    case 'betray':
      breakAlliance(g, id, c.other)
      return true
    case 'extend':
      agreeExtension(g, id, c.other)
      return true
    case 'troops':
      donateTroops(g, id, c.to, (me.troops * c.ratio) / 100)
      return true
    case 'gold':
      donateGold(g, id, c.to, me.gold * c.share)
      return true
    case 'retreat':
      if (!g.attacks.some((a) => a.id === c.attack && a.from === id)) return false
      retreat(g, c.attack)
      return true
    case 'recall':
      if (!g.boats.some((b) => b.id === c.boat && b.owner === id)) return false
      recallBoat(g, c.boat)
      return true
    case 'emoji':
      return sendEmoji(g, id, c.to, c.emoji)
    case 'chat':
      return sendChat(g, id, c.to, c.phrase, c.about)
    case 'target':
      return setTarget(g, id, c.other)
    case 'embargo':
      toggleEmbargo(g, id, c.other)
      return true
    case 'move':
      return moveWarship(g, id, c.unit, c.tile)
  }
}

// Joue un tour : les ordres reçus, puis un pas de la partie une fois la phase de placement passée.
export function playTurn(g: Game, brains: Brain[], turn: Turn, reply?: (intent: Intent, value: Reply) => void) {
  for (const intent of turn.intents) {
    const value = execute(g, intent.player, intent.cmd, turn.n)
    reply?.(intent, value)
  }
  if (turn.n >= SPAWN_TURNS) {
    step(g)
    runAi(g, brains)
  }
}

// L'empreinte de la partie : deux joueurs restés d'accord ont la même ; sinon, l'un d'eux a décroché.
export function hashOf(g: Game): number {
  let h = 2166136261
  const mix = (v: number) => {
    h ^= v
    h = Math.imul(h, 16777619)
  }
  for (let t = 0; t < g.owner.length; t++) mix(g.owner[t])
  for (const p of g.players) {
    mix(Math.floor(p.troops))
    mix(Math.floor(p.gold))
    mix(p.tiles)
  }
  mix(g.tick)
  return h >>> 0
}
