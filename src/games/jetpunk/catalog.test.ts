import { describe, expect, it } from 'vitest'
import { builtInQuizzes } from './catalog'
import { answerKey, validateQuiz } from './model'

describe('catalogue JetPunk', () => {
  const list = builtInQuizzes()

  it('propose des dizaines de quiz aux identifiants uniques', () => {
    expect(list.length).toBeGreaterThan(70)
    expect(new Set(list.map((q) => q.id)).size).toBe(list.length)
  })

  it('ne contient que des quiz valides d’au moins trois réponses', () => {
    for (const q of list) {
      expect(validateQuiz(q), q.id).toEqual(q)
      expect(q.rows.length, q.id).toBeGreaterThanOrEqual(3)
      expect(q.rows.every((r) => answerKey(r.answer)), q.id).toBe(true)
    }
  })

  it('distingue chaque pays du monde', () => {
    const world = list.find((q) => q.id === 'pays-du-monde')!
    expect(world.rows.length).toBeGreaterThan(190)
    expect(new Set(world.rows.map((r) => answerKey(r.answer))).size).toBe(world.rows.length)
  })

  it('n’invente pas de frontière par le tunnel sous la Manche', () => {
    const fr = list.find((q) => q.id === 'voisins-fr')!
    expect(fr.rows.map((r) => r.answer)).not.toContain('Royaume-Uni')
    expect(fr.rows.length).toBe(8)
  })
})
