// Les salons en ligne de Frontières, sur le canal temps réel du projet Supabase du site. Comme sur OpenFront,
// seuls les ordres circulent : l'hôte lance la partie avec une graine commune, recueille les ordres de chacun
// et les renvoie à tous, rangés en tours numérotés. Chaque joueur fait tourner la même partie chez lui.
import type { RealtimeChannel } from '@supabase/supabase-js'
import { realtime } from '../../lib/cloud'
import { TRIBES } from './choices'
import type { Intent, Turn } from './lockstep'
import type { Command } from './protocol'
import { TICK_MS, type Level } from './rules'

export interface Member {
  key: string
  name: string
  skin: string
  host: boolean
  // l'heure d'arrivée : quand une partie publique déborde, les derniers venus laissent la place
  joined: number
  // partie publique : l'heure du départ et la carte, fixées par l'hôte
  startsAt?: number
  map?: string
  teams?: number
}

export interface LobbySettings {
  level: Level
  bots: number
  nations: boolean
  nukes: boolean
  // la carte d'OpenFront, par son identifiant
  map: string
  // nombre d'équipes, 0 pour chacun pour soi
  teams: number
  // la carte compacte d'OpenFront, quatre fois moins de cases
  compact: boolean
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

// Les parties publiques, comme sur OpenFront : réglages fixes, départ à heure dite, ouvertes à tous.
export const PUBLIC_MAX = 8
export const PUBLIC_WAIT_MS = 60_000
export const publicSettings = (map: string, teams: number): LobbySettings => ({ level: 'moyen', bots: TRIBES, nations: true, nukes: true, map, teams, compact: false })

// Comme sur OpenFront, une partie publique sur trois se joue par équipes, de deux à quatre.
export const pickPublicTeams = (rng: () => number = Math.random) => (rng() < 1 / 3 ? 2 + Math.floor(rng() * 3) : 0)
// le temps qu'il faut au moins pour rejoindre une partie avant son départ
const JOIN_MARGIN_MS = 5000

// une partie publique en attente, telle que son hôte l'annonce
export interface Listing {
  code: string
  players: number
  startsAt: number
  map: string
  teams: number
}

// l'ordre des parties publiques : la plus proche du départ d'abord, puis par code pour que tous tranchent pareil
export const ranked = (a: Listing, b: Listing) => a.startsAt - b.startsAt || a.code.localeCompare(b.code)

// La partie publique à rejoindre : la première à partir qui a encore de la place et le temps d'arriver.
export function joinable(list: Listing[], now: number, mine?: string): Listing | undefined {
  return list.filter((l) => l.code !== mine && l.players < PUBLIC_MAX && l.startsAt - now > JOIN_MARGIN_MS).sort(ranked)[0]
}

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
    this.me = { key: this.key, name, skin, host, joined: Date.now() }
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
      .sort((a, b) => Number(b.host) - Number(a.host) || a.joined - b.joined || a.key.localeCompare(b.key))
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
  start(settings: LobbySettings, max = Infinity) {
    if (!this.host || this.started) return
    const start: Start = { seed: Math.floor(Math.random() * 2 ** 31), members: this.members.slice(0, max), settings }
    this.channel.send({ type: 'broadcast', event: 'start', payload: start })
    this.begin(start)
    this.clock = new Worker(new URL('./clock.worker.ts', import.meta.url), { type: 'module' })
    this.clock.onmessage = () => this.tick()
    this.clock.postMessage(TICK_MS * BATCH)
  }

  // L'hôte d'une partie publique fixe (ou repousse) l'heure du départ, et tire la carte ; tous les membres les voient.
  setPublic(startsAt: number, map: string, teams: number) {
    this.me.startsAt = startsAt
    this.me.map = map
    this.me.teams = teams
    void this.channel.track(this.me)
  }

  private hostMember() {
    return this.host ? this.me : this.members.find((m) => m.host)
  }

  startsAt = () => this.hostMember()?.startsAt

  publicMap = () => this.hostMember()?.map

  publicTeams = () => this.hostMember()?.teams ?? 0

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

// L'annuaire des parties publiques : un canal commun où chaque hôte annonce la sienne, que tous voient.
// L'accueil et la partie publique le partagent : un même canal ne s'ouvre qu'une fois par client.
let shared: Promise<Directory> | null = null

export class Directory {
  listings: Listing[] = []
  private listeners = new Set<(list: Listing[]) => void>()
  private users = 0
  private closing = 0
  private channel!: RealtimeChannel
  private synced!: Promise<void>

  static async open(): Promise<Directory> {
    shared ??= Directory.connect().catch((e) => {
      shared = null
      throw e
    })
    const directory = await shared
    directory.users++
    clearTimeout(directory.closing)
    return directory
  }

  private static async connect(): Promise<Directory> {
    const directory = new Directory()
    const sb = await realtime()
    let ready = () => {}
    directory.synced = new Promise((resolve) => (ready = resolve))
    directory.channel = sb.channel('frontieres:annuaire', { config: { presence: { key: crypto.randomUUID() } } })
    directory.channel.on('presence', { event: 'sync' }, () => {
      directory.listings = Object.values(directory.channel.presenceState<Listing>())
        .map((list) => list[0])
        .filter((l) => l.code)
        .sort(ranked)
      for (const listener of directory.listeners) listener(directory.listings)
      ready()
    })
    await new Promise<void>((resolve, reject) =>
      directory.channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status))
      }),
    )
    return directory
  }

  // la liste telle qu'au premier passage du canal, ou vide s'il tarde
  ready() {
    return Promise.race([this.synced, new Promise<void>((resolve) => setTimeout(resolve, 4000))])
  }

  watch(listener: (list: Listing[]) => void) {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  announce(listing: Listing | null) {
    void (listing ? this.channel.track(listing) : this.channel.untrack())
  }

  // Le canal se ferme un peu après son dernier utilisateur : passer de l'accueil à la partie le garde ouvert.
  release() {
    if (--this.users > 0) return
    this.closing = window.setTimeout(() => {
      if (this.users > 0) return
      shared = null
      this.channel.untrack()
      this.channel.unsubscribe()
    }, 3000)
  }
}
