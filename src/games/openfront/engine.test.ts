import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../lib/util'
import {
  accept,
  addPlayer,
  agreeExtension,
  allied,
  attackAt,
  breakAlliance,
  build,
  createGame,
  isTraitor,
  launch,
  LAND,
  maxTroopsOf,
  neighbors,
  OCEAN,
  player,
  priceOf,
  recallBoat,
  requestAlliance,
  sendBoat,
  spawn,
  startAttack,
  step,
  winner,
  type Game,
} from './engine'
import { ALLIANCE_TICKS, BUILD_TICKS, CITY_TROOPS, MAX_BOATS, TRAITOR_TICKS } from './rules'

// '#' plaine, '^' montagne, 'x' infranchissable, '.' mer
function map(rows: string[]) {
  const w = rows[0].length
  const terrain = new Uint8Array(w * rows.length)
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      terrain[y * w + x] = ch === '#' ? LAND : ch === '^' ? LAND | 25 : ch === 'x' ? LAND | 31 : OCEAN
    }),
  )
  return { w, h: rows.length, terrain }
}

const block = (w: number, h: number, ch = '#') => Array.from({ length: h }, () => ch.repeat(w))
const at = (g: Game, x: number, y: number) => y * g.w + x
const run = (g: Game, n: number) => {
  for (let i = 0; i < n; i++) step(g)
}

function duel(rows = block(60, 30)) {
  const g = createGame(map(rows), 'moyen', mulberry32(1))
  const a = addPlayer(g, 'A', 'human')
  const b = addPlayer(g, 'B', 'nation')
  spawn(g, a.id, at(g, 10, 15))
  spawn(g, b.id, at(g, 50, 15))
  return { g, a, b }
}

describe('carte', () => {
  it('compte la terre franchissable et ne se referme pas sur les bords', () => {
    const g = createGame(map(['##x.', '#^..']), 'moyen')
    expect(g.land).toBe(4)
    const out = new Int32Array(4)
    expect(neighbors(g, at(g, 0, 0), out)).toBe(2)
  })
})

describe('apparition', () => {
  it('prend un disque de rayon 4 et se déplace si l’on rechoisit', () => {
    const g = createGame(map(block(30, 30)), 'moyen')
    const p = addPlayer(g, 'A', 'human')
    expect(spawn(g, p.id, at(g, 10, 10))).toBe(true)
    expect(p.tiles).toBe(49)
    spawn(g, p.id, at(g, 20, 20))
    expect(g.owner[at(g, 10, 10)]).toBe(0)
    expect(p.tiles).toBe(49)
    expect(p.troops).toBe(25_000)
  })
})

describe('troupes', () => {
  it('poussent vers le plafond sans le dépasser', () => {
    const { g, a } = duel()
    run(g, 50)
    expect(a.troops).toBeGreaterThan(25_000)
    run(g, 5000)
    expect(a.troops).toBeLessThanOrEqual(maxTroopsOf(g, a) + 1e-6)
  })
})

