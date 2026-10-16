import { describe, expect, it } from 'vitest'
import { pickPhoto, score, stripHtml, type CommonsPage } from './photos'

const page = (pageid: number, title: string, extra: { mime?: string; w?: number; h?: number; cats?: string; coords?: boolean } = {}): CommonsPage => ({
  pageid,
  title: `File:${title}.jpg`,
  coordinates: extra.coords === false ? undefined : [{ lat: 45.46, lon: 9.19 }],
  imageinfo: [
    {
      mime: extra.mime ?? 'image/jpeg',
      width: extra.w ?? 2000,
      height: extra.h ?? 1300,
      thumburl: `https://upload.wikimedia.org/${pageid}.jpg`,
      descriptionurl: `https://commons.wikimedia.org/wiki/File:${pageid}`,
      extmetadata: { Categories: { value: extra.cats ?? '' }, Artist: { value: '<a href="x">Ada</a>' }, LicenseShortName: { value: 'CC BY 3.0' } },
    },
  ],
})

describe('barème', () => {
  it('donne 5 000 points au mètre près et décroît avec la distance', () => {
    expect(score(0, 14916)).toBe(5000)
    expect(score(1491.6, 14916)).toBe(1839)
    expect(score(20000, 14916)).toBe(0)
  })
})

describe('tri des photos', () => {
  const rng = () => 0
  it('écarte cartes, portraits, intérieurs, petites images et formats verticaux', () => {
    const pages = [
      page(1, 'Map of Milan'),
      page(2, 'Portrait of a man', { cats: 'Portraits' }),
      page(3, 'Duomo interior', { cats: 'Interiors of churches' }),
      page(4, 'Street', { w: 600, h: 400 }),
      page(5, 'Tower', { w: 1200, h: 1800 }),
      page(6, 'Diagram', { mime: 'image/png' }),
      page(7, 'No coordinates', { coords: false }),
      page(8, 'Musée du Louvre', { cats: 'Musée du Louvre' }),
      page(9, 'ISS047-E-19682 - View of Earth', { cats: 'Photos by ISS Expedition 47' }),
      page(13, 'Gracixalus yunnanensis 602995050', { cats: 'Gracixalus yunnanensis|Photos from iNaturalist' }),
      page(14, 'Freesia hybrid flower8', { cats: 'Flowers of Australia' }),
    ]
    expect(pickPhoto(pages, new Set(), rng)).toBeNull()
  })

  it('préfère les vues Panoramio et ignore celles déjà vues', () => {
    const pages = [page(10, 'Rue'), page(11, 'Canal', { cats: 'Panoramio files uploaded by Panoramio upload bot' }), page(12, 'Pont', { cats: 'Quality images' })]
    expect(pickPhoto(pages, new Set(), rng)?.pageid).toBe(11)
    expect(pickPhoto(pages, new Set([11]), rng)?.pageid).toBe(10)
    expect(pickPhoto([page(10, 'Rue')], new Set(), rng)?.pageid).toBe(10)
    expect(pickPhoto([page(10, 'Rue')], new Set(), rng, true)).toBeNull()
  })

  it('ne garde que le texte de l’auteur', () => {
    expect(stripHtml('<a href="https://x">Ada &amp; Bob</a> (<i>talk</i>)')).toBe('Ada & Bob (talk)')
  })
})
