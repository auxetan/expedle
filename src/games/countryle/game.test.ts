import { describe, expect, it } from 'vitest'
import { getWorld } from '../../geo/world'
import { compare, dailyTarget, evaluate, formatArea, formatGdp, formatPop, MAX_GUESSES, score, shareLine, targets } from './game'

const world = getWorld()

describe('Countryle', () => {
  it('ne tire que des pays dont on connaît les chiffres, le même pour tous chaque jour', () => {
    expect(targets(world).length).toBeGreaterThan(150)
    expect(dailyTarget(world, '2026-10-17')).toBe(dailyTarget(world, '2026-10-17'))
    expect(targets(world)).toContain(dailyTarget(world, '2026-10-18'))
  })

  it('compare un chiffre : à 10 % c’est vert, dans un facteur 2 c’est jaune', () => {
    expect(compare(105, 100)).toEqual({ value: 105, trend: 'down', heat: 'hit' })
    expect(compare(60, 100)).toEqual({ value: 60, trend: 'up', heat: 'near' })
    expect(compare(10, 100).heat).toBe('far')
    expect(compare(undefined, 100)).toEqual({ value: null, trend: null, heat: 'far' })
  })

  it('donne les bons indices entre deux pays', () => {
    const row = evaluate(world, 'FR', 'ES')
    expect(row.continent).toEqual({ label: 'Europe', hit: true })
    expect(row.hemisphere.hit).toBe(true)
    expect(row.pop.trend).toBe('up')
    expect(row.arrow).toBe('↗️')
    const far = evaluate(world, 'FR', 'AU')
    expect(far.continent.hit).toBe(false)
    expect(far.hemisphere).toEqual({ label: 'Sud', hit: false })
    expect(far.km).toBeGreaterThan(14000)
    const win = evaluate(world, 'FR', 'FR')
    expect(win).toMatchObject({ km: 0, arrow: '🎯' })
    expect(shareLine(win)).toBe('🟩🟩🟩🟩🟩🎯')
  })

  it('note de 100 en un essai à 0 en cas d’échec', () => {
    expect(score(true, 1)).toBe(100)
    expect(score(true, 8)).toBe(13)
    expect(score(false, 8)).toBe(0)
  })

  it('rend autant pour une victoire sur l’essai bonus d’un joker que sur le dernier essai', () => {
    expect(score(true, MAX_GUESSES + 1)).toBe(score(true, MAX_GUESSES))
    expect(score(true, MAX_GUESSES + 2)).toBeGreaterThan(0)
  })

  it('écrit les chiffres à la française', () => {
    expect(formatPop(68.4)).toBe('68,4 M')
    expect(formatPop(0.39)).toBe('390 k')
    expect(formatPop(1430)).toBe('1,43 Md')
    expect(formatArea(551.7).replace(/\s/g, ' ')).toBe('551 700 km²')
    expect(formatGdp(3030).replace(/\s/g, ' ')).toBe('3 030 Md$')
  })
})
