import { describe, expect, it } from 'vitest'
import { setupFor, setupFromSeed, setupSeed } from '../games/classement/setup'
import { compare, decodeResult, encodeResult, readChallenge } from './challenge'

describe('défis', () => {
  it('le résultat voyage dans le lien sans rien perdre', () => {
    const r = { pts: 83, s: 2, ms: 6142, win: true }
    expect(decodeResult(encodeResult(r))).toEqual(r)
    expect(decodeResult(encodeResult({ pts: 40 }))).toEqual({ pts: 40 })
    expect(decodeResult('n’importe quoi')).toBeNull()
  })

  it('lit la graine et le rival dans les paramètres du lien', () => {
    const c = readChallenge(new URLSearchParams({ defi: 'mc4laiu7', par: 'Alice', av: '🦊', r: '83~2~6142~1' }))
    expect(c).toEqual({ seed: 'mc4laiu7', by: { name: 'Alice', avatar: '🦊', r: { pts: 83, s: 2, ms: 6142, win: true } } })
    expect(readChallenge(new URLSearchParams({ defi: 'mc4laiu7' }))).toEqual({ seed: 'mc4laiu7', by: null })
    // une graine hors de l'alphabet autorisé par la base est refusée
    expect(readChallenge(new URLSearchParams({ defi: 'São Paulo' }))).toBeNull()
  })

  it('classe le meilleur score d’abord, puis le plus rapide', () => {
    expect(compare({ pts: 90, ms: 9000 }, { pts: 80, ms: 1000 })).toBeLessThan(0)
    expect(compare({ pts: 80, ms: 1000 }, { pts: 80, ms: 2000 })).toBeLessThan(0)
    expect(compare({ pts: 80 }, { pts: 80, ms: 2000 })).toBeGreaterThan(0)
  })

  it('un tirage GeoHunter se rejoue à l’identique depuis sa graine', () => {
    for (const mode of ['classique', 'villes'] as const) {
      const setup = setupFor(mode)
      const again = setupFromSeed(mode, setupSeed(mode, setup))!
      expect(again.entities.map((e) => e.id)).toEqual(setup.entities.map((e) => e.id))
      expect(again.categories.map((c) => c.id)).toEqual(setup.categories.map((c) => c.id))
    }
    expect(setupFromSeed('classique', '1.2~3')).toBeNull()
  })
})
