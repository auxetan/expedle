import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../lib/util'
import { brainFor, populate, think } from './ai'
import { addPlayer, allied, breakAlliance, build, createGame, LAND, OCEAN, requestAlliance, spawn, step, type Game } from './engine'
import { BUILD_TICKS } from './rules'

function map(rows: string[]) {
  const w = rows[0].length
  const terrain = new Uint8Array(w * rows.length)
  rows.forEach((r, y) => [...r].forEach((ch, x) => (terrain[y * w + x] = ch === '#' ? LAND : OCEAN)))
  return { w, h: rows.length, terrain }
}

const block = (w: number, h: number) => Array.from({ length: h }, () => '#'.repeat(w))
const at = (g: Game, x: number, y: number) => y * g.w + x

function setup(rows = block(80, 40)) {
  const g = createGame(map(rows), 'difficile', mulberry32(7))
  const me = addPlayer(g, 'Moi', 'human')
  const nation = addPlayer(g, 'Nation', 'nation')
  spawn(g, me.id, at(g, 10, 20))
  spawn(g, nation.id, at(g, 70, 20))
  const brain = brainFor(g, nation.id)
  brain.started = true
  return { g, me, nation, brain }
}

describe('nations', () => {
  it('commencent par s’étendre sur la terre libre', () => {
    const { g, nation, brain } = setup()
    brain.started = false
    think(g, brain)
    expect(g.attacks).toEqual([expect.objectContaining({ from: nation.id, to: 0 })])
  })

  it('acceptent l’alliance d’un joueur fiable et refusent celle d’un traître', () => {
    const { g, me, nation, brain } = setup()
    requestAlliance(g, me.id, nation.id)
    think(g, brain)
    expect(allied(g, me.id, nation.id)).toBe(true)
    breakAlliance(g, me.id, nation.id)
    g.players[1].asked.clear()
    me.asked.clear()
    requestAlliance(g, me.id, nation.id)
    think(g, brain)
    expect(allied(g, me.id, nation.id)).toBe(false)
  })

  it('attaquent un voisin bien plus faible une fois la terre libre prise', () => {
    const g = createGame(map(['.' + '#'.repeat(20) + '.']), 'difficile', mulberry32(8))
    const weak = addPlayer(g, 'Faible', 'bot')
    const nation = addPlayer(g, 'Nation', 'nation')
    spawn(g, weak.id, at(g, 3, 0))
    spawn(g, nation.id, at(g, 17, 0))
    const brain = brainFor(g, nation.id)
    think(g, brain)
    for (let i = 0; i < 50; i++) step(g)
    weak.troops = 100
    nation.troops = 1e6
    think(g, brain)
    expect(g.attacks.some((a) => a.from === nation.id && a.to === weak.id)).toBe(true)
  })

  it('bâtissent quand l’or s’accumule', () => {
    const { g, nation, brain } = setup()
    nation.gold = 2_000_000
    for (let i = 0; i < 10; i++) think(g, brain)
    expect(g.units.some((u) => u.owner === nation.id)).toBe(true)
  })

  it('lancent une bombe sur un ennemi quand elles ont un silo et de quoi la payer', () => {
    const { g, me, nation, brain } = setup(block(200, 100))
    nation.gold = 2e6
    build(g, nation.id, 'silo', at(g, 70, 20))
    for (let i = 0; i < BUILD_TICKS.silo; i++) step(g)
    nation.gold = 1e6
    me.tiles = 5000
    for (let i = 0; i < 30 && !g.nukes.length; i++) think(g, brain)
    expect(g.nukes.length).toBe(1)
  })
})

describe('tribus', () => {
  it('acceptent toutes les alliances', () => {
    const { g, me } = setup()
    const tribe = addPlayer(g, 'Tribu', 'bot')
    spawn(g, tribe.id, at(g, 40, 20))
    requestAlliance(g, me.id, tribe.id)
    think(g, { ...brainFor(g, tribe.id), started: true })
    expect(allied(g, me.id, tribe.id)).toBe(true)
  })
})

describe('mise en place', () => {
  it('place les nations sur les plus grands pays, écartées, et disperse les tribus', () => {
    const g = createGame(map(block(200, 100)), 'moyen', mulberry32(9))
    const seats = [
      { code: 'AA', cell: at(g, 20, 20), size: 500 },
      { code: 'BB', cell: at(g, 25, 20), size: 400 },
      { code: 'CC', cell: at(g, 150, 70), size: 300 },
    ]
    const brains = populate(g, seats, 5, 10, (code) => `Pays ${code}`)
    const nations = g.players.filter((p) => p.kind === 'nation').map((p) => p.name)
    expect(nations).toEqual(['Pays AA', 'Pays CC'])
    expect(g.players.filter((p) => p.kind === 'bot').length).toBe(10)
    expect(brains).toHaveLength(12)
  })
})
