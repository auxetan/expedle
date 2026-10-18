import { describe, expect, it } from 'vitest'
import { mark, questions, score } from './game'

describe('Factle', () => {
  it('ne garde que des classements aux cinq premiers distincts', () => {
    expect(questions().length).toBeGreaterThanOrEqual(10)
    for (const q of questions()) {
      expect(new Set(q.top).size).toBe(5)
      q.top.forEach((code, i) => expect(q.category.ranks.get(code)).toBe(i + 1))
    }
  })

  it('distingue la bonne place, le top 5, le top 10 et le reste', () => {
    const q = questions().find((x) => x.category.id === 'pop')!
    expect(mark(q, 0, q.top[0])).toBe('exact')
    expect(mark(q, 0, q.top[1])).toBe('top')
    const tenth = [...q.category.ranks].find(([, r]) => r === 8)![0]
    expect(mark(q, 0, tenth)).toBe('near')
    expect(mark(q, 0, 'VA')).toBe('far')
  })

  it('note la partie', () => {
    expect(score(true, 1, 5)).toBe(100)
    expect(score(true, 5, 5)).toBe(20)
    expect(score(false, 5, 3)).toBe(30)
  })
})
