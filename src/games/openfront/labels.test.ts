import { describe, expect, it } from 'vitest'
import { addPlayer, createGame, LAND, spawn } from './engine'
import { anchors } from './labels'

describe('étiquettes', () => {
  it('se posent sur le plus gros morceau du territoire, pas entre deux', () => {
    const w = 80
    const g = createGame({ w, h: 20, terrain: new Uint8Array(w * 20).fill(LAND) }, 'moyen')
    const p = addPlayer(g, 'A', 'human')
    // un petit avant-poste loin à l'est
    spawn(g, p.id, 10 * w + 70)
    p.spawn = []
    spawn(g, p.id, 10 * w + 10)
    for (let x = 4; x < 17; x++) for (let y = 4; y < 17; y++) g.owner[y * w + x] = p.id
    const [a] = anchors(g)
    expect(a.id).toBe(p.id)
    expect(Math.abs(a.x - 10)).toBeLessThan(3)
    expect(Math.abs(a.y - 10)).toBeLessThan(3)
    expect(a.cells).toBeGreaterThan(100)
  })
})
