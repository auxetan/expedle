import { describe, expect, it } from 'vitest'
import { loadUsaAtlas, worldAtlas } from './atlas'
import { remaining } from './graph'

describe('atlases', () => {
  it('connects US states by land, corners included', async () => {
    const usa = await loadUsaAtlas()
    const n = (c: string) => usa.neighbors.get(c) ?? new Set<string>()
    expect(n('49').has('35')).toBe(true)
    expect(n('26').has('55')).toBe(true)
    expect(usa.neighbors.has('15')).toBe(false)
    expect(remaining(usa.graph, '53', '06', new Set())).toBe(1)
    expect(usa.name('37')).toBe('Caroline du Nord')
  })

  it('names world countries in French with their continent', () => {
    const w = worldAtlas()
    expect(w.name('DE')).toBe('Allemagne')
    expect(w.region('BR')).toBe('Amérique du Sud')
    expect(w.playable).not.toContain('GF')
  })
})
