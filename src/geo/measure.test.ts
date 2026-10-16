import { geoContains } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../lib/util'
import { borderDistanceKm, compassArrow, countryAt, countryCenter, distanceKm, randomPointIn, rhumbBearing, simplifiedFeatures } from './measure'
import { getWorld } from './world'

const world = getWorld()

describe('distances et caps', () => {
  it('mesure Paris – Londres', () => {
    expect(distanceKm([2.35, 48.86], [-0.13, 51.51])).toBeGreaterThan(335)
    expect(distanceKm([2.35, 48.86], [-0.13, 51.51])).toBeLessThan(350)
  })

  it('donne le cap à la boussole, comme sur une carte plane', () => {
    const fr = countryCenter(world, 'FR')
    expect(compassArrow(rhumbBearing(fr, countryCenter(world, 'JP')))).toBe('➡️')
    expect(compassArrow(rhumbBearing(fr, countryCenter(world, 'ES')))).toBe('↙️')
    expect(compassArrow(rhumbBearing(fr, countryCenter(world, 'NO')))).toBe('⬆️')
  })
})

describe('pays', () => {
  it('place le centre sur la masse principale', () => {
    const [lon, lat] = countryCenter(world, 'FR')
    expect(lon).toBeGreaterThan(0)
    expect(lon).toBeLessThan(6)
    expect(lat).toBeGreaterThan(44)
    expect(lat).toBeLessThan(49)
    const [ulon, ulat] = countryCenter(world, 'US')
    expect(ulon).toBeGreaterThan(-105)
    expect(ulon).toBeLessThan(-90)
    expect(ulat).toBeGreaterThan(35)
    expect(ulat).toBeLessThan(42)
  })

  it('mesure la distance entre frontières, nulle pour des voisins terrestres', () => {
    expect(borderDistanceKm(world, 'FR', 'ES')).toBe(0)
    const channel = borderDistanceKm(world, 'FR', 'GB')
    expect(channel).toBeGreaterThan(20)
    expect(channel).toBeLessThan(120)
    expect(borderDistanceKm(world, 'FR', 'JP')).toBeGreaterThan(8000)
  })

  it('retrouve le pays sous un point', () => {
    expect(countryAt(world, [2.35, 48.86])).toBe('FR')
    expect(countryAt(world, [-30, 30])).toBeNull()
  })

  it('tire des points à l’intérieur du pays demandé, même à cheval sur l’antiméridien', () => {
    const rng = mulberry32(7)
    for (const code of ['FR', 'RU', 'CL', 'FJ', 'IT']) {
      for (let i = 0; i < 5; i++) expect(countryAt(world, randomPointIn(world, code, rng)), code).toBe(code)
    }
  })
})

describe('géométrie allégée pour le globe', () => {
  it('garde la forme avec beaucoup moins de points', () => {
    const lite = simplifiedFeatures(world)
    const count = (f: { geometry: { coordinates: number[][][][] } }) => f.geometry.coordinates.flat(2).length
    const full = [...world.features.values()].reduce((s, f) => s + count(f), 0)
    const light = [...lite.values()].reduce((s, f) => s + count(f), 0)
    expect(light).toBeLessThan(full * 0.4)
    expect(geoContains(lite.get('FR')!, [2.35, 48.86])).toBe(true)
    expect(geoContains(lite.get('JP')!, [139.7, 35.7])).toBe(true)
    expect(lite.size).toBe(world.features.size)
  })
})
