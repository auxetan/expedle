import { describe, expect, it } from 'vitest'
import { averageTotal, optimalAssignment, rankBy } from './ranking'

describe('ranking', () => {
  it('uses competition ranking and skips missing values', () => {
    const r = rankBy(
      [
        { id: 'a', value: 10 },
        { id: 'b', value: 30 },
        { id: 'c', value: 30 },
        { id: 'd', value: 0 },
      ],
      'desc',
    )
    expect(r.get('b')).toBe(1)
    expect(r.get('c')).toBe(1)
    expect(r.get('a')).toBe(3)
    expect(r.has('d')).toBe(false)
  })

  it('ranks ascending categories from the smallest', () => {
    const r = rankBy(
      [
        { id: 'a', value: 5 },
        { id: 'b', value: 1 },
      ],
      'asc',
    )
    expect(r.get('b')).toBe(1)
  })

  it('finds the lowest total assignment', () => {
    // lignes = entités, colonnes = catégories
    const m = [
      [1, 50, 9],
      [2, 3, 40],
      [5, 30, 20],
    ]
    const best = optimalAssignment(m)
    expect(best.total).toBe(9 + 3 + 5)
    expect(best.perm).toEqual([2, 1, 0])
    expect(averageTotal(m)).toBeCloseTo((1 + 50 + 9 + 2 + 3 + 40 + 5 + 30 + 20) / 3)
  })
})
