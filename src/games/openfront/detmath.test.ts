import { describe, expect, it } from 'vitest'
import { atan2, exp, log, pow } from './detmath'

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b))

describe('calcul déterministe', () => {
  it('suit Math.pow, exp et log à 1e-7 près sur les plages du jeu', () => {
    for (let x = 1; x < 5e6; x = x * 1.37 + 1) {
      expect(close(pow(x, 0.6), x ** 0.6)).toBe(true)
      expect(close(pow(x, 0.73), x ** 0.73)).toBe(true)
      expect(close(log(x), Math.log(x))).toBe(true)
    }
    for (let x = -30; x < 30; x += 0.37) expect(close(exp(x), Math.exp(x))).toBe(true)
  })

  it('suit Math.atan2 dans toutes les directions', () => {
    for (let a = -Math.PI + 0.01; a < Math.PI; a += 0.05) expect(Math.abs(atan2(Math.sin(a), Math.cos(a)) - a)).toBeLessThan(1e-7)
  })
})
