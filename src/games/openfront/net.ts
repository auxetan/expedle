// Les salons en ligne de Frontières, sur le canal temps réel du projet Supabase du site. Comme sur OpenFront,
// seuls les ordres circulent : l'hôte lance la partie avec une graine commune, recueille les ordres de chacun
// et les renvoie à tous, rangés en tours numérotés. Chaque joueur fait tourner la même partie chez lui.
import type { RealtimeChannel } from '@supabase/supabase-js'
import { realtime } from '../../lib/cloud'
import type { Intent, Turn } from './lockstep'
import type { Command } from './protocol'
import { TICK_MS, type Level } from './rules'

export interface Member {
  key: string
  name: string
  skin: string
  host: boolean
}

export interface LobbySettings {
  level: Level
  bots: number
  nations: boolean
  nukes: boolean
}

export interface Start {
  seed: number
  // les joueurs dans l'ordre de leur numéro, l'hôte en premier
  members: Member[]
  settings: LobbySettings
}

// Ce que la partie attend du réseau : envoyer ses ordres, recevoir les tours, signaler son empreinte.
export interface Net {
  intent(id: number, cmd: Command): void
  // branche la partie sur les tours ; ceux déjà reçus lui sont donnés d'abord
  attach(consume: (turns: Turn[]) => void): void
  hash(n: number, h: number): void
}

// deux tours par message : cinq envois par seconde suffisent pour jouer à dix tours par seconde
const BATCH = 2
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
// le temps laissé à un salon pour montrer son hôte avant de le dire introuvable
const FIND_MS = 6000

