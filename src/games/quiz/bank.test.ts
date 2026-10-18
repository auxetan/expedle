import { describe, expect, it } from 'vitest'
import { questionBank } from './bank'

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
