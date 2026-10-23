import { describe, expect, it } from 'vitest'
import { openArcs } from './render'

const length = (arcs: [number, number][]) => arcs.reduce((s, [a, b]) => s + b - a, 0)

describe('zones antiaériennes fondues', () => {
  it('gardent tout le cercle seul, et effacent celui qu’un autre couvre entièrement', () => {
    expect(openArcs({ x: 0, y: 0, r: 10 }, [{ x: 50, y: 0, r: 10 }])).toEqual([[0, Math.PI * 2]])
    expect(openArcs({ x: 0, y: 0, r: 5 }, [{ x: 1, y: 0, r: 10 }])).toBeNull()
  })

  it('retirent la part d’un cercle qui tombe dans son voisin', () => {
    const arcs = openArcs({ x: 0, y: 0, r: 10 }, [{ x: 10, y: 0, r: 10 }])!
    // deux cercles égaux à un rayon l'un de l'autre : un tiers de chacun est caché
    expect(length(arcs)).toBeCloseTo((Math.PI * 4) / 3, 5)
    // la partie cachée regarde vers le voisin (angle 0) : il reste l'arc de π/3 à 5π/3
    expect(arcs).toHaveLength(1)
    expect(arcs[0][0]).toBeCloseTo(Math.PI / 3, 5)
    expect(arcs[0][1]).toBeCloseTo((5 * Math.PI) / 3, 5)
  })
})
