import { describe, expect, it } from 'vitest'
import { COUNTRY_BY_CODE, countryName, FRANCOPHONES, FRENCH_SPOKEN } from '../../geo/countries'
import { mulberry32 } from '../../lib/util'
import { francophonieQuestions, questionBank } from './bank'

describe('question bank', () => {
  const bank = questionBank()

  it('holds thousands of well-formed questions', () => {
    expect(bank.length).toBeGreaterThan(3000)
    for (const q of bank) {
      expect(q.w).toHaveLength(3)
      expect(new Set([q.a, ...q.w]).size).toBe(4)
    }
  })

  it('covers every category', () => {
    const cats = new Set(bank.map((q) => q.cat))
    for (const c of ['Géographie', 'Histoire', 'Sciences', 'Arts & Lettres', 'Cinéma & Musique', 'Sport', 'France', 'Nature', 'Divers'])
      expect(cats.has(c)).toBe(true)
  })

  it('keeps the same choices for a question across loads', () => {
    const q = bank.find((x) => x.q.includes('Gironde'))!
    expect(q.w).toEqual(questionBank().find((x) => x.id === q.id)!.w)
  })
})

describe('francophonie', () => {
  it('lists sovereign countries with a capital', () => {
    for (const code of FRANCOPHONES) {
      const c = COUNTRY_BY_CODE.get(code)!
      expect(c.territory).toBe(false)
      expect(c.capital).not.toBe('—')
      expect(FRENCH_SPOKEN.has(code)).toBe(false)
    }
  })

  it('asks about ten different French-speaking countries, the same ones for the same seed', () => {
    const qs = francophonieQuestions(mulberry32(7), 10)
    expect(qs).toHaveLength(10)
    expect(new Set(qs.map((q) => q.code)).size).toBe(10)
    for (const q of qs) {
      expect(FRANCOPHONES.has(q.code)).toBe(true)
      expect(new Set([q.a, ...q.w]).size).toBe(4)
    }
    expect(francophonieQuestions(mulberry32(7), 10)).toEqual(qs)
  })

  it('never offers a French-speaking country as a wrong answer', () => {
    const names = new Map([...COUNTRY_BY_CODE.keys()].map((code) => [countryName(code), code]))
    for (let seed = 0; seed < 30; seed++)
      for (const q of francophonieQuestions(mulberry32(seed), 10).filter((x) => !x.big))
        for (const w of q.w) {
          const code = names.get(w)!
          expect(FRANCOPHONES.has(code) || FRENCH_SPOKEN.has(code)).toBe(false)
        }
  })
})
