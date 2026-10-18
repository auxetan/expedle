import { describe, expect, it } from 'vitest'
import { checkDigit, mrz, mrzText } from './mrz'

describe('zone de lecture automatique', () => {
  it('calcule les chiffres de contrôle de la norme ICAO', () => {
    // exemple du document 9303 : passeport L898902C3, né le 12 août 1974, expirant le 15 avril 2012
    expect(checkDigit('L898902C3')).toBe('6')
    expect(checkDigit('740812')).toBe('2')
    expect(checkDigit('120415')).toBe('9')
  })

  it('écrit les noms sans accents ni espaces', () => {
    expect(mrzText('Zoé de la Tour')).toBe('ZOE<DE<LA<TOUR')
  })

  it('produit deux lignes de 44 caractères', () => {
    const [a, b] = mrz({ surname: 'Méridien', given: 'Globe-trotteur', number: 'M4KX9QZ2', issued: new Date(2026, 9, 18), expires: new Date(2036, 9, 18), country: 'MRD', personal: '12' })
    expect(a).toHaveLength(44)
    expect(b).toHaveLength(44)
    expect(a.startsWith('P<MRDMERIDIEN<<GLOBE<TROTTEUR<')).toBe(true)
    expect(b.slice(13, 19)).toBe('261018')
  })
})