describe('attaques', () => {
  it('avancent petit à petit sur la terre libre, 16 troupes par case de plaine', () => {
    const { g, a } = duel(block(200, 100))
    const before = a.tiles
    startAttack(g, a.id, 0, 5000)
    step(g)
    const first = a.tiles - before
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(40)
    run(g, 30)
    expect(a.tiles).toBeGreaterThan(before + first * 5)
    const used = 5000 - g.attacks[0].troops
    expect(used / (a.tiles - before)).toBeCloseTo(16, 0)
  })

  it('vont moins vite en montagne', () => {
    const plain = duel(block(200, 100))
    const hills = duel(block(200, 100, '^'))
    // le point de départ est le même ; seule la nature du terrain change
    startAttack(plain.g, plain.a.id, 0, 5000)
    startAttack(hills.g, hills.a.id, 0, 5000)
    run(plain.g, 10)
    run(hills.g, 10)
    expect(hills.a.tiles).toBeLessThan(plain.a.tiles)
  })

  it('usent le défenseur et l’éliminent, en prenant son or', () => {
    const small = createGame(map(['.##########.']), 'moyen', mulberry32(2))
    const x = addPlayer(small, 'X', 'human')
    const y = addPlayer(small, 'Y', 'nation')
    spawn(small, x.id, at(small, 2, 0))
    spawn(small, y.id, at(small, 9, 0))
    y.gold = 1000
    y.troops = 50
    x.troops = 100_000
    startAttack(small, x.id, y.id, 50_000)
    run(small, 50)
    expect(y.alive).toBe(false)
    expect(y.killer).toBe(x.id)
    expect(x.gold).toBeGreaterThanOrEqual(1000)
    expect(small.events.find((e) => e.type === 'eliminated')?.gold).toBeGreaterThanOrEqual(1000)
  })

  it('s’annulent quand deux joueurs s’attaquent l’un l’autre', () => {
    const g = createGame(map(['.##########.']), 'moyen')
    const x = addPlayer(g, 'X', 'human')
    const y = addPlayer(g, 'Y', 'nation')
    spawn(g, x.id, at(g, 2, 0))
    spawn(g, y.id, at(g, 9, 0))
    startAttack(g, x.id, y.id, 3000)
    startAttack(g, y.id, x.id, 5000)
    expect(g.attacks).toHaveLength(1)
    expect(g.attacks[0]).toMatchObject({ from: y.id, to: x.id, troops: 2000 })
  })
})

describe('bateaux', () => {
  const islands = ['............................', '.#####..............#####...', '.#####..............#####...', '.#####..............#####...', '............................']

  it('avancent d’une case par tour, débarquent et attaquent depuis la plage', () => {
    const g = createGame(map(islands), 'moyen', mulberry32(3))
    const p = addPlayer(g, 'A', 'human')
    spawn(g, p.id, at(g, 3, 2))
    expect(attackAt(g, p.id, at(g, 22, 2), 5000)).toBe('mer')
    const boat = g.boats[0]
    run(g, boat.path.length - 1)
    expect(g.boats).toHaveLength(1)
    step(g)
    expect(g.boats).toHaveLength(0)
    expect(g.owner[boat.dst]).toBe(p.id)
    run(g, 20)
    expect(g.owner[at(g, 22, 2)]).toBe(p.id)
  })

  it('accostent sur une côte de la mer, pas sur la rive d’un lac intérieur', () => {
    const lake = ['............................', '.#####.............#######..', '.#####.............##.####..', '.#####.............#######..', '............................']
    const g = createGame(map(lake), 'moyen', mulberry32(9))
    const p = addPlayer(g, 'A', 'human')
    spawn(g, p.id, at(g, 3, 2))
    // la case visée touche le lac, mais seule la mer mène jusqu'au joueur
    expect(sendBoat(g, p.id, at(g, 20, 2), 100)).toBe(true)
    expect(g.boats[0].path.length).toBeGreaterThan(5)
  })

  it('font demi-tour quand on les rappelle et ramènent toutes leurs troupes', () => {
    const g = createGame(map(islands), 'moyen', mulberry32(3))
    const p = addPlayer(g, 'A', 'human')
    spawn(g, p.id, at(g, 3, 2))
    p.troops = 20_000
    expect(sendBoat(g, p.id, at(g, 22, 2), 5000)).toBe(true)
    run(g, 5)
    const left = p.troops
    recallBoat(g, g.boats[0].id)
    run(g, 10)
    expect(g.boats).toHaveLength(0)
    expect(p.troops).toBeGreaterThanOrEqual(left + 5000)
    expect([...g.owner].filter((o) => o === p.id).length).toBe(p.tiles)
    expect(g.owner[at(g, 22, 2)]).toBe(0)
  })

  it('ne sont que trois à la fois', () => {
    const g = createGame(map(islands), 'moyen')
    const p = addPlayer(g, 'A', 'human')
    spawn(g, p.id, at(g, 3, 2))
    for (let i = 0; i < MAX_BOATS; i++) expect(sendBoat(g, p.id, at(g, 22, 2), 100)).toBe(true)
    expect(sendBoat(g, p.id, at(g, 22, 2), 100)).toBe(false)
  })
})

