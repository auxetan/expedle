import { describe, expect, it } from 'vitest'
import { seededRng } from '../../lib/util'
import { deck, DECK, fits, score, sorted } from './game'

describe('Wikitrivia', () => {
  it('tire seize événements datés, les mêmes pour une même graine', () => {
    const a = deck(seededRng('x'))
    expect(a).toHaveLength(DECK)
    expect(a).toEqual(deck(seededRng('x')))
    for (const c of a) expect(Number.isFinite(c.year)).toBe(true)
  })

  it('accepte une carte entre deux années qui l’encadrent, même à égalité', () => {
    const line = sorted([
      { name: 'b', year: 1900 },
      { name: 'a', year: 1500 },
    ])
    expect(fits(line, 0, { name: 'c', year: 1200 })).toBe(true)
    expect(fits(line, 1, { name: 'c', year: 1200 })).toBe(false)
    expect(fits(line, 1, { name: 'c', year: 1900 })).toBe(true)
    expect(fits(line, 2, { name: 'c', year: 1900 })).toBe(true)
  })

  it('note le nombre de cartes bien placées', () => {
    expect(score(15)).toBe(100)
    expect(score(0)).toBe(0)
  })
})
