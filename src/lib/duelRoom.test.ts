import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COUNTDOWN_MS, Duel, type Line, type Player, type Wire } from './duelRoom'
import type { Play } from './stats'

// Un canal temps réel en mémoire : la presence et les messages passent d'un client à l'autre, après coup comme en vrai.
function memoryWire(): Wire {
  const topics = new Map<string, Map<string, { me: object; on: Parameters<Wire['open']>[3] }>>()
  return {
    async open(topic, key, me, on) {
      const room = topics.get(topic) ?? new Map()
      topics.set(topic, room)
      const sync = () => queueMicrotask(() => room.forEach((m) => m.on.presence([...room.values()].map((x) => x.me) as never)))
      room.set(key, { me, on })
      sync()
      const line: Line<typeof me> = {
        send: (event, payload) => room.forEach((m, k) => k !== key && queueMicrotask(() => m.on.message(event, structuredClone(payload)))),
        track: (next) => {
          room.get(key)!.me = next
          sync()
        },
        close: () => {
          room.delete(key)
          sync()
        },
      }
      return line
    },
  }
}

const player = (key: string, joined: number, user = key): Player => ({ key, user, name: key, avatar: '🧭', joined, ready: false, game: null })
const play = (g: string, pts: number, win?: boolean): Play => ({ g, t: Date.now(), pts, win, sub: 'defi' })
const wait = (ms = 0) => vi.advanceTimersByTimeAsync(ms)

describe('salon de duel', () => {
  let wire: Wire
  beforeEach(() => {
    vi.useFakeTimers()
    wire = memoryWire()
  })
  afterEach(() => vi.useRealTimers())

  async function pair(game = 'flagle') {
    const host = new Duel('ABCDE', player('h', 1), wire)
    const guest = new Duel('ABCDE', player('g', 2), wire, 6000)
    await host.open()
    await guest.open()
    await wait()
    host.chooseGame(game)
    host.setReady(true)
    guest.setReady(true)
    await wait()
    return { host, guest }
  }

  it('réunit les deux joueurs, puis les fait partir ensemble sur la même graine', async () => {
    const { host, guest } = await pair()
    expect(host.state.host).toBe(true)
    expect(guest.state.them?.key).toBe('h')
    expect(guest.state.game).toBe('flagle')
    expect(host.state.phase).toBe('depart')
    expect(guest.state.round).toEqual(host.state.round)
    await wait(COUNTDOWN_MS)
    expect([host.state.phase, guest.state.phase]).toEqual(['partie', 'partie'])
  })

  it('fait gagner le plus rapide, et les deux le savent', async () => {
    const { host, guest } = await pair()
    const ended: string[] = []
    host.onEnd = (o) => ended.push(`h:${o}`)
    guest.onEnd = (o) => ended.push(`g:${o}`)
    await wait(COUNTDOWN_MS)
    guest.progress({ left: 2, unit: 'pays' })
    await wait()
    expect(host.state.progress).toEqual({ left: 2, unit: 'pays' })
    await wait(40_000)
    guest.played(play('flagle', 80, true))
    expect(guest.state.mine?.ms).toBe(40_000)
    expect(guest.state.outcome).toBeNull()
    await wait(500)
    expect(host.state.outcome).toBe('perdu')
    expect(guest.state.outcome).toBe('gagné')
    expect(ended.sort()).toEqual(['g:gagné', 'h:perdu'])
  })

  it('ignore les parties d’un autre jeu', async () => {
    const { host } = await pair()
    await wait(COUNTDOWN_MS)
    host.played(play('globle', 100, true))
    expect(host.state.mine).toBeNull()
  })

  it('rejoue une revanche quand les deux la veulent, sur une nouvelle graine', async () => {
    const { host, guest } = await pair()
    await wait(COUNTDOWN_MS + 1000)
    guest.played(play('flagle', 90, true))
    await wait(500)
    const first = host.state.round!
    host.rematch()
    await wait()
    expect(host.state.phase).toBe('fin')
    guest.rematch()
    await wait()
    expect(host.state.round?.n).toBe(2)
    expect(host.state.round?.seed).not.toBe(first.seed)
    expect(guest.state.round).toEqual(host.state.round)
    expect(guest.state.phase).toBe('depart')
  })

  it('donne la victoire à celui qui reste, une fois sa partie finie', async () => {
    const { host, guest } = await pair()
    await wait(COUNTDOWN_MS)
    guest.close()
    await wait(6000)
    expect(host.state.gone).toBe(true)
    expect(host.state.outcome).toBeNull()
    host.played(play('flagle', 30, false))
    expect(host.state.outcome).toBe('gagné')
  })

  it('perd tout de suite en abandonnant', async () => {
    const { host, guest } = await pair()
    await wait(COUNTDOWN_MS)
    host.giveUp()
    await wait()
    expect(host.state.outcome).toBe('perdu')
    expect(guest.state.outcome).toBeNull()
    guest.played(play('flagle', 10, false))
    expect(guest.state.outcome).toBe('gagné')
  })

  it('ferme la porte au troisième, et dit introuvable un salon vide', async () => {
    await pair()
    const third = new Duel('ABCDE', player('x', 3), wire)
    await third.open()
    await wait()
    expect(third.state.phase).toBe('complet')
    const lost = new Duel('ZZZZZ', player('y', 4), wire, 6000)
    await lost.open()
    await wait(6000)
    expect(lost.state.phase).toBe('introuvable')
  })
})