describe('bâtiments', () => {
  it('coûtent de l’or, se tiennent à distance et une ville relève le plafond une fois bâtie', () => {
    const { g, a } = duel()
    a.gold = 125_000
    expect(build(g, a.id, 'ville', at(g, 50, 15))).toBe('place')
    expect(build(g, a.id, 'ville', at(g, 10, 15))).toBe('ok')
    expect(a.gold).toBe(0)
    const max = maxTroopsOf(g, a)
    run(g, BUILD_TICKS.ville)
    expect(maxTroopsOf(g, a)).toBeCloseTo(max + CITY_TROOPS)
    a.gold = 1e6
    expect(build(g, a.id, 'poste', at(g, 12, 15))).toBe('place')
  })

  it('une seconde ville au même endroit améliore la première', () => {
    const { g, a } = duel()
    a.gold = 1e6
    build(g, a.id, 'ville', at(g, 10, 15))
    build(g, a.id, 'ville', at(g, 11, 15))
    expect(g.units).toHaveLength(1)
    expect(g.units[0].level).toBe(2)
  })

  it('un poste de défense rend l’attaque bien plus coûteuse', () => {
    const fight = (post: boolean) => {
      const g = createGame(map(['.' + '#'.repeat(40) + '.']), 'moyen', mulberry32(5))
      const x = addPlayer(g, 'X', 'human')
      const y = addPlayer(g, 'Y', 'nation')
      spawn(g, x.id, at(g, 2, 0))
      spawn(g, y.id, at(g, 38, 0))
      startAttack(g, y.id, 0, 5000)
      run(g, 40)
      if (post) {
        y.gold = 1e6
        build(g, y.id, 'poste', at(g, 30, 0))
        run(g, BUILD_TICKS.poste)
      }
      x.troops = 20_000
      startAttack(g, x.id, y.id, 10_000)
      run(g, 5)
      return x.tiles
    }
    expect(fight(true)).toBeLessThan(fight(false))
  })
})

describe('usines et trains', () => {
  function estate(rows = block(160, 60)) {
    const g = createGame(map(rows), 'moyen', mulberry32(11))
    const a = addPlayer(g, 'A', 'human')
    spawn(g, a.id, at(g, 40, 30))
    a.troops = 1e7
    startAttack(g, a.id, 0, 5e6)
    run(g, 120)
    a.gold = 1e7
    return { g, a }
  }

  it('relient par le rail les gares proches, et leurs trains rapportent de l’or', () => {
    const { g, a } = estate()
    expect(build(g, a.id, 'usine', at(g, 30, 30))).toBe('ok')
    expect(build(g, a.id, 'ville', at(g, 80, 30))).toBe('ok')
    run(g, BUILD_TICKS.usine)
    expect(g.rails).toHaveLength(1)
    const before = a.gold
    run(g, 600)
    expect(a.gold - before).toBeGreaterThan(600 * 100 + 10_000)
  })

  it('ne posent pas de rail au-dessus de la mer', () => {
    const rows = block(160, 60).map((r) => r.slice(0, 55) + '.'.repeat(10) + r.slice(65))
    const { g, a } = estate(rows)
    build(g, a.id, 'usine', at(g, 30, 30))
    build(g, a.id, 'ville', at(g, 50, 30))
    if (g.owner[at(g, 80, 30)] === a.id) build(g, a.id, 'ville', at(g, 80, 30))
    run(g, BUILD_TICKS.usine)
    expect(g.rails.every((r) => [...r.path].every((t) => g.terrain[t] & LAND))).toBe(true)
    expect(g.rails.some((r) => [r.a, r.b].includes(g.units.find((u) => u.tile === at(g, 80, 30))?.id ?? -1))).toBe(false)
  })

  it('comptent les ports dans le prix d’une usine', () => {
    const { g, a } = estate()
    const first = priceOf(g, a.id, 'usine')
    g.units.push({ id: 999, type: 'port', owner: a.id, tile: at(g, 0, 0), level: 1, ready: 0, cooldown: 0, slots: [0], hp: 0, home: 0, goal: -1 })
    expect(priceOf(g, a.id, 'usine')).toBe(first * 2)
  })
})

