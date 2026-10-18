import { describe, expect, it } from 'vitest'
import { getWorld } from '../../geo/world'
import { dailyTarget, heat } from './game'

const lightness = (hex: string) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0)

describe('Globle', () => {
  it('change de pays mystère selon le jour, mais pas dans la journée', () => {
    const world = getWorld()
    expect(dailyTarget(world, '2026-10-16')).toBe(dailyTarget(world, '2026-10-16'))
    const days = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'].map((d) => dailyTarget(world, d))
    expect(new Set(days).size).toBeGreaterThan(1)
  })

  it('chauffe à mesure qu’on se rapproche', () => {
    expect(heat(0)).toBe('#9e2a1c')
    expect(heat(30000)).toBe('#f6ecd6')
    const ramp = [0, 300, 1500, 4000, 8000, 15000].map((km) => lightness(heat(km)))
    expect([...ramp].sort((a, b) => a - b)).toEqual(ramp)
  })
})
