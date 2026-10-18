import { describe, expect, it } from 'vitest'
import { worldAtlas } from '../../geo/atlas'
import { COUNTRY_BY_CODE } from '../../geo/countries'
import { capitalChoices, clues, score, target, targets } from './game'

describe('DailyGeo', () => {
  const world = worldAtlas()

  it('tire le même pays pour une même graine, toujours avec ses six indices', () => {
    expect(target(world, '2026-10-18')).toBe(target(world, '2026-10-18'))
    for (const code of targets(world)) expect(clues(code)).toHaveLength(6)
  })

  it('donne la langue et la monnaie quand on les connaît, d’autres chiffres sinon', () => {
    const japan = clues('JP').map((c) => c.label)
    expect(japan).toContain('Monnaie')
    expect(clues('JP').find((c) => c.label === 'Monnaie')?.value).toBe('le yen')
  })

  it('propose quatre capitales distinctes dont la bonne', () => {
    const options = capitalChoices('FR', 'x')
    expect(new Set(options).size).toBe(4)
    expect(options).toContain(COUNTRY_BY_CODE.get('FR')!.capital)
  })

  it('compte jusqu’à 80 points pour le pays et 20 pour la capitale', () => {
    expect(score(true, 1, true)).toBe(100)
    expect(score(true, 6, false)).toBe(13)
    expect(score(false, 6, true)).toBe(20)
  })
})
