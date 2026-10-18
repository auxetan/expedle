import { describe, expect, it } from 'vitest'
import { getWorld } from '../../geo/world'
import { dailyTarget, hasFlag, revealOrder, score, targets, TILES, visibleTiles } from './game'

const world = getWorld()

describe('Flagle', () => {
  it('a un drapeau pour chaque pays à deviner', () => {
    expect(targets(world).length).toBeGreaterThan(180)
    for (const code of targets(world)) expect(hasFlag(code), code).toBe(true)
    expect(hasFlag('XK')).toBe(true)
    expect(targets(world)).toContain(dailyTarget(world, '2026-10-17'))
  })

  it('dévoile les tuiles dans le même ordre pour tout le monde, une de plus par erreur', () => {
    const order = revealOrder('2026-10-17')
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5])
    expect(revealOrder('2026-10-17')).toEqual(order)
    expect(visibleTiles(0, false)).toBe(1)
    expect(visibleTiles(3, false)).toBe(4)
    expect(visibleTiles(9, false)).toBe(TILES)
    expect(visibleTiles(0, true)).toBe(TILES)
  })

  it('note de 100 au premier essai à 0 en cas d’échec', () => {
    expect(score(true, 1)).toBe(100)
    expect(score(false, 6)).toBe(0)
  })
})
