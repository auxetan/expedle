import { PbfWriter } from 'pbf'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWorld } from '../../geo/world'
import { mulberry32 } from '../../lib/util'
import { MODES } from './guess'
import { chain, findMapillary, isStreet, panoPoints, TokenError, type Img } from './mapillary'

const zigzag = (n: number) => (n << 1) ^ (n >> 31)

// Tuile vectorielle minimale au format Mapbox : un calque « overview » de points portant sequence_id et is_pano.
function tile(points: { sequence: string; is_pano: boolean; x: number; y: number }[]): ArrayBuffer {
  const keys = ['sequence_id', 'is_pano']
  const values: (string | boolean)[] = []
  const index = (v: string | boolean) => (values.includes(v) ? values.indexOf(v) : values.push(v) - 1)
  const tagged = points.map((p) => ({ ...p, tags: [0, index(p.sequence), 1, index(p.is_pano)] }))
  const pbf = new PbfWriter()
  pbf.writeMessage(
    3,
    (_: null, layer) => {
      layer.writeVarintField(15, 2)
      layer.writeStringField(1, 'overview')
      tagged.forEach((p) =>
        layer.writeMessage(
          2,
          (_: null, f) => {
            f.writePackedVarint(2, p.tags)
            f.writeVarintField(3, 1)
            f.writePackedVarint(4, [9, zigzag(p.x), zigzag(p.y)])
          },
          null,
        ),
      )
      keys.forEach((k) => layer.writeStringField(3, k))
      values.forEach((v) =>
        layer.writeMessage(4, (_: null, m) => (typeof v === 'string' ? m.writeStringField(1, v) : m.writeBooleanField(7, v)), null),
      )
      layer.writeVarintField(5, 4096)
    },
    null,
  )
  const bytes = pbf.finish()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

const img = (id: string, t: number, lng: number, lat: number, extra: Partial<Img> = {}): Img => ({
  id,
  captured_at: t,
  geometry: { coordinates: [lng, lat] },
  width: 5760,
  height: 2880,
  ...extra,
})

describe('Mapillary', () => {
  it('ne garde que les séquences 360° de la tuile du monde, en degrés', () => {
    const points = panoPoints(
      tile([
        { sequence: 'seqA', is_pano: true, x: 2048, y: 2048 },
        { sequence: 'seqB', is_pano: false, x: 100, y: 100 },
        { sequence: 'seqC', is_pano: true, x: 2048, y: 1024 },
      ]),
    )
    expect(points.map((p) => p.sequence)).toEqual(['seqA', 'seqC'])
    expect(points[0].lng).toBeCloseTo(0)
    expect(points[0].lat).toBeCloseTo(0)
    expect(points[1].lat).toBeCloseTo(66.51, 1)
    expect(panoPoints(new PbfWriter().finish().buffer as ArrayBuffer)).toEqual([])
  })

  it('enchaîne les images d’une séquence dans l’ordre de prise de vue, sans les arrêts', () => {
    const frames = chain([
      img('c', 3, 2.3404, 48.86),
      img('a', 1, 2.34, 48.86, { computed_geometry: { coordinates: [2.3401, 48.86] }, computed_compass_angle: 90, compass_angle: 80 }),
      img('b', 2, 2.3402, 48.86),
      img('stop', 2.5, 2.34021, 48.86),
    ])
    expect(frames.map((f) => f.id)).toEqual(['a', 'b', 'c'])
    expect(frames[0]).toMatchObject({ lng: 2.3401, azimuth: 90, date: 1 })
    expect(frames[0].links.map((l) => l.id)).toEqual(['b'])
    expect(frames[1].links.map((l) => l.id)).toEqual(['a', 'c'])
  })

  it('écarte les panoramas incomplets, qui s’afficheraient étirés', () => {
    const frames = chain([img('plein', 1, 2.34, 48.86), img('bande', 2, 2.3402, 48.86, { width: 13070, height: 3868 }), img('suite', 3, 2.3404, 48.86)])
    expect(frames.map((f) => f.id)).toEqual(['plein', 'suite'])
    expect(frames[0].links.map((l) => l.id)).toEqual(['suite'])
  })

  it('suppose la caméra tournée vers l’image suivante quand la boussole manque', () => {
    const frames = chain([img('a', 1, 2.34, 48.86, { compass_angle: 0 }), img('b', 2, 2.34, 48.8601), img('c', 3, 2.3401, 48.8601, { compass_angle: 33 })])
    expect(frames[0].azimuth).toBeCloseTo(0, 0)
    expect(frames[1].azimuth).toBeCloseTo(90, 0)
    expect(frames[2].azimuth).toBe(33)
  })

  it('ne retient que les vraies rues, pas les sphères isolées ni les visites d’intérieur', () => {
    const walk = (n: number, step: number) => chain(Array.from({ length: n }, (_, i) => img(`i${i}`, i, 2.34 + i * step, 48.86)))
    expect(isStreet(walk(30, 0.0002))).toBe(true)
    expect(isStreet(walk(3, 0.002))).toBe(false)
    expect(isStreet(walk(10, 0.0002))).toBe(false)
  })
})

// Position d'un point dans la tuile 0/0/0 (Web Mercator, 4 096 unités de côté).
const at = (lng: number, lat: number) => ({
  x: Math.round(((lng + 180) / 360) * 4096),
  y: Math.round(((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * 4096),
})

function mockMapillary(sequences: Record<string, Img[]>, error?: object, unpublished = new Set<string>()) {
  const fetchMock = vi.fn(async (url: string) => {
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
    if (url.includes('tiles.mapillary.com'))
      return { ok: true, status: 200, arrayBuffer: async () => tile(Object.keys(sequences).map((sequence) => ({ sequence, is_pano: true, ...at(2.35, 48.86) }))) }
    if (error) return json({ error })
    const seq = new URL(url).searchParams.get('sequence_ids')
    if (seq) return json({ data: sequences[seq] })
    const id = new URL(url).pathname.slice(1)
    if (unpublished.has(id[0])) return json({ id })
    return json({ id, thumb_1024_url: `https://x/${id}-1024.jpg`, thumb_2048_url: `https://x/${id}-2048.jpg`, creator: { username: 'lea' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const france = MODES.find((m) => m.id === 'france')!
const street = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => img(`${prefix}${i}`, i, 2.34 + i * 0.001, 48.86))

describe('tirage Mapillary', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('choisit une image d’une vraie rue du pays, avec son auteur', async () => {
    mockMapillary({ seule: street('s', 1), rue: street('r', 8) })
    const spot = await findMapillary(getWorld(), 'jeton-a', france, mulberry32(4), new Set(), new AbortController().signal)
    expect(spot.id).toMatch(/^r\d$/)
    expect(spot).toMatchObject({ country: 'FR', credit: 'lea', license: 'CC BY-SA 4.0' })
    expect(spot.start.panorama.tileUrl(0, 0)).toBe(`https://x/${spot.id}-2048.jpg`)
    expect(spot.start.links.length).toBeGreaterThan(0)
  })

  it('passe les séquences dont les images ne sont pas encore publiées', async () => {
    mockMapillary({ brouillon: street('b', 8), rue: street('r', 8) }, undefined, new Set(['b']))
    const spot = await findMapillary(getWorld(), 'jeton-c', france, mulberry32(9), new Set(), new AbortController().signal)
    expect(spot.id).toMatch(/^r\d$/)
  })

  it('remonte un jeton refusé au lieu de chercher ailleurs', async () => {
    mockMapillary({ rue: street('r', 8) }, { message: 'Invalid OAuth access token', type: 'OAuthException', code: 190 })
    await expect(findMapillary(getWorld(), 'jeton-b', france, mulberry32(4), new Set(), new AbortController().signal)).rejects.toBeInstanceOf(TokenError)
  })
})