export const newCode = () => Array.from({ length: 5 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('')

export class Lobby implements Net {
  readonly key = crypto.randomUUID()
  readonly code: string
  readonly host: boolean
  members: Member[] = []
  onMembers: (members: Member[]) => void = () => {}
  onStart: (start: Start) => void = () => {}
  // l'hôte est parti, ou la connexion est perdue
  onClose: (reason: 'hote' | 'reseau') => void = () => {}
  onDesync: () => void = () => {}
  private channel!: RealtimeChannel
  private me: Member
  private started = false
  private sawHost = false
  private order: string[] = []
  private pending: Intent[] = []
  private next = 0
  private clock: Worker | null = null
  // les tours arrivés pendant que la carte se construit, en attendant que la partie se branche
  private backlog: Turn[] = []
  private consume: ((turns: Turn[]) => void) | null = null
  // empreintes de l'hôte, et celles des invités reçues avant la sienne
  private mine = new Map<number, number>()
  private theirs = new Map<number, { key: string; h: number }[]>()

  private constructor(code: string, host: boolean, name: string, skin: string) {
    this.code = code
    this.host = host
    this.me = { key: this.key, name, skin, host }
  }

  // Ouvre (ou crée, pour l'hôte) le salon `code`. Un invité attend d'y voir l'hôte, sinon le salon est introuvable.
  static async open(code: string, host: boolean, name: string, skin: string): Promise<Lobby> {
    const lobby = new Lobby(code, host, name, skin)
    await lobby.connect()
    if (!host && !(await lobby.findHost())) {
      lobby.leave()
      throw new Error('introuvable')
    }
    return lobby
  }

  private async connect() {
    const sb = await realtime()
    this.channel = sb.channel(`frontieres:${this.code}`, { config: { broadcast: { self: false }, presence: { key: this.key } } })
    this.channel
      .on('presence', { event: 'sync' }, () => this.sync())
      .on('broadcast', { event: 'start' }, ({ payload }) => this.begin(payload as Start))
      .on('broadcast', { event: 'turns' }, ({ payload }) => this.deliver((payload as { turns: Turn[] }).turns))
      .on('broadcast', { event: 'intent' }, ({ payload }) => this.receive(payload as { key: string; id: number; cmd: Command }))
      .on('broadcast', { event: 'hash' }, ({ payload }) => this.check(payload as { key: string; n: number; h: number }))
      .on('broadcast', { event: 'desync' }, ({ payload }) => (payload as { key: string }).key === this.key && this.onDesync())
    await new Promise<void>((resolve, reject) =>
      this.channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') this.channel.track(this.me).then(() => resolve(), reject)
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (this.started) this.onClose('reseau')
          reject(new Error(status))
        }
      }),
    )
  }

  private findHost(): Promise<boolean> {
    if (this.sawHost) return Promise.resolve(true)
    return new Promise((resolve) => {
      const done = (found: boolean) => {
        clearTimeout(timer)
        resolve(found)
      }
      const timer = window.setTimeout(() => done(false), FIND_MS)
      const before = this.onMembers
      this.onMembers = (members) => {
        before(members)
        if (this.sawHost) {
          this.onMembers = before
          done(true)
        }
      }
    })
  }

  private sync() {
    const state = this.channel.presenceState<Member>()
    this.members = Object.values(state)
      .map((list) => list[0])
      .sort((a, b) => Number(b.host) - Number(a.host) || a.key.localeCompare(b.key))
    const hostHere = this.members.some((m) => m.host)
    if (hostHere) this.sawHost = true
    else if (this.sawHost && !this.host) this.onClose('hote')
    this.onMembers(this.members)
  }

  private begin(start: Start) {
    if (this.started) return
    this.started = true
    this.order = start.members.map((m) => m.key)
    this.onStart(start)
  }

  // L'hôte lance la partie : la graine, l'ordre des joueurs et les réglages partent vers tous.
  start(settings: LobbySettings) {
    if (!this.host || this.started) return
    const start: Start = { seed: Math.floor(Math.random() * 2 ** 31), members: this.members, settings }
    this.channel.send({ type: 'broadcast', event: 'start', payload: start })
    this.begin(start)
    this.clock = new Worker(new URL('./clock.worker.ts', import.meta.url), { type: 'module' })
    this.clock.onmessage = () => this.tick()
    this.clock.postMessage(TICK_MS * BATCH)
  }

  // Le numéro de joueur d'un membre, dans l'ordre fixé au lancement.
  playerOf(key: string) {
    return this.order.indexOf(key) + 1
  }

  private tick() {
    const turns: Turn[] = []
    for (let i = 0; i < BATCH; i++) turns.push({ n: this.next++, intents: i ? [] : this.pending.splice(0) })
    this.channel.send({ type: 'broadcast', event: 'turns', payload: { turns } })
    this.deliver(turns)
  }

  private deliver(turns: Turn[]) {
    if (this.consume) this.consume(turns)
    else this.backlog.push(...turns)
  }

  attach(consume: (turns: Turn[]) => void) {
    this.consume = consume
    if (this.backlog.length) consume(this.backlog.splice(0))
  }

  intent(id: number, cmd: Command) {
    if (this.host) this.pending.push({ player: this.playerOf(this.key), id, cmd })
    else this.channel.send({ type: 'broadcast', event: 'intent', payload: { key: this.key, id, cmd } })
  }

  // l'hôte range l'ordre d'un invité sous son numéro : personne ne peut jouer à la place d'un autre
  private receive({ key, id, cmd }: { key: string; id: number; cmd: Command }) {
    const player = this.playerOf(key)
    if (this.host && player > 0) this.pending.push({ player, id, cmd })
  }

  hash(n: number, h: number) {
    if (!this.host) {
      this.channel.send({ type: 'broadcast', event: 'hash', payload: { key: this.key, n, h } })
      return
    }
    this.mine.set(n, h)
    for (const other of this.theirs.get(n) ?? []) this.compare(other.key, n, other.h)
    this.theirs.delete(n)
    if (this.mine.size > 20) this.mine.delete(Math.min(...this.mine.keys()))
  }

  private check({ key, n, h }: { key: string; n: number; h: number }) {
    if (!this.host) return
    if (this.mine.has(n)) this.compare(key, n, h)
    else this.theirs.set(n, [...(this.theirs.get(n) ?? []), { key, h }])
  }

  private compare(key: string, n: number, h: number) {
    if (this.mine.get(n) !== h) this.channel.send({ type: 'broadcast', event: 'desync', payload: { key } })
  }

  leave() {
    this.clock?.terminate()
    this.clock = null
    this.channel?.untrack()
    this.channel?.unsubscribe()
  }
}
