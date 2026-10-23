import { describe, expect, it } from 'vitest'
import { CHAT } from './chat'
import { PHRASES } from './rules'

describe('tchat rapide', () => {
  it('affiche exactement les phrases que la partie accepte, avec un joueur là où elle en attend un', () => {
    const shown = CHAT.flatMap((c) => c.phrases)
    expect(shown.map((p) => p.id).sort()).toEqual(Object.keys(PHRASES).sort())
    for (const p of shown) expect(p.text.includes('{name}'), p.id).toBe(PHRASES[p.id])
  })
})
