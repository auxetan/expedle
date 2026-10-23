import { describe, expect, it } from 'vitest'
import { cuesOf, type After, type Before } from './sounds'

const ME = 1

const before = (over: Partial<Before> = {}): Before => ({
  units: [],
  nukes: [],
  missiles: [],
  boats: [],
  rails: [],
  players: [
    { id: 1, kind: 'human' },
    { id: 2, kind: 'human' },
    { id: 3, kind: 'bot' },
  ],
  ...over,
})

const after = (over: Partial<After> = {}): After => ({
  tick: 10,
  units: [],
  nukes: [],
  missiles: [],
  boats: [],
  blasts: [],
  events: [],
  ...over,
})

const unit = (id: number, type: Before['units'][number]['type'], owner = ME) => ({ id, type, owner })

describe('sons d’une partie', () => {
  it('saluent chaque bâtiment posé par le joueur, et seulement les siens', () => {
    const units = [unit(1, 'ville'), unit(2, 'port'), unit(3, 'poste'), unit(4, 'silo'), unit(5, 'dca'), unit(6, 'usine'), unit(7, 'navire'), unit(8, 'ville', 2)]
    expect(cuesOf(before(), after({ units }), ME)).toEqual(['build-city', 'build-port', 'build-defense-post', 'silo-built', 'sam-built', 'build-factory', 'build-warship'])
  })

  it('ne rejouent pas un bâtiment déjà là', () => {
    const units = [unit(1, 'ville')]
    expect(cuesOf(before({ units }), after({ units }), ME)).toEqual([])
  })

  it('pleurent un navire de guerre du joueur qui disparaît', () => {
    expect(cuesOf(before({ units: [unit(1, 'navire'), unit(2, 'navire', 2)] }), after(), ME)).toEqual(['warship-lost'])
  })

  it('font entendre chaque bombe lancée, d’où qu’elle vienne, mais pas les ogives d’un MIRV', () => {
    const nukes = [
      { id: 1, type: 'bombe' as const },
      { id: 2, type: 'hbombe' as const },
      { id: 3, type: 'mirv' as const },
      { id: 4, type: 'ogive' as const },
    ]
    expect(cuesOf(before(), after({ nukes }), ME)).toEqual(['atom-launch', 'hydrogen-launch', 'mirv-launch'])
  })

  it('distinguent l’explosion d’une bombe A, d’une bombe H et d’un missile abattu, au tour où elles arrivent', () => {
    const blasts = [
      { radius: 30, tick: 10 },
      { radius: 100, tick: 10 },
      { radius: 4, tick: 10 },
      { radius: 30, tick: 9 },
    ]
    expect(cuesOf(before(), after({ blasts }), ME)).toEqual(['atom-hit', 'hydrogen-hit', 'sam-hit'])
  })

  it('suivent les tirs des défenses, bateaux et rails du joueur', () => {
    const cues = cuesOf(
      before({ units: [unit(1, 'ville'), unit(2, 'usine'), unit(3, 'ville', 2)] }),
      after({
        units: [unit(1, 'ville'), unit(2, 'usine'), unit(3, 'ville', 2)],
        missiles: [
          { id: 1, owner: ME },
          { id: 2, owner: 2 },
        ],
        boats: [
          { id: 1, owner: ME, trade: false },
          { id: 2, owner: ME, trade: true },
          { id: 3, owner: 2, trade: false },
        ],
        rails: [{ a: 1, b: 2 }],
      }),
      ME,
    )
    expect(cues).toEqual(['sam-shoot', 'transport-ship', 'build-train-station'])
  })

  it('ne comptent pas une voie ferrée qui ne touche que les autres', () => {
    expect(cuesOf(before({ units: [unit(3, 'ville', 2), unit(4, 'ville', 2)] }), after({ units: [unit(3, 'ville', 2), unit(4, 'ville', 2)], rails: [{ a: 3, b: 4 }] }), ME)).toEqual([])
  })

  it('annoncent la diplomatie et les bombes qui visent le joueur', () => {
    const events = [
      { type: 'request' as const, from: 2, to: ME },
      { type: 'accepted' as const, from: ME, to: 2 },
      { type: 'refused' as const, from: 2, to: ME },
      { type: 'betrayed' as const, from: 2, to: ME },
      { type: 'nuke' as const, from: 2, to: ME },
      { type: 'emoji' as const, from: 2, to: ME },
      { type: 'request' as const, from: 2, to: 3 },
    ]
    expect(cuesOf(before(), after({ events }), ME)).toEqual(['alliance-suggested', 'alliance-accepted', 'alliance-declined', 'alliance-broken', 'nuke-warning', 'message'])
  })

  it('fêtent une conquête : bataille contre un humain, butin contre un bot', () => {
    const events = [
      { type: 'eliminated' as const, from: ME, to: 2 },
      { type: 'eliminated' as const, from: ME, to: 3 },
      { type: 'eliminated' as const, from: 2, to: 3 },
    ]
    expect(cuesOf(before(), after({ events }), ME)).toEqual(['conquered', 'ka-ching'])
  })
})
