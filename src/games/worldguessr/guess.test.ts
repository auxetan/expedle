import { describe, expect, it } from 'vitest'
import { COUNTRY_BY_CODE } from '../../geo/countries'
import { getWorld } from '../../geo/world'
import { mulberry32 } from '../../lib/util'
import { MODES, pickCountry, score } from './guess'

const world = getWorld()

describe('barème', () => {
  it('donne 5 000 points au mètre près et décroît avec la distance', () => {
    expect(score(0, 14916)).toBe(5000)
    expect(score(1491.6, 14916)).toBe(1839)
    expect(score(20000, 14916)).toBe(0)
  })
})

describe('tirage des pays', () => {
  it('reste dans le continent du mode', () => {
    const rng = mulberry32(3)
    const europe = MODES.find((m) => m.id === 'europe')!
    for (let i = 0; i < 30; i++) expect(COUNTRY_BY_CODE.get(pickCountry(world, europe, rng)!)?.continent).toBe('EU')
  })

  it('se limite aux pays autorisés et renvoie null si aucun ne convient', () => {
    const rng = mulberry32(5)
    const monde = MODES[0]
    const allowed = new Set(['FR', 'JP'])
    for (let i = 0; i < 20; i++) expect(allowed.has(pickCountry(world, monde, rng, allowed)!)).toBe(true)
    const oceanie = MODES.find((m) => m.id === 'oceanie')!
    expect(pickCountry(world, oceanie, rng, new Set(['FR']))).toBeNull()
  })
})
