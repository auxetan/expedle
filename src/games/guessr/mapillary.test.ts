import { PbfWriter } from 'pbf'
import { describe, expect, it } from 'vitest'
import { panoSequences, sequenceNodes, tileOf, type Img } from './mapillary'

// Tuile vectorielle minimale au format Mapbox : un calque « sequence » dont chaque trait porte id et is_pano.
function tile(features: { id: string; is_pano: boolean }[]): ArrayBuffer {
  const keys = ['id', 'is_pano']
  const values: (string | boolean)[] = []
  const index = (v: string | boolean) => (values.includes(v) ? values.indexOf(v) : values.push(v) - 1)
  const tags = features.map((f) => [0, index(f.id), 1, index(f.is_pano)])
  const pbf = new PbfWriter()
  pbf.writeMessage(
    3,
    (_: null, layer) => {
      layer.writeVarintField(15, 2)
      layer.writeStringField(1, 'sequence')
      tags.forEach((t) =>
        layer.writeMessage(
          2,
          (_: null, f) => {
            f.writePackedVarint(2, t)
            f.writeVarintField(3, 2)
            f.writePackedVarint(4, [9, 0, 0, 10, 2, 2])
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
  thumb_2048_url: `https://x/${id}.jpg`,
  ...extra,
})

describe('Mapillary', () => {
  it('trouve la tuile qui contient un point', () => {
    expect(tileOf([0, 0], 1)).toEqual([1, 1])
    expect(tileOf([2.35, 48.86], 7)).toEqual([64, 44])
    expect(tileOf([180, -90], 3)).toEqual([7, 7])
  })

  it('ne garde que les séquences 360° de la tuile', () => {
    const buf = tile([
      { id: 'seqA', is_pano: true },
      { id: 'seqB', is_pano: false },
      { id: 'seqC', is_pano: true },
    ])
    expect(panoSequences(buf)).toEqual(['seqA', 'seqC'])
    expect(panoSequences(new PbfWriter().finish().buffer as ArrayBuffer)).toEqual([])
  })

  it('enchaîne les images d’une séquence dans l’ordre de prise de vue, sans les arrêts', () => {
    const nodes = sequenceNodes([
      img('c', 3, 2.3404, 48.86),
      img('a', 1, 2.34, 48.86, { computed_geometry: { coordinates: [2.3401, 48.86] }, computed_compass_angle: 90, compass_angle: 80 }),
      img('b', 2, 2.3402, 48.86),
      img('stop', 2.5, 2.34021, 48.86),
      img('nothumb', 4, 2.3406, 48.86, { thumb_2048_url: undefined }),
    ])
    expect(nodes.map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(nodes[0]).toMatchObject({ lng: 2.3401, azimuth: 90 })
    expect(nodes[0].links.map((l) => l.id)).toEqual(['b'])
    expect(nodes[1].links.map((l) => l.id)).toEqual(['a', 'c'])
    expect(nodes[1].panorama.tileUrl(0, 0)).toBe('https://x/b.jpg')
  })
})
