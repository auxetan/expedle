import { describe, expect, it } from 'vitest'
import { worldAtlas } from '../../geo/atlas'
import { matchSuggestions } from './puzzle'

const labels = (q: string) => matchSuggestions(worldAtlas(), q).map((m) => m.s.label)

describe('country suggestions', () => {
  it('lists every country starting with the letter before those containing it', () => {
    const names = labels('b')
    const starts = names.filter((n) => n.startsWith('B'))
    expect(starts.length).toBeGreaterThan(15)
    expect(names.slice(0, starts.length)).toEqual(starts)
    expect(names).toContain('Liberia')
    expect(names.indexOf('Liberia')).toBeGreaterThan(starts.length - 1)
  })

  it('ignores accents', () => {
    expect(labels('bé').slice(0, 3)).toEqual(['Belgique', 'Belize', 'Bénin'])
  })
})
