// Le salon d'un duel en direct, sur le canal temps réel du site comme ceux de Frontières. La presence dit qui est là,
// qui est prêt et quel jeu l'hôte a choisi ; les messages portent le départ, la progression et l'arrivée de chacun.
// Un seul duel à la fois, partagé par la page du salon et le calque posé sur le jeu.
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useSyncExternalStore } from 'react'
import { realtime } from './cloud'
import { beaten, decide, duelGame, duelSeed, pairCode, pairGame, pairOf, type Finish, type Outcome, type Progress, type Waiting } from './duel'
import { PLAYED, recordPlay, type Play } from './stats'

export const COUNTDOWN_MS = 3000
// le temps laissé à un adversaire disparu pour revenir, avant de le dire parti
const GONE_MS = 5000
// le temps laissé à un salon rejoint par son code pour montrer quelqu'un
export const FIND_MS = 6000
// depuis la file d'attente, le temps laissé à l'adversaire trouvé pour arriver dans le salon
const MATCH_MS = 8000

export interface Player {
  key: string
  user: string
  name: string
  avatar: string
  // l'heure d'arrivée : le premier arrivé est l'hôte
  joined: number
  ready: boolean
  // le jeu choisi, annoncé par l'hôte
  game: string | null
}

export interface Round {
  n: number
  game: string
  seed: string
}

// la page du jeu d'une manche : la graine du duel, et le code du salon pour que le calque s'y pose
export const gameHash = (code: string, round: Round) => `#${duelGame(round.game)!.path}?${new URLSearchParams({ defi: round.seed, duel: code })}`

export type Phase = 'connexion' | 'salon' | 'depart' | 'partie' | 'fin' | 'complet' | 'introuvable' | 'reseau'

export interface DuelState {
  code: string
  phase: Phase
  me: Player
  // l'adversaire, gardé quand il vient de partir pour pouvoir le nommer
  them: Player | null
  host: boolean
  game: string | null
  round: Round | null
  // sur l'horloge de ce joueur : le début du compte à rebours, puis le « Partez »
  departAt: number
  goAt: number
  mine: Finish | null
  theirs: Finish | null
  myProgress: Progress | null
  progress: Progress | null
  outcome: Outcome | null
  gone: boolean
  rematch: { me: boolean; them: boolean }
  // trouvé par la file d'attente : s'il n'aboutit pas, on y retourne
  fromQueue: boolean
}

// Ce que le duel attend du canal : être présent, voir qui l'est, envoyer et recevoir. Supabase Realtime sur le site,
// une version en mémoire dans les tests.
export interface Wire {
  open<T extends object>(topic: string, key: string, me: T, on: Handlers<T>): Promise<Line<T>>
}

export interface Handlers<T> {
  presence: (list: T[]) => void
  message: (event: string, payload: unknown) => void
  lost: () => void
}

export interface Line<T> {
  send(event: string, payload: unknown): void
  track(me: T): void
  close(): void
}

export const supabaseWire: Wire = {
  async open(topic, key, me, on) {
    const sb = await realtime()
    const ch: RealtimeChannel = sb.channel(topic, { config: { broadcast: { self: false }, presence: { key } } })
    let joined = false
    ch.on('presence', { event: 'sync' }, () => on.presence(Object.values(ch.presenceState()).map((list) => list[0] as unknown as typeof me)))
    ch.on('broadcast', { event: '*' }, ({ event, payload }) => on.message(event, payload))
    await new Promise<void>((resolve, reject) =>
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED')
          ch.track(me).then(() => {
            joined = true
            resolve()
          }, reject)
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (joined) on.lost()
          else reject(new Error(status))
        }
      }),
    )
    return {
      send: (event, payload) => void ch.send({ type: 'broadcast', event, payload }),
      track: (next) => void ch.track(next),
      close: () => void sb.removeChannel(ch),
    }
  },
}

type Timer = ReturnType<typeof setTimeout>

