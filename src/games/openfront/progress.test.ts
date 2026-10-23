import { describe, expect, it } from 'vitest'
import type { Play } from '../../lib/stats'
import { rankOf, SKINS, tallyOf, xpOf } from './progress'

const play = (p: Partial<Play>): Play => ({ g: 'openfront', t: 0, pts: 0, ...p })

describe('niveau', () => {
  it('demande 100 points pour le niveau 2, puis 200 de plus pour le 3', () => {
    expect(rankOf(0)).toMatchObject({ level: 1, into: 0, need: 100 })
    expect(rankOf(99).level).toBe(1)
    expect(rankOf(100)).toMatchObject({ level: 2, into: 0, need: 200 })
    expect(rankOf(350)).toMatchObject({ level: 3, into: 50, need: 300 })
  })

  it('ne compte que les parties de Frontières', () => {
    expect(xpOf([play({ pts: 80 }), play({ g: 'travle', pts: 100 }), play({ pts: 20 })])).toBe(100)
  })
})

describe('statistiques', () => {
  it('résument parties, victoires, meilleure part, moyenne, temps et parties en ligne', () => {
    const list = [play({ s: 12, ms: 1000 }), play({ s: 80, win: true, ms: 3000, sub: 'multi' }), play({ g: 'travle', s: 99 })]
    expect(tallyOf(list)).toEqual({ games: 2, wins: 1, best: 80, average: 46, ms: 4000, multi: 1 })
  })
})

describe('boutique', () => {
  it('propose des motifs de plus en plus rares, le premier offert', () => {
    expect(SKINS[0]).toMatchObject({ id: 'uni', level: 1 })
    expect(SKINS.map((s) => s.level)).toEqual([...SKINS.map((s) => s.level)].sort((a, b) => a - b))
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length)
  })
})
