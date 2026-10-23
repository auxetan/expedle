import { describe, expect, it } from 'vitest'
import { actionFor, DEFAULT_KEYS, keyName, rebind } from './keys'

describe('touches', () => {
  it('reprennent celles d’OpenFront, flèches et - = comprises', () => {
    expect(actionFor(DEFAULT_KEYS, 'Digit1')).toBe('buildCity')
    expect(actionFor(DEFAULT_KEYS, 'KeyT')).toBe('attackRatioDown')
    expect(actionFor(DEFAULT_KEYS, 'ArrowUp')).toBe('moveUp')
    expect(actionFor(DEFAULT_KEYS, 'Equal')).toBe('zoomIn')
    expect(actionFor(DEFAULT_KEYS, 'KeyZ')).toBeUndefined()
  })

  it('une touche choisie quitte l’action qui l’avait', () => {
    const keys = rebind(DEFAULT_KEYS, 'buildCity', 'KeyT')
    expect(actionFor(keys, 'KeyT')).toBe('buildCity')
    expect(keys.attackRatioDown).toBe('')
    expect(actionFor(keys, 'Digit1')).toBeUndefined()
  })

  it('s’affichent lisiblement', () => {
    expect([keyName('KeyW'), keyName('Digit0'), keyName('Comma'), keyName('')]).toEqual(['W', '0', ',', '—'])
  })
})
