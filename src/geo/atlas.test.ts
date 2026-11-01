import { describe, expect, it } from 'vitest'
import { FR_REGIONS, loadFrance, loadUsaAtlas, worldAtlas } from './atlas'
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

  it('draws the French départements and rebuilds the régions from them', async () => {
    const { departements, regions, frames } = await loadFrance()
    const listed = Object.values(FR_REGIONS).flat()
    expect(departements.codes).toHaveLength(101)
    expect(listed).toHaveLength(101)
    expect(new Set(listed)).toEqual(new Set(departements.codes))
    expect([...regions.codes].sort()).toEqual(Object.keys(FR_REGIONS).sort())
    expect(departements.neighbors.get('29')).toEqual(new Set(['22', '56']))
    expect(regions.neighbors.get('Bretagne')).toEqual(new Set(['Normandie', 'Pays de la Loire']))
    // la Corse et l'outre-mer n'ont pas de frontière terrestre avec le reste
    expect(regions.neighbors.has('Corse')).toBe(false)
    expect(departements.neighbors.has('974')).toBe(false)
    expect(frames.map((f) => f.id).sort()).toEqual(['971', '972', '973', '974', '976'])
  })

  it('names world countries in French with their continent', () => {
    const w = worldAtlas()
    expect(w.name('DE')).toBe('Allemagne')
    expect(w.region('BR')).toBe('Amérique du Sud')
    expect(w.playable).not.toContain('GF')
  })
})
