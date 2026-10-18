import { describe, expect, it } from 'vitest'
import { DRAWINGS } from './drawings'
import { OBJECTS, POP_ITEMS } from './items'

describe('silhouettes dessinées', () => {
  const names = new Set([...OBJECTS, ...POP_ITEMS].map((i) => i.name))

  it('portent chacune le nom exact d’un objet du jeu', () => {
    expect(Object.keys(DRAWINGS).filter((k) => !names.has(k))).toEqual([])
  })

  it('remplacent tous les emojis de Pop Culture', () => {
    expect(POP_ITEMS.filter((i) => !DRAWINGS[i.name]).map((i) => i.name)).toEqual([])
  })
})
