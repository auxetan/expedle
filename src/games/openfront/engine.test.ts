import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../lib/util'
import {
  addPlayer,
  attackAt,
  buildCity,
  cityCost,
  createGame,
  maxTroops,
  NEUTRAL,
  neighbors,
  player,
  spawn,
  startAttack,
  step,
  WATER,
  winner,
  type Game,
  type MapGrid,
} from './engine'

// '#' : terre, '.' : mer
function grid(rows: string[]): MapGrid {
  const w = rows[0].length
  const land = new Uint8Array(w * rows.length)
  rows.forEach((r, y) => [...r].forEach((ch, x) => (land[y * w + x] = ch === '#' ? 1 : 0)))
  return { w, h: rows.length, land }
}

const at = (g: Game, x: number, y: number) => y * g.w + x
const run = (g: Game, n: number) => {
  for (let i = 0; i < n; i++) step(g)
}

describe('carte', () => {
  it('compte la terre et marque la mer', () => {
    const g = createGame(grid(['##..', '#...']))
    expect(g.land).toBe(3)
    expect(g.owner[at(g, 2, 0)]).toBe(WATER)
    expect(g.owner[at(g, 0, 0)]).toBe(NEUTRAL)
  })

  it('se referme d’est en ouest comme le globe', () => {
    const g = createGame(grid(['#..#', '#..#']))
    expect(neighbors(g, at(g, 0, 0))).toContain(at(g, 3, 0))
    expect(neighbors(g, at(g, 0, 0))).toContain(at(g, 0, 1))
    expect(neighbors(g, at(g, 0, 0))).not.toContain(at(g, 0, -1))
  })
})

describe('apparition', () => {
  it('prend un disque de terre libre autour du point choisi', () => {
    const g = createGame(grid(['#########', '#########', '#########', '#########', '#########', '#########', '#########']))
    const p = addPlayer(g, 'A')
    expect(spawn(g, p.id, at(g, 4, 3))).toBe(true)
    expect(p.cells).toBeGreaterThan(20)
    expect(g.owner[at(g, 4, 3)]).toBe(p.id)
    expect(g.owner[at(g, 0, 0)]).toBe(NEUTRAL)
  })

  it('refuse la mer et les terres déjà prises', () => {
    const g = createGame(grid(['###.', '###.']))
    const a = addPlayer(g, 'A')
    const b = addPlayer(g, 'B')
    expect(spawn(g, a.id, at(g, 3, 0))).toBe(false)
    spawn(g, a.id, at(g, 0, 0))
    expect(spawn(g, b.id, at(g, 0, 0))).toBe(false)
  })
})

describe('troupes', () => {
  it('grandissent sans dépasser le plafond', () => {
    const g = createGame(grid(['#####', '#####', '#####']))
    const p = addPlayer(g, 'A')
    spawn(g, p.id, at(g, 2, 1))
    const before = p.troops
    run(g, 5)
    expect(p.troops).toBeGreaterThan(before)
    run(g, 3000)
    expect(p.troops).toBeLessThanOrEqual(maxTroops(g, p) + 1e-6)
  })
})

