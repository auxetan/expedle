import { describe, expect, it } from 'vitest'
import { cleanCode, pinGroups, pinTitle, playedSince, validPseudo } from './classe'

describe('mode classe', () => {
  it('cleans a typed class code', () => {
    expect(cleanCode(' ab-c 23 4x ')).toBe('ABC234')
    expect(cleanCode('abc')).toBe('ABC')
  })

  it('accepts a short pseudo but never an email', () => {
    expect(validPseudo('Léa M.')).toBe(true)
    expect(validPseudo(' L ')).toBe(false)
    expect(validPseudo('lea@exemple.fr')).toBe(false)
    expect(validPseudo('x'.repeat(21))).toBe(false)
  })

  it('offers pins the database accepts, each once', () => {
    const hrefs = pinGroups().flatMap((g) => g.pins.map((p) => p.href))
    // la même règle que la contrainte de la table classes
    for (const href of hrefs) expect(href).toMatch(/^#\/[a-z0-9/-]{1,60}$/)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(hrefs.slice(0, 5)).toEqual([
      '#/cartographe/france-regions',
      '#/cartographe/france-departements',
      '#/cartographe/france-numeros',
      '#/cartographe/france-prefectures',
      '#/quiz/francophonie',
    ])
  })

  it('names pinned games and quizzes', () => {
    expect(pinTitle('#/cartographe/france-departements')).toBe('France : les départements')
    expect(pinTitle('#/cartographe/europe-capitales')).toBe('Europe : les capitales')
    expect(pinTitle('#/worldle')).toBe('Worldle')
    expect(pinTitle('#/inconnu')).toBe('#/inconnu')
  })

  it('ticks the games played since Monday', () => {
    const monday = new Date(2026, 9, 26)
    const done = playedSince(
      [
        { g: 'cartographe', t: new Date(2026, 9, 27).getTime(), pts: 90, sub: 'france-regions' },
        { g: 'quiz-francophonie', t: new Date(2026, 9, 28).getTime(), pts: 70 },
        { g: 'worldle', t: new Date(2026, 9, 20).getTime(), pts: 100 },
      ],
      monday,
    )
    expect(done).toEqual(new Set(['#/cartographe/france-regions', '#/cartographe', '#/quiz/francophonie']))
  })
})
