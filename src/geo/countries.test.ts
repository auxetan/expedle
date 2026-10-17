import { describe, expect, it } from 'vitest'
import { exactMatch, matchSuggestions } from '../games/itineraire/puzzle'
import { normalize } from '../lib/util'
import { worldAtlas } from './atlas'
import { COUNTRIES, foreignNames } from './countries'

describe('noms de pays dans toutes les langues', () => {
  it('connaît chaque pays dans de nombreuses langues et écritures', () => {
    const de = foreignNames('DE')
    for (const n of ['Germany', 'Deutschland', 'Alemania', 'Germania', 'Niemcy', 'Германия', 'ドイツ', '德国', 'ألمانيا']) expect(de, n).toContain(n)
    expect(foreignNames('JP').length).toBeGreaterThan(20)
  })

  it('ajoute les noms anglais d’usage et sépare les noms entre parenthèses', () => {
    expect(foreignNames('TR')).toContain('Turkey')
    expect(foreignNames('CZ')).toContain('Czech Republic')
    expect(foreignNames('MM')).toEqual(expect.arrayContaining(['Myanmar', 'Burma']))
  })

  it('n’accepte aucun nom qui désignerait deux pays', () => {
    const owner = new Map<string, string>()
    for (const c of COUNTRIES) {
      for (const n of [c.name, ...c.aliases, ...foreignNames(c.code)]) {
        const key = normalize(n)
        const prev = owner.get(key)
        if (prev && prev !== c.code && foreignNames(c.code).includes(n)) throw new Error(`${n} : ${prev} et ${c.code}`)
        owner.set(key, c.code)
      }
    }
  })

  it('reconnaît une saisie étrangère dans les jeux de pays', () => {
    const atlas = worldAtlas()
    expect(exactMatch(atlas, 'Germany')?.code).toBe('DE')
    expect(exactMatch(atlas, 'ドイツ')?.code).toBe('DE')
    expect(exactMatch(atlas, 'Ivory Coast')?.code).toBe('CI')
    expect(matchSuggestions(atlas, 'deutsch')[0].s.code).toBe('DE')
    expect(matchSuggestions(atlas, 'españa').map((m) => m.s.code)).toContain('ES')
  })
})