export class Duel {
  state: DuelState
  onChange = () => {}
  // une manche jouée jusqu'au bout, à inscrire une fois dans l'historique
  onEnd: (outcome: Outcome, mine: Finish | null) => void = () => {}
  private wire: Wire
  private find: number
  private line: Line<Player> | null = null
  private starting = false
  private countdown: Timer | undefined
  private watch: ReturnType<typeof setInterval> | undefined
  private goneTimer: Timer | undefined
  private findTimer: Timer | undefined

  // `find` : rejoint par un code ou par la file, le salon doit montrer quelqu'un dans ce délai
  constructor(code: string, me: Player, wire: Wire, find = 0, fromQueue = false) {
    this.wire = wire
    this.find = find
    this.state = {
      code,
      phase: 'connexion',
      me,
      them: null,
      host: true,
      game: me.game,
      round: null,
      departAt: 0,
      goAt: 0,
      mine: null,
      theirs: null,
      myProgress: null,
      progress: null,
      outcome: null,
      gone: false,
      rematch: { me: false, them: false },
      fromQueue,
    }
  }

  private set(patch: Partial<DuelState>) {
    this.state = { ...this.state, ...patch }
    this.onChange()
  }

  async open() {
    try {
      this.line = await this.wire.open(`duel:${this.state.code}`, this.state.me.key, this.state.me, {
        presence: (list) => this.sync(list),
        message: (event, payload) => this.receive(event, payload as { n?: number }),
        lost: () => this.set({ phase: 'reseau' }),
      })
    } catch {
      return this.set({ phase: 'reseau' })
    }
    if (this.find) this.findTimer = setTimeout(() => !this.state.them && this.stop('introuvable'), this.find)
  }

  close() {
    clearTimeout(this.countdown)
    clearInterval(this.watch)
    clearTimeout(this.goneTimer)
    clearTimeout(this.findTimer)
    this.line?.close()
    this.line = null
  }

  private stop(phase: 'complet' | 'introuvable') {
    this.close()
    this.set({ phase })
  }

  private sync(list: Player[]) {
    if (!this.line && this.state.phase !== 'connexion') return
    const players = [...list].sort((a, b) => a.joined - b.joined || a.key.localeCompare(b.key))
    const at = players.findIndex((p) => p.key === this.state.me.key)
    if (at === -1) return
    if (at >= 2) return this.stop('complet')
    const them = players[1 - at] ?? null
    const host = at === 0
    if (them) {
      clearTimeout(this.goneTimer)
      this.goneTimer = undefined
    } else if (this.state.them && !this.goneTimer && !this.state.gone) this.goneTimer = setTimeout(() => this.lost(), GONE_MS)
    this.set({
      them: them ?? this.state.them,
      gone: them ? false : this.state.gone,
      host,
      game: host ? this.state.me.game : (them?.game ?? null),
      phase: this.state.phase === 'connexion' ? 'salon' : this.state.phase,
    })
    this.maybeStart()
  }

  // l'adversaire n'est pas revenu : au salon on l'oublie, en partie il a quitté le duel
  private lost() {
    this.goneTimer = undefined
    if (this.state.phase === 'salon') return this.set({ them: null })
    this.set({ gone: true })
    this.settle()
  }

  private receive(event: string, msg: { n?: number }) {
    if (event === 'start') return this.begin(msg as Round)
    if (msg.n !== this.state.round?.n) return
    if (event === 'progress') this.set({ progress: (msg as { p: Progress }).p })
    else if (event === 'finish') {
      this.set({ theirs: (msg as { f: Finish }).f })
      this.settle()
    } else if (event === 'rematch') {
      this.set({ rematch: { ...this.state.rematch, them: true } })
      this.maybeRematch()
    } else if (event === 'salon') this.toRoom()
  }

  chooseGame(game: string) {
    if (!this.state.host) return
    this.track({ ...this.state.me, game })
    this.set({ game })
  }

  setReady(ready: boolean) {
    this.track({ ...this.state.me, ready })
    this.maybeStart()
  }

  private track(me: Player) {
    this.set({ me })
    this.line?.track(me)
  }

  private maybeStart() {
    const { host, phase, me, them, game, gone } = this.state
    if (host && phase === 'salon' && me.ready && them?.ready && !gone && duelGame(game)) void this.start(game!)
  }

