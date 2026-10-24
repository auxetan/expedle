import { describe, expect, it } from 'vitest'
import { MAPS, nationName, pickPublicMap, seatsOf } from './cartes'

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

  it('ramènent les nations à mi-coordonnées sur la carte compacte, deux fois plus petite de chaque côté', () => {
    expect(seatsOf({ w: 50, nations: [[10, 3, 'fr', 'France']] }, 2)).toEqual([{ code: 'fr', name: 'France', cell: 55, size: 1 }])
  })

  it('placent chaque nation sur sa case, avec le drapeau que lui donne la carte', () => {
    const seats = seatsOf({ w: 100, nations: [[10, 2, 'fr', 'France'], [5, 7, 'Kingdom of Sardinia', 'Kingdom of Sardinia']] })
    expect(seats).toEqual([
      { code: 'fr', name: 'France', cell: 210, size: 2 },
      { code: 'Kingdom of Sardinia', name: 'Kingdom of Sardinia', cell: 705, size: 1 },
    ])
  })

  it('nomment une nation dans la langue du joueur seulement quand elle est le pays de son drapeau', () => {
    expect(nationName({ code: 'US', name: 'United States', cell: 0, size: 1 })).toBe('États-Unis')
    // la carte maison ne donne que le code du pays
    expect(nationName({ code: 'FR', name: '', cell: 0, size: 1 })).toBe('France')
    // une région sous le drapeau de son pays, ou un drapeau d'emprunt, garde le nom de la carte
    expect(nationName({ code: 'JP', name: 'Hokkaido', cell: 0, size: 1 })).toBe('Hokkaido')
    expect(nationName({ code: 'DZ', name: 'Libya', cell: 0, size: 1 })).toBe('Libya')
    expect(nationName({ code: 'Kingdom of Sardinia', name: 'Kingdom of Sardinia', cell: 0, size: 1 })).toBe('Kingdom of Sardinia')
    expect(nationName({ code: 'us', name: 'United States', cell: 0, size: 1 })).toBe('États-Unis')
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
