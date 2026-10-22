import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../lib/util'
import { LEVELS, think } from './bots'
import { addPlayer, createGame, NEUTRAL, spawn, type MapGrid } from './engine'

function grid(rows: string[]): MapGrid {
  const w = rows[0].length
  const land = new Uint8Array(w * rows.length)
  rows.forEach((r, y) => [...r].forEach((ch, x) => (land[y * w + x] = ch === '#' ? 1 : 0)))
  return { w, h: rows.length, land }
}

describe('bots', () => {
  it('s’étendent sur la terre libre quand ils ont des troupes', () => {
    const g = createGame(grid(['.####################.']), mulberry32(1))
    const bot = addPlayer(g, 'Bot')
    spawn(g, bot.id, 3)
    think(g, bot.id, LEVELS.normal)
    expect(g.attacks).toEqual([expect.objectContaining({ from: bot.id, to: NEUTRAL })])
  })

  it('prennent la mer quand leur île est pleine', () => {
    const g = createGame(grid(['.###.....###.', '.###.....###.', '.###.....###.']), mulberry32(2))
    const bot = addPlayer(g, 'Bot')
    spawn(g, bot.id, 13 + 2)
    bot.troops = 2000
    think(g, bot.id, LEVELS.normal)
    expect(g.boats.length).toBe(1)
  })

  it('attaquent un voisin plus faible', () => {
    const g = createGame(grid(['.##########.']), mulberry32(3))
    const bot = addPlayer(g, 'Bot')
    const weak = addPlayer(g, 'Faible')
    spawn(g, bot.id, 2)
    spawn(g, weak.id, 9)
    bot.troops = 1500
    weak.troops = 50
    think(g, bot.id, LEVELS.normal)
    expect(g.attacks).toEqual([expect.objectContaining({ from: bot.id, to: weak.id })])
  })

  it('bâtissent une ville quand ils ont de quoi', () => {
    const g = createGame(grid(['.##########.', '.##########.']), mulberry32(4))
    const bot = addPlayer(g, 'Bot')
    const other = addPlayer(g, 'Autre')
    spawn(g, bot.id, 2)
    spawn(g, other.id, 9)
    bot.gold = 1e6
    for (let i = 0; i < 20 && !g.cities.size; i++) think(g, bot.id, LEVELS.normal)
    expect(g.cities.size).toBe(1)
  })
})
