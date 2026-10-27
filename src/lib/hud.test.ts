import { describe, expect, it } from 'vitest'
import { hudState, roundStep } from './hud'

describe('bandeau de jeu', () => {
  it('compte les bonnes réponses d’affilée, sans les cases à venir', () => {
    expect(hudState([true, false, true, true, null, null]).combo).toBe(2)
    expect(hudState([null, null]).combo).toBe(0)
  })

  it('donne à Pépite l’humeur de la dernière réponse', () => {
    expect(hudState([null]).mood).toBe('calme')
    expect(hudState([true, null]).mood).toBe('joie')
    expect(hudState([true, false, null]).mood).toBe('rate')
    expect(hudState([true, 'presque', null]).mood).toBe('surprise')
  })

  it('ne parle qu’aux paliers du combo, et quand un beau combo se casse', () => {
    expect(hudState([true, true, null]).word).toBeNull()
    expect(hudState([true, true, true, null]).word).toBe('Ça chauffe')
    expect(hudState([true, true, true, true, true]).word).toBe('Inarrêtable')
    expect(hudState([true, true, true, false]).word).toBe('Oups')
    expect(hudState([true, true, false]).word).toBeNull()
  })

  it('ne compte pas un « presque » dans le combo', () => {
    expect(hudState([true, true, 'presque']).combo).toBe(0)
  })

  it('colore une manche notée selon son score', () => {
    expect([roundStep(95), roundStep(80), roundStep(60), roundStep(39)]).toEqual([true, true, 'presque', false])
  })
})
