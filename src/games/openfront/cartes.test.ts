import { describe, expect, it } from 'vitest'
import { MAPS, pickPublicMap, seatsOf } from './cartes'

describe('cartes d’OpenFront', () => {
  it('ont toutes un nom, une vignette et des dimensions, plus le monde sans relief d’Expedle', () => {
    expect(MAPS.length).toBeGreaterThan(20)
    for (const m of MAPS) {
      expect(m.name, m.id).toBeTruthy()
      expect(m.w * m.h, m.id).toBeGreaterThan(0)
      if (m.id !== 'expedle') expect(m.thumb, m.id).toBeTruthy()
    }
    expect(MAPS[0].id).toBe('world')
  })

  it('placent chaque nation sur sa case, drapeau ISO en majuscules, sans drapeau quand il est inventé', () => {
    const seats = seatsOf({ w: 100, nations: [[10, 2, 'fr', 'France'], [5, 7, 'Kingdom of Sardinia', 'Kingdom of Sardinia']] })
    expect(seats).toEqual([
      { code: 'FR', name: 'France', cell: 210, size: 2 },
      { code: '', name: 'Kingdom of Sardinia', cell: 705, size: 1 },
    ])
  })

  it('tirent la carte des parties publiques selon le poids que leur donne OpenFront', () => {
    const weighted = MAPS.filter((m) => m.weight > 0)
    expect(pickPublicMap(() => 0)).toBe(weighted[0].id)
    expect(pickPublicMap(() => 0.999999)).toBe(weighted.at(-1)!.id)
    // le monde, de loin le plus fréquent sur OpenFront, sort plus souvent que toute autre
    const total = weighted.reduce((s, m) => s + m.weight, 0)
    expect(MAPS.find((m) => m.id === 'world')!.weight / total).toBeGreaterThan(0.1)
  })
})