describe('commerce', () => {
  const sea = ['.'.repeat(64), ...Array.from({ length: 14 }, () => '..' + '#'.repeat(11) + '.'.repeat(12) + '#'.repeat(11) + '.'.repeat(12) + '#'.repeat(11) + '...'), '.'.repeat(64)]

  // trois îles, chacune à un joueur, avec un port sur la côte
  function harbors() {
    const g = createGame(map(sea), 'moyen', mulberry32(5))
    const players = ['A', 'B', 'C'].map((name, i) => {
      const p = addPlayer(g, name, i ? 'nation' : 'human')
      spawn(g, p.id, at(g, 7 + i * 23, 8))
      p.troops = 1e6
      startAttack(g, p.id, 0, 5e5)
      return p
    })
    run(g, 60)
    for (const p of players) {
      p.gold = 1e7
      expect(build(g, p.id, 'port', at(g, 7 + (p.id - 1) * 23, 1))).toBe('ok')
    }
    run(g, BUILD_TICKS.port)
    return { g, a: players[0], b: players[1], c: players[2] }
  }

  it('fait naviguer des navires marchands entre ports, qui rapportent de l’or aux deux bouts', () => {
    const { g, a } = harbors()
    const before = a.gold
    let i = 0
    for (; i < 3000 && !g.events.some((e) => e.type === 'trade' && (e.from === a.id || e.to === a.id)); i++) step(g)
    const trade = g.events.find((e) => e.type === 'trade' && (e.from === a.id || e.to === a.id))!
    expect(trade.gold).toBeGreaterThan(0)
    expect(a.gold - before).toBeGreaterThanOrEqual(trade.gold!)
  })

  it('laisse partir les navires d’un port même quand les autres joueurs en ont déjà beaucoup en mer', () => {
    const { g, a, b } = harbors()
    const water = at(g, 0, 0)
    for (let i = 0; i < 120; i++) g.boats.push({ id: g.nextId++, owner: b.id, to: 0, troops: 0, path: new Int32Array(9999).fill(water), at: 0, dst: water, trade: true, gold: 0, port: 0, back: false })
    let sent = false
    for (let i = 0; i < 2000 && !sent; i++) {
      step(g)
      sent = g.boats.some((x) => x.trade && x.owner === a.id)
    }
    expect(sent).toBe(true)
  })

  it('se font capturer par un navire de guerre ennemi, qui les ramène à son port et en garde l’or', () => {
    const { g, c } = harbors()
    c.gold = 1e7
    expect(build(g, c.id, 'navire', at(g, 53, 1))).toBe('ok')
    let i = 0
    for (; i < 4000 && !g.events.some((e) => e.type === 'captured' && e.from === c.id); i++) step(g)
    const taken = g.events.find((e) => e.type === 'captured' && e.from === c.id)!
    expect(taken).toBeDefined()
    const boat = g.boats.find((x) => x.trade && x.owner === c.id && x.port === g.units.find((u) => u.type === 'port' && u.owner === c.id)!.id)
    expect(boat).toBeDefined()
  })

  it('ne se font pas prendre par les navires d’un allié', () => {
    const { g, a, c } = harbors()
    requestAlliance(g, a.id, c.id)
    accept(g, a.id, c.id)
    c.gold = 1e7
    build(g, c.id, 'navire', at(g, 53, 1))
    for (let i = 0; i < 1500; i++) step(g)
    expect(g.events.some((e) => e.type === 'captured' && e.to === a.id)).toBe(false)
  })
})