describe('attaques', () => {
  it('conquièrent la terre libre voisine en dépensant des troupes', () => {
    const g = createGame(grid(['.####################.']), mulberry32(1))
    const p = addPlayer(g, 'A')
    spawn(g, p.id, at(g, 3, 0))
    const cells = p.cells
    startAttack(g, p.id, NEUTRAL, 40)
    run(g, 3)
    expect(p.cells).toBeGreaterThan(cells)
    expect(g.attacks.length).toBe(1)
  })

  it('rendent les troupes restantes quand il n’y a plus rien à prendre', () => {
    const g = createGame(grid(['.#########.']), mulberry32(2))
    const p = addPlayer(g, 'A')
    spawn(g, p.id, at(g, 2, 0))
    p.troops = 1000
    startAttack(g, p.id, NEUTRAL, 500)
    run(g, 20)
    expect(p.cells).toBe(9)
    expect(g.attacks.length).toBe(0)
    expect(p.troops).toBeGreaterThan(900)
  })

  it('prennent les cases d’un rival et lui coûtent des troupes, jusqu’à l’éliminer', () => {
    const g = createGame(grid(['.##########.']), mulberry32(3))
    const a = addPlayer(g, 'A')
    const b = addPlayer(g, 'B')
    spawn(g, a.id, at(g, 2, 0))
    spawn(g, b.id, at(g, 9, 0))
    a.troops = 50_000
    b.troops = 20
    startAttack(g, a.id, b.id, 40_000)
    run(g, 40)
    expect(b.alive).toBe(false)
    expect(b.killer).toBe(a.id)
    expect(a.cells).toBe(10)
  })

  it('s’annulent quand deux joueurs s’attaquent en même temps', () => {
    const g = createGame(grid(['.##########.']))
    const a = addPlayer(g, 'A')
    const b = addPlayer(g, 'B')
    spawn(g, a.id, at(g, 2, 0))
    spawn(g, b.id, at(g, 9, 0))
    a.troops = 1000
    b.troops = 1000
    startAttack(g, a.id, b.id, 300)
    startAttack(g, b.id, a.id, 500)
    expect(g.attacks).toEqual([{ from: b.id, to: a.id, troops: 200 }])
  })
})

describe('bateaux', () => {
  const islands = ['.###.....###.', '.###.....###.', '.###.....###.']

  it('traversent la mer et débarquent sur l’autre rive', () => {
    const g = createGame(grid(islands), mulberry32(4))
    const p = addPlayer(g, 'A')
    spawn(g, p.id, at(g, 2, 1))
    p.troops = 500
    expect(attackAt(g, p.id, at(g, 10, 1), 300)).toBe('mer')
    expect(g.boats.length).toBe(1)
    run(g, 30)
    expect(g.boats.length).toBe(0)
    expect(g.owner[at(g, 10, 1)]).toBe(p.id)
  })

  it('ne servent pas quand la cible touche déjà le joueur', () => {
    const g = createGame(grid(['.############.']))
    const p = addPlayer(g, 'A')
    spawn(g, p.id, at(g, 3, 0))
    expect(attackAt(g, p.id, at(g, 11, 0), 50)).toBe('terre')
    expect(attackAt(g, p.id, at(g, 3, 0), 50)).toBeNull()
  })
})

describe('villes', () => {
  it('coûtent de l’or, se bâtissent chez soi et relèvent le plafond de troupes', () => {
    const g = createGame(grid(['.#########.', '.#########.']))
    const a = addPlayer(g, 'A')
    const b = addPlayer(g, 'B')
    spawn(g, a.id, at(g, 2, 0))
    spawn(g, b.id, at(g, 8, 1))
    const city = at(g, 2, 0)
    expect(buildCity(g, a.id, city)).toBe(false)
    a.gold = cityCost(g, a.id)
    const max = maxTroops(g, a)
    expect(buildCity(g, a.id, at(g, 8, 1))).toBe(false)
    expect(buildCity(g, a.id, city)).toBe(true)
    expect(a.gold).toBe(0)
    expect(maxTroops(g, a)).toBeGreaterThan(max)
    expect(cityCost(g, a.id)).toBeGreaterThan(cityCost(g, b.id))
  })
})

describe('victoire', () => {
  it('revient à qui tient 80 % des terres', () => {
    const g = createGame(grid(['.##########.']))
    const a = addPlayer(g, 'A')
    const b = addPlayer(g, 'B')
    spawn(g, a.id, at(g, 2, 0))
    spawn(g, b.id, at(g, 9, 0))
    expect(winner(g)).toBe(0)
    a.troops = 100_000
    startAttack(g, a.id, b.id, 50_000)
    run(g, 3)
    expect(player(g, a.id).cells / g.land).toBeGreaterThanOrEqual(0.8)
    expect(winner(g)).toBe(a.id)
  })
})
