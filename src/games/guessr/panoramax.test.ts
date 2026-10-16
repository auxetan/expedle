import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWorld } from '../../geo/world'
import { mulberry32 } from '../../lib/util'
import { findPanoramax, metropolePoint, panoramaxNode, toNode, type Item } from './panoramax'

const world = getWorld()
const PIC = 'https://panoramax.ign.fr/api/pictures/2217ffd9'

// Une vraie réponse du catalogue (Lyon, GoPro Max), réduite aux champs utilisés.
const item = (over: Partial<Item> = {}): Item => ({
  id: '2217ffd9',
  collection: '1f381664',
  geometry: { coordinates: [4.8301117, 45.759924] },
  links: [
    { rel: 'self', href: 'https://api.panoramax.xyz/api/collections/1f381664/items/2217ffd9' },
    { rel: 'prev', href: '…', id: '485ddcad', geometry: { coordinates: [4.8301279, 45.7599416] } },
    { rel: 'next', href: '…', id: '6467066f', geometry: { coordinates: [4.8301013, 45.7599044] } },
  ],
  assets: { sd: { href: `${PIC}/sd.jpg` }, thumb: { href: `${PIC}/thumb.jpg` } },
  asset_templates: { tiles: { href: `${PIC}/tiled/{TileCol}_{TileRow}.jpg` } },
  providers: [{ name: 'ecartip', roles: ['producer'] }],
  properties: {
    datetime: '2026-03-03T13:31:03+00:00',
    license: 'etalab-2.0',
    'view:azimuth': 207,
    'tiles:tile_matrix_sets': { geovisio: { tileMatrix: [{ tileWidth: 720, matrixWidth: 8, matrixHeight: 4 }] } },
  },
  ...over,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Panoramax', () => {
  it('découpe la vue en tuiles nettes, avec l’image SD en attendant', () => {
    const node = toNode(item())
    expect(node).toMatchObject({ id: '1f381664/2217ffd9', lng: 4.8301117, lat: 45.759924, azimuth: 207 })
    expect(node.panorama).toMatchObject({ width: 5760, cols: 8, rows: 4, baseUrl: `${PIC}/sd.jpg` })
    expect(node.panorama.tileUrl(3, 1)).toBe(`${PIC}/tiled/3_1.jpg`)
  })

  it('relie la vue aux précédente et suivante de sa séquence', () => {
    expect(toNode(item()).links).toEqual([
      { id: '1f381664/485ddcad', lng: 4.8301279, lat: 45.7599416 },
      { id: '1f381664/6467066f', lng: 4.8301013, lat: 45.7599044 },
    ])
  })

  it('se rabat sur l’image entière quand il n’y a pas de tuiles utilisables', () => {
    const flat = toNode(item({ asset_templates: undefined }))
    expect(flat.panorama).toMatchObject({ width: 2048, cols: 1, rows: 1, baseUrl: `${PIC}/thumb.jpg` })
    expect(flat.panorama.tileUrl(0, 0)).toBe(`${PIC}/sd.jpg`)
    const odd = item()
    odd.properties['tiles:tile_matrix_sets'] = { geovisio: { tileMatrix: [{ tileWidth: 640, matrixWidth: 6, matrixHeight: 3 }] } }
    expect(toNode(odd).panorama.cols).toBe(1)
  })

  it('ne tire que des points de France métropolitaine', () => {
    const rng = mulberry32(11)
    for (let i = 0; i < 200; i++) {
      const [lng, lat] = metropolePoint(world, rng)
      expect(lng).toBeGreaterThan(-5.3)
      expect(lng).toBeLessThan(9.7)
      expect(lat).toBeGreaterThan(41.3)
      expect(lat).toBeLessThan(51.2)
    }
  })

  it('choisit une vue jamais jouée, d’où l’on peut avancer, et la garde pour la visionneuse', async () => {
    const stuck = item({ id: 'seule', links: [] })
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ features: url.includes('/search?') ? [item(), stuck] : [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const spot = await findPanoramax(world, mulberry32(2), new Set(), new AbortController().signal)
    expect(spot).toMatchObject({ id: '2217ffd9', country: 'FR', credit: 'ecartip', license: 'etalab-2.0' })
    expect(spot.page).toContain('pic=2217ffd9')
    const calls = fetchMock.mock.calls.length
    expect(await panoramaxNode(spot.start.id)).toBe(spot.start)
    expect(fetchMock.mock.calls.length).toBe(calls)
    await expect(findPanoramax(world, mulberry32(2), new Set(['2217ffd9']), new AbortController().signal)).rejects.toThrow('Aucune vue')
  })
})
