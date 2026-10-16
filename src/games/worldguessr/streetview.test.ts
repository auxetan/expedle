import { describe, expect, it } from 'vitest'
import { getWorld } from '../../geo/world'
import { mulberry32 } from '../../lib/util'
import { MODES, pickCountry } from './guess'
import { acceptPano, COVERED } from './streetview'

describe('Street View', () => {
  it('a des pays couverts dans chaque mode de jeu', () => {
    const world = getWorld()
    const rng = mulberry32(1)
    for (const mode of MODES) expect(pickCountry(world, mode, rng, COVERED), mode.id).not.toBeNull()
  })

  it('ne garde que l’imagerie officielle de Google, jamais deux fois la même', () => {
    const ok = { status: 'OK', pano_id: 'abc', location: { lat: 48.85, lng: 2.29 }, copyright: '© 2023 Google' }
    expect(acceptPano(ok, new Set())).toBe(true)
    expect(acceptPano(ok, new Set(['abc']))).toBe(false)
    expect(acceptPano({ ...ok, copyright: '© Jean Dupont' }, new Set())).toBe(false)
    expect(acceptPano({ status: 'ZERO_RESULTS' }, new Set())).toBe(false)
  })
})
