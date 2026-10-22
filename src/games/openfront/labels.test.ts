import { describe, expect, it } from 'vitest'
import { addPlayer, createGame, spawn } from './engine'
import { anchors } from './labels'

describe('étiquettes', () => {
  it('se posent sur le plus gros morceau du territoire, pas entre deux', () => {
    const w = 80
    const g = createGame({ w, h: 20, land: new Uint8Array(w * 20).fill(1) })
    const p = addPlayer(g, 'A')
    spawn(g, p.id, 10 * w + 10)
    // un petit avant-poste loin à l'est
    p.spawned = false
    spawn(g, p.id, 10 * w + 70)
    for (let x = 4; x < 17; x++) for (let y = 4; y < 17; y++) g.owner[y * w + x] = p.id
    const [a] = anchors(g)
    expect(a.id).toBe(p.id)
    expect(Math.abs(a.x - 10)).toBeLessThan(3)
    expect(Math.abs(a.y - 10)).toBeLessThan(3)
    expect(a.cells).toBeGreaterThan(100)
  })
})
