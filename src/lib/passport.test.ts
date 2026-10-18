import { beforeEach, describe, expect, it, vi } from 'vitest'
import { coverage, NATIONS, passport, stamp } from './passport'

describe('passeport', () => {
  // le localStorage de Node demande un fichier : une mémoire suffit ici
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) })
  })

  it('tamponne un pays une fois, puis compte les retours et les jeux', () => {
    expect(stamp('JP', 'worldle', 1)).toEqual(['JP'])
    expect(stamp(['JP', 'FR', null, 'pas un code'], 'globle', 2)).toEqual(['FR'])
    expect(passport().JP).toEqual({ n: 2, first: 1, last: 2, games: ['worldle', 'globle'] })
  })

  it('mesure la part du monde et de chaque continent', () => {
    stamp(['FR', 'DE', 'JP'], 'quiz')
    const c = coverage(passport())
    expect(c.stamped).toBe(3)
    expect(c.total).toBe(NATIONS.length)
    expect(c.byContinent.find((x) => x.continent === 'EU')!.stamped).toBe(2)
  })
})
