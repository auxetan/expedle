import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../lib/util'
import { populate } from './ai'
import { addPlayer, createGame, LAND } from './engine'
import { hashOf, playTurn, SPAWN_TURNS, type Turn } from './lockstep'

const W = 120
const H = 60

// deux humains, quelques nations et tribus, sur une même terre, à partir d'une graine
function match(seed: number) {
  const g = createGame({ w: W, h: H, terrain: new Uint8Array(W * H).fill(LAND) }, 'moyen', mulberry32(seed))
  addPlayer(g, 'A', 'human')
  addPlayer(g, 'B', 'human')
  const seats = [
    { code: 'FR', name: 'FR', cell: 15 * W + 60, size: 10 },
    { code: 'DE', name: 'DE', cell: 45 * W + 60, size: 9 },
  ]
  const brains = populate(g, seats, 2, 6)
  return { g, brains }
}

// les ordres des deux joueurs : apparaître, puis s'étendre et s'attaquer
function orders(n: number): Turn {
  const intents: Turn['intents'] = []
  if (n === 3) intents.push({ player: 1, id: 1, cmd: { op: 'spawn', tile: 30 * W + 10 } })
  if (n === 5) intents.push({ player: 2, id: 1, cmd: { op: 'spawn', tile: 30 * W + 110 } })
  if (n === SPAWN_TURNS + 1) intents.push({ player: 1, id: 2, cmd: { op: 'attack', tile: 30 * W + 20, ratio: 40 } }, { player: 2, id: 2, cmd: { op: 'attack', tile: 30 * W + 100, ratio: 40 } })
  if (n === SPAWN_TURNS + 150) intents.push({ player: 1, id: 3, cmd: { op: 'attack', tile: 30 * W + 100, ratio: 60 } })
  return { n, intents }
}

function play(seed: number, change?: (turn: Turn) => Turn) {
  const { g, brains } = match(seed)
  const hashes: number[] = []
  for (let n = 0; n < SPAWN_TURNS + 300; n++) {
    playTurn(g, brains, change ? change(orders(n)) : orders(n))
    if (n % 50 === 0) hashes.push(hashOf(g))
  }
  return { g, hashes }
}

describe('tour par tour partagé', () => {
  it('donne exactement la même partie à deux joueurs qui reçoivent les mêmes ordres', () => {
    const a = play(42)
    const b = play(42)
    expect(a.hashes).toEqual(b.hashes)
    expect(a.g.players[0].tiles).toBeGreaterThan(50)
    expect(a.g.players[1].tiles).toBeGreaterThan(50)
  })

  it('n’apparaît et ne joue qu’après la phase de placement', () => {
    const { g } = play(42)
    expect(g.tick).toBe(300)
    expect(g.players[0].spawned && g.players[1].spawned).toBe(true)
  })

  it('diverge dès qu’un ordre change, ce que l’empreinte permet de repérer', () => {
    const a = play(42)
    const b = play(42, (turn) => (turn.n === SPAWN_TURNS + 1 ? { n: turn.n, intents: turn.intents.filter((i) => i.player === 1) } : turn))
    expect(a.hashes.at(-1)).not.toBe(b.hashes.at(-1))
  })

  it('refuse d’apparaître une fois la partie lancée', () => {
    const { g, brains } = match(1)
    for (let n = 0; n <= SPAWN_TURNS; n++) playTurn(g, brains, { n, intents: [] })
    const replies: unknown[] = []
    playTurn(g, brains, { n: SPAWN_TURNS + 1, intents: [{ player: 1, id: 1, cmd: { op: 'spawn', tile: 30 * W + 10 } }] }, (_, value) => replies.push(value))
    expect(replies).toEqual([false])
    expect(g.players[0].spawned).toBe(false)
  })
})