describe('alliances', () => {
  it('se demandent, s’acceptent, empêchent d’attaquer, et se rompent en traître', () => {
    const { g, a, b } = duel()
    expect(requestAlliance(g, a.id, b.id)).toBe('envoyée')
    accept(g, a.id, b.id)
    expect(allied(g, a.id, b.id)).toBe(true)
    expect(startAttack(g, a.id, b.id, 1000)).toBe(false)
    breakAlliance(g, a.id, b.id)
    expect(allied(g, a.id, b.id)).toBe(false)
    expect(isTraitor(g, a)).toBe(true)
    run(g, TRAITOR_TICKS)
    expect(isTraitor(g, a)).toBe(false)
  })

  it('durent cinq minutes, sauf si les deux prolongent', () => {
    const { g, a, b } = duel()
    requestAlliance(g, a.id, b.id)
    requestAlliance(g, b.id, a.id)
    expect(allied(g, a.id, b.id)).toBe(true)
    run(g, ALLIANCE_TICKS - 100)
    agreeExtension(g, a.id, b.id)
    agreeExtension(g, b.id, a.id)
    run(g, 200)
    expect(allied(g, a.id, b.id)).toBe(true)
  })
})

describe('bombes', () => {
  it('exigent un silo, rasent la zone et laissent des retombées', () => {
    const { g, a, b } = duel(block(120, 60))
    startAttack(g, b.id, 0, 20_000)
    run(g, 60)
    const tiles = b.tiles
    a.gold = 10e6
    expect(launch(g, a.id, 'bombe', at(g, 50, 15))).toBe('silo')
    build(g, a.id, 'silo', at(g, 10, 15))
    run(g, BUILD_TICKS.silo)
    expect(launch(g, a.id, 'bombe', at(g, 50, 15))).toBe('ok')
    run(g, 10)
    expect(b.tiles).toBeLessThan(tiles - 100)
    expect(g.falloutTiles).toBeGreaterThan(100)
    expect(player(g, b.id).relations.get(a.id)).toBeLessThan(0)
  })

  it('partent d’autant de silos qu’il a de niveaux avant de recharger', () => {
    const { g, a } = duel(block(120, 60))
    a.gold = 1e8
    build(g, a.id, 'silo', at(g, 10, 15))
    build(g, a.id, 'silo', at(g, 11, 15))
    run(g, BUILD_TICKS.silo)
    expect(launch(g, a.id, 'bombe', at(g, 50, 15))).toBe('ok')
    expect(launch(g, a.id, 'bombe', at(g, 50, 16))).toBe('ok')
    expect(launch(g, a.id, 'bombe', at(g, 50, 17))).toBe('silo')
  })

  it('tombent sur une défense antiaérienne ennemie à portée', () => {
    const { g, a, b } = duel(block(120, 60))
    a.gold = 10e6
    b.gold = 10e6
    build(g, a.id, 'silo', at(g, 10, 15))
    build(g, b.id, 'dca', at(g, 50, 15))
    run(g, BUILD_TICKS.dca)
    const tiles = b.tiles
    launch(g, a.id, 'bombe', at(g, 52, 15))
    step(g)
    // le missile antiaérien part aussitôt la bombe à portée, et l'abat en vol
    expect(g.missiles).toHaveLength(1)
    run(g, 10)
    expect(g.nukes).toHaveLength(0)
    expect(g.missiles).toHaveLength(0)
    expect(b.tiles).toBe(tiles)
  })
})

describe('fin de partie', () => {
  it('un territoire cerné par un seul ennemi lui revient', () => {
    const g = createGame(map(block(30, 30)), 'moyen', mulberry32(6))
    const big = addPlayer(g, 'Grand', 'nation')
    const small = addPlayer(g, 'Petit', 'bot')
    spawn(g, small.id, at(g, 15, 15))
    big.troops = 1e6
    spawn(g, big.id, at(g, 3, 3))
    startAttack(g, big.id, 0, 1e6)
    run(g, 200)
    expect(small.alive).toBe(false)
    expect(winner(g)).toBe(big.id)
  })
})
