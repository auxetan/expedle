import { beforeEach, describe, expect, it, vi } from 'vitest'
import { due, mastery, record, savoir, SAVOIR_CHANGED } from './savoir'

// le 29 octobre 2026 à `hour` heures, décalé de `days` jours
const at = (days: number, hour = 10) => new Date(2026, 9, 29 + days, hour).getTime()

describe('savoir', () => {
  // le localStorage de Node demande un fichier : une mémoire suffit ici
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) })
    vi.stubGlobal('dispatchEvent', () => true)
  })

  it('date les réussites et les échecs de chaque pays, angle par angle', () => {
    record('FR', 'drapeau', true, at(0))
    record('FR', 'drapeau', false, at(0, 11))
    record('JP', 'capitale', true, at(0))
    expect(savoir().FR?.drapeau).toEqual({ box: 1, at: at(0, 11), ok: [at(0)], ko: [at(0, 11)] })
    expect(JSON.parse(localStorage.getItem('cg:savoir')!).JP.capitale.ok).toEqual([at(0)])
  })

  it('ne retient que les vrais pays', () => {
    record('GP', 'forme', true, at(0))
    record('06', 'forme', true, at(0))
    record('ZZ', 'forme', false, at(0))
    expect(savoir()).toEqual({})
  })

  it('fait monter une réussite d’une boîte et renvoie un échec dans la première', () => {
    record('BR', 'forme', true, at(0))
    record('BR', 'forme', true, at(1))
    record('BR', 'forme', true, at(4))
    expect(savoir().BR?.forme?.box).toBe(4)
    record('BR', 'forme', false, at(5))
    expect(savoir().BR?.forme?.box).toBe(1)
  })

  it('ne fait pas monter une réussite avant l’heure, ni au-delà de la dernière boîte', () => {
    record('PE', 'capitale', true, at(0))
    record('PE', 'capitale', true, at(0, 18))
    expect(savoir().PE?.capitale).toMatchObject({ box: 2, at: at(0) })
    expect(savoir().PE?.capitale?.ok).toHaveLength(2)
    for (const day of [1, 4, 11, 32, 53]) record('PE', 'capitale', true, at(day))
    expect(savoir().PE?.capitale).toMatchObject({ box: 5, at: at(53) })
  })

  it('ne garde que les dernières dates', () => {
    for (let day = 0; day < 8; day++) record('CL', 'position', false, at(day))
    expect(savoir().CL?.position?.ko).toEqual([3, 4, 5, 6, 7].map((day) => at(day)))
  })

  it('ressort chaque carte quand le délai de sa boîte est écoulé', () => {
    record('DE', 'position', false, at(0))
    record('IT', 'position', true, at(0))
    record('IT', 'voisins', true, at(0))
    record('IT', 'voisins', true, at(1))
    expect(due(at(0, 23))).toEqual([{ code: 'DE', facet: 'position', box: 1 }])
    expect(due(at(1, 0))).toEqual([
      { code: 'DE', facet: 'position', box: 1 },
      { code: 'IT', facet: 'position', box: 2 },
    ])
    expect(due(at(3)).map((d) => `${d.code} ${d.facet}`)).toEqual(['DE position', 'IT position'])
    expect(due(at(4)).map((d) => `${d.code} ${d.facet}`)).toEqual(['DE position', 'IT position', 'IT voisins'])
  })

  it('met les cartes les plus fragiles en tête, puis celles qui attendent depuis le plus longtemps', () => {
    record('MA', 'drapeau', true, at(0))
    record('EG', 'drapeau', true, at(-1))
    record('KE', 'drapeau', false, at(0))
    expect(due(at(2)).map((d) => d.code)).toEqual(['KE', 'EG', 'MA'])
  })

  it('mesure la maîtrise de chaque angle et du pays entier', () => {
    for (const day of [0, 1, 4, 11]) record('FR', 'forme', true, at(day))
    record('FR', 'drapeau', true, at(0))
    record('FR', 'capitale', false, at(0))
    const m = mastery('FR')
    expect(m.by).toEqual({ forme: 1, drapeau: 0.25, capitale: 0, position: null, voisins: null })
    expect(m.overall).toBeCloseTo(1.25 / 5)
    // un pays sans voisin terrestre ne compte pas cet angle
    expect(mastery('FR', ['forme', 'drapeau', 'capitale', 'position']).overall).toBeCloseTo(1.25 / 4)
    expect(mastery('NZ')).toEqual({ overall: 0, by: { forme: null, drapeau: null, capitale: null, position: null, voisins: null } })
  })

  it('annonce chaque changement', () => {
    const heard = vi.fn()
    vi.stubGlobal('dispatchEvent', heard)
    record('AQ', 'forme', true, at(0))
    expect(heard).not.toHaveBeenCalled()
    record('NO', 'forme', true, at(0))
    expect(heard).toHaveBeenCalledOnce()
    expect(heard.mock.calls[0][0].type).toBe(SAVOIR_CHANGED)
  })
})
