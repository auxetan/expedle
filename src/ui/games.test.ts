import { describe, expect, it } from 'vitest'
import { rubriqueOf } from './games'

describe('rubriqueOf', () => {
  it('rend la rubrique du jeu dont l’adresse est le plus long préfixe', () => {
    expect(rubriqueOf('#/quiz/drapeaux')?.label).toBe('Culture générale')
    expect(rubriqueOf('#/echelle/pop')?.label).toBe('Magnitudle')
    expect(rubriqueOf('#/itineraire/usa?x=1')?.label).toBe('Géographie')
  })

  it('ne prend un préfixe qu’à une frontière de segment', () => {
    expect(rubriqueOf('#/classement')?.label).toBe('Géographie')
    expect(rubriqueOf('#/classements')).toBeUndefined()
  })

  it('ne rend rien hors des jeux', () => {
    expect(rubriqueOf('#/boutique')).toBeUndefined()
    expect(rubriqueOf('')).toBeUndefined()
  })
})