  // L'hôte lance une manche : la graine part chez l'adversaire, et les deux comptes à rebours démarrent.
  private async start(game: string) {
    if (this.starting) return
    this.starting = true
    const round: Round = { n: (this.state.round?.n ?? 0) + 1, game, seed: await duelSeed(duelGame(game)!) }
    this.starting = false
    this.line?.send('start', round)
    this.begin(round)
  }

  private begin(round: Round) {
    if (this.state.round && round.n <= this.state.round.n) return
    clearTimeout(this.countdown)
    clearInterval(this.watch)
    const now = Date.now()
    this.track({ ...this.state.me, ready: false })
    this.set({ round, phase: 'depart', departAt: now, goAt: now + COUNTDOWN_MS, mine: null, theirs: null, myProgress: null, progress: null, outcome: null, rematch: { me: false, them: false } })
    this.countdown = setTimeout(() => {
      this.set({ phase: 'partie', goAt: Date.now() })
      this.watch = setInterval(() => this.tick(), 250)
    }, COUNTDOWN_MS)
  }

  // en course, une fois dépassé le temps de l'adversaire qui a réussi, on ne peut plus gagner : on le dit
  private tick() {
    const { phase, mine, theirs, round, goAt } = this.state
    const elapsed = Date.now() - goAt
    if (phase === 'partie' && round && !mine && beaten(duelGame(round.game)!.rule, theirs, elapsed)) this.finish({ ms: elapsed, pts: 0, win: false, out: 'battu' })
  }

  // une partie terminée sur ce poste : si c'est celle du duel, c'est notre arrivée
  played(play: Play) {
    const { phase, round, mine, goAt } = this.state
    if (phase === 'partie' && round && !mine && play.g === round.game) this.finish({ ms: Date.now() - goAt, pts: play.pts, win: play.win })
  }

  giveUp() {
    const { phase, mine, goAt } = this.state
    if (phase === 'partie' && !mine) this.finish({ ms: Date.now() - goAt, pts: 0, win: false, out: 'abandon' })
  }

  progress(p: Progress) {
    const { phase, mine, round, myProgress } = this.state
    if ((phase !== 'depart' && phase !== 'partie') || mine || !round || (myProgress?.left === p.left && myProgress.unit === p.unit)) return
    this.set({ myProgress: p })
    this.line?.send('progress', { n: round.n, p })
  }

  private finish(f: Finish) {
    this.set({ mine: f })
    this.line?.send('finish', { n: this.state.round!.n, f })
    this.settle()
  }

  // L'issue, dès qu'on peut la trancher : les deux arrivées, son propre abandon, ou l'adversaire parti avant d'arriver.
  private settle() {
    const { phase, round, mine, theirs, gone } = this.state
    if (phase !== 'partie' || !round) return
    const outcome = mine && theirs ? decide(duelGame(round.game)!.rule, mine, theirs) : mine?.out ? 'perdu' : mine && gone ? 'gagné' : null
    if (!outcome) return
    clearInterval(this.watch)
    this.set({ outcome, phase: 'fin' })
    this.onEnd(outcome, mine)
  }

  rematch() {
    const { phase, round, rematch } = this.state
    if (phase !== 'fin' || rematch.me || !round) return
    this.set({ rematch: { ...rematch, me: true } })
    this.line?.send('rematch', { n: round.n })
    this.maybeRematch()
  }

  private maybeRematch() {
    const { host, phase, round, rematch, gone } = this.state
    if (host && phase === 'fin' && round && rematch.me && rematch.them && !gone) void this.start(round.game)
  }

  backToRoom() {
    this.line?.send('salon', { n: this.state.round?.n })
    this.toRoom()
  }

  private toRoom() {
    clearTimeout(this.countdown)
    clearInterval(this.watch)
    this.track({ ...this.state.me, ready: false })
    this.set({ phase: 'salon', outcome: null, rematch: { me: false, them: false } })
  }
}

/* Le duel en cours, partagé par toutes les pages */

let current: Duel | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((f) => f())
const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => listeners.delete(f)
}

export const useDuel = (): DuelState | null => useSyncExternalStore(subscribe, () => current?.state ?? null)
export const duel = () => current

export interface Who {
  user: string
  name: string
  avatar: string
}

export async function openDuel(code: string, who: Who, opts: { game?: string | null; joined?: number; ready?: boolean; find?: number; fromQueue?: boolean } = {}) {
  if (current?.state.code === code) return
  leaveDuel()
  const me: Player = { key: crypto.randomUUID(), ...who, joined: opts.joined ?? Date.now(), ready: !!opts.ready, game: opts.game ?? null }
  const d = new Duel(code, me, supabaseWire, opts.find ?? 0, !!opts.fromQueue)
  d.onChange = emit
  // une victoire en duel se fête et rapporte comme une partie gagnée ; 90 et non 100, pour ne pas la dire parfaite
  d.onEnd = (outcome, mine) => {
    const won = outcome === 'gagné'
    const tie = outcome === 'égalité'
    recordPlay('duel', { pts: won ? 90 : tie ? 50 : 0, s: won ? 1 : tie ? 0.5 : 0, win: tie ? undefined : won, ms: mine?.ms, sub: 'duel' })
  }
  current = d
  emit()
  await d.open()
}

export function leaveDuel() {
  current?.close()
  current = null
  emit()
}

// la partie du jeu joué en duel : son moment de victoire laisse la place à celui du duel
export const isDuelPlay = (play: Play) => play.sub === 'defi' && !!current?.state.round && current.state.round.game === play.g

// ce qu'il reste à faire au joueur, pour la barre de course de l'adversaire ; null hors duel
export function useDuelProgress(p: Progress | null) {
  const left = p?.left
  const unit = p?.unit
  useEffect(() => {
    if (left !== undefined && unit) current?.progress({ left, unit })
  }, [left, unit])
}

globalThis.addEventListener?.(PLAYED, (e) => current?.played((e as CustomEvent<Play>).detail))

/* La file d'attente des duels au hasard */

export interface QueueState {
  count: number
  game: string | null
}

let queue: { state: QueueState; line: Line<Waiting> | null; done: boolean } | null = null
// le jeu voulu à la dernière entrée dans la file, pour y revenir quand l'adversaire trouvé ne vient pas
let wanted: string | null = null
export const queuedGame = () => wanted
const queueListeners = new Set<() => void>()
const emitQueue = () => queueListeners.forEach((f) => f())

export const useQueue = (): QueueState | null =>
  useSyncExternalStore(
    (f) => {
      queueListeners.add(f)
      return () => queueListeners.delete(f)
    },
    () => queue?.state ?? null,
  )

// Chacun annonce sa présence et le jeu voulu ; dès qu'une paire se forme, les deux calculent le même salon et s'y
// retrouvent, prêts à partir.
export async function joinQueue(who: Who, game: string | null) {
  leaveQueue()
  wanted = game
  const me: Waiting = { key: crypto.randomUUID(), user: who.user, game, joined: Date.now() }
  const entry: NonNullable<typeof queue> = { state: { count: 1, game }, line: null, done: false }
  queue = entry
  emitQueue()
  const matched = (list: Waiting[]) => {
    if (entry.done) return
    entry.state = { count: list.length, game }
    emitQueue()
    const pair = pairOf(list, me.key)
    if (!pair) return
    const [host, guest] = pair
    const code = pairCode(host.key, guest.key)
    leaveQueue()
    void openDuel(code, who, { joined: me.key === host.key ? host.joined : guest.joined, game: me.key === host.key ? pairGame(host, guest, code) : null, ready: true, find: MATCH_MS, fromQueue: true })
  }
  try {
    entry.line = await supabaseWire.open('duel:file', me.key, me, { presence: matched, message: () => {}, lost: leaveQueue })
  } catch {
    if (queue === entry) leaveQueue()
    return
  }
  if (entry.done) entry.line.close()
}

export function leaveQueue() {
  if (!queue) return
  queue.done = true
  queue.line?.close()
  queue = null
  emitQueue()
}
