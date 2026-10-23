// Les sons d'OpenFront (© OpenFront and Contributors, CC BY-SA 4.0, voir sounds/LICENSE.md), joués comme dans le
// jeu d'origine : chacun sur sa voie (effets, alertes, interface, ambiance), dont le joueur règle le volume.
import { feedbackSettings } from '../../lib/feedback'
import { load, save } from '../../lib/util'
import type { EventType, Unit } from './engine'
import type { NukeType, UnitType } from './rules'

const FILES = import.meta.glob<string>('./sounds/*.mp3', { eager: true, query: '?url', import: 'default' })
const LOOPS = import.meta.glob<string>('./sounds/ambience/*.mp3', { eager: true, query: '?url', import: 'default' })

export type Channel = 'effets' | 'alertes' | 'interface' | 'ambiance'

// chaque son a sa voie, comme sur OpenFront ; `message` reprend le morse de la demande d'alliance
const CUES = {
  click: 'interface',
  slider: 'interface',
  'nuke-warning': 'alertes',
  'alliance-suggested': 'alertes',
  'alliance-accepted': 'alertes',
  'alliance-declined': 'alertes',
  'alliance-broken': 'alertes',
  message: 'alertes',
  'atom-launch': 'effets',
  'atom-hit': 'effets',
  'hydrogen-launch': 'effets',
  'hydrogen-hit': 'effets',
  'mirv-launch': 'effets',
  'ka-ching': 'effets',
  conquered: 'effets',
  'build-city': 'effets',
  'build-port': 'effets',
  'build-defense-post': 'effets',
  'build-warship': 'effets',
  'build-factory': 'effets',
  'build-train-station': 'effets',
  'sam-built': 'effets',
  'silo-built': 'effets',
  'sam-shoot': 'effets',
  'sam-hit': 'effets',
  'warship-lost': 'effets',
  'transport-ship': 'effets',
  spawn: 'effets',
  'game-start': 'effets',
  victory: 'effets',
  defeat: 'effets',
} as const satisfies Record<string, Exclude<Channel, 'ambiance'>>

export type Cue = keyof typeof CUES

const fileOf = (cue: Cue) => FILES[`./sounds/${cue === 'message' ? 'alliance-suggested' : cue}.mp3`]

export type Track = 'city' | 'factory' | 'missile-silo' | 'sam-silo'

const TRACKS: Partial<Record<UnitType, Track>> = { ville: 'city', usine: 'factory', silo: 'missile-silo', dca: 'sam-silo' }

const BUILT: Partial<Record<UnitType, Cue>> = {
  ville: 'build-city',
  port: 'build-port',
  poste: 'build-defense-post',
  silo: 'silo-built',
  dca: 'sam-built',
  usine: 'build-factory',
  navire: 'build-warship',
}

const LAUNCHED: Record<NukeType, Cue> = { bombe: 'atom-launch', hbombe: 'hydrogen-launch', mirv: 'mirv-launch' }

// --- ce que la partie fait entendre ---

// L'état d'avant un tour, et ce que le tour a envoyé : la partie et son instantané conviennent tels quels.
export interface Before {
  units: Pick<Unit, 'id' | 'type' | 'owner'>[]
  nukes: { id: number }[]
  missiles: { id: number }[]
  boats: { id: number }[]
  rails: { a: number; b: number }[]
  players: { id: number; kind: 'human' | 'nation' | 'bot' }[]
}

export interface After {
  tick: number
  units: Pick<Unit, 'id' | 'type' | 'owner'>[]
  nukes: { id: number; type: NukeType | 'ogive' }[]
  missiles: { id: number; owner: number }[]
  boats: { id: number; owner: number; trade: boolean }[]
  rails?: { a: number; b: number }[]
  blasts: { radius: number; tick: number }[]
  events: { type: EventType; from: number; to: number }[]
}

// Les sons d'un tour, d'après ce qui a changé : les bâtiments et bateaux du joueur, toutes les bombes,
// la diplomatie et les menaces qui le concernent.
export function cuesOf(before: Before, after: After, me: number): Cue[] {
  const cues: Cue[] = []
  const had = new Set(before.units.map((u) => u.id))
  const has = new Set(after.units.map((u) => u.id))
  for (const u of after.units) if (!had.has(u.id) && u.owner === me && BUILT[u.type]) cues.push(BUILT[u.type]!)
  for (const u of before.units) if (!has.has(u.id) && u.owner === me && u.type === 'navire') cues.push('warship-lost')
  const flying = new Set(before.nukes.map((n) => n.id))
  for (const n of after.nukes) if (!flying.has(n.id) && n.type !== 'ogive') cues.push(LAUNCHED[n.type])
  for (const b of after.blasts) if (b.tick === after.tick) cues.push(b.radius >= 80 ? 'hydrogen-hit' : b.radius > 4 ? 'atom-hit' : 'sam-hit')
  const fired = new Set(before.missiles.map((m) => m.id))
  if (after.missiles.some((m) => !fired.has(m.id) && m.owner === me)) cues.push('sam-shoot')
  const sailing = new Set(before.boats.map((b) => b.id))
  if (after.boats.some((b) => !sailing.has(b.id) && b.owner === me && !b.trade)) cues.push('transport-ship')
  if (after.rails) {
    const mine = new Set(after.units.filter((u) => u.owner === me).map((u) => u.id))
    const old = new Set(before.rails.map((r) => `${r.a}-${r.b}`))
    if (after.rails.some((r) => !old.has(`${r.a}-${r.b}`) && (mine.has(r.a) || mine.has(r.b)))) cues.push('build-train-station')
  }
  for (const e of after.events) {
    const toMe = e.to === me && e.from !== me
    if (e.type === 'request' && toMe) cues.push('alliance-suggested')
    else if (e.type === 'accepted' && (e.to === me || e.from === me)) cues.push('alliance-accepted')
    else if (e.type === 'refused' && toMe) cues.push('alliance-declined')
    else if ((e.type === 'betrayed' || e.type === 'expired') && (e.to === me || e.from === me)) cues.push('alliance-broken')
    else if (e.type === 'nuke' && toMe) cues.push('nuke-warning')
    else if (e.type === 'emoji' && toMe) cues.push('message')
    else if (e.type === 'eliminated' && e.from === me) cues.push(before.players.find((p) => p.id === e.to)?.kind === 'human' ? 'conquered' : 'ka-ching')
  }
  return cues
}

// L'ambiance d'un bâtiment, quand on zoome assez pour qu'il remplisse l'écran : le plus proche du centre l'emporte,
// à moins de vingt cases. `scale` : pixels par case.
export function ambienceAt(units: Pick<Unit, 'type' | 'tile'>[], w: number, x: number, y: number): Track | null {
  let best: Track | null = null
  let dist = 20 * 20
  for (const u of units) {
    const track = TRACKS[u.type]
    if (!track) continue
    const d = ((u.tile % w) - x) ** 2 + (Math.floor(u.tile / w) - y) ** 2
    if (d <= dist) {
      dist = d
      best = track
    }
  }
  return best
}

// Le volume de l'ambiance selon le zoom : rien sous 8 pixels par case, puis jusqu'à 0,3 au zoom le plus fort,
// vingt décibels sous les effets comme le veut OpenFront.
export const ambienceGain = (scale: number, max: number) => 0.3 * Math.max(0, Math.min(1, (scale - 8) / Math.max(1, max - 8)))

// --- volumes ---

export interface Volumes {
  general: number
  effets: number
  alertes: number
  interface: number
  ambiance: number
}

// les réglages d'origine d'OpenFront
export const DEFAULT_VOLUMES: Volumes = { general: 0.9, effets: 0.7, alertes: 0.8, interface: 0.5, ambiance: 0.4 }

let volumes: Volumes = { ...DEFAULT_VOLUMES, ...load<Partial<Volumes>>('openfront-volumes', {}) }

export const loadVolumes = () => volumes

export function setVolumes(next: Volumes) {
  volumes = next
  save('openfront-volumes', next)
  if (loop) loop.amp.gain.setTargetAtTime(loop.level * gainOf('ambiance'), loop.amp.context.currentTime, 0.05)
}

// un curseur est linéaire, l'oreille ne l'est pas : le carré donne une pente qui s'entend
const gainOf = (channel: Channel) => (feedbackSettings().sound ? volumes.general ** 2 * volumes[channel] ** 2 : 0)

// --- lecture ---

let context: AudioContext | null = null
let out: AudioNode | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()
const lastPlayed = new Map<Cue, number>()

// un même son ne repart pas avant ce délai : une salve de MIRV ou trois alertes d'un coup restent lisibles
const GAP_MS: Partial<Record<Cue, number>> = { 'atom-hit': 500, 'sam-hit': 300, 'sam-shoot': 300, 'nuke-warning': 1000, 'build-train-station': 1000 }

function audio(): AudioContext | null {
  if (context) return context
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  context = new AC()
  // un limiteur garde les sons empilés (une pluie de bombes) sous la saturation
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.003
  limiter.release.value = 0.1
  limiter.connect(context.destination)
  out = limiter
  return context
}

function bufferOf(ctx: AudioContext, url: string) {
  let pending = buffers.get(url)
  if (!pending) {
    pending = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null)
    buffers.set(url, pending)
  }
  return pending
}

export function play(cue: Cue) {
  const gain = gainOf(CUES[cue])
  if (!gain) return
  const now = performance.now()
  if (now - (lastPlayed.get(cue) ?? -Infinity) < (GAP_MS[cue] ?? 80)) return
  lastPlayed.set(cue, now)
  const ctx = audio()
  if (!ctx) return
  // un navigateur garde le son suspendu tant que la page n'a pas reçu de geste
  if (ctx.state === 'suspended') void ctx.resume()
  void bufferOf(ctx, fileOf(cue)).then((buffer) => {
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const amp = ctx.createGain()
    amp.gain.value = gain
    source.connect(amp).connect(out!)
    source.start()
  })
}

// la boucle d'ambiance en cours, et le volume que le zoom lui donne
let loop: { track: Track; source: AudioBufferSourceNode | null; amp: GainNode; level: number } | null = null

// Fait jouer l'ambiance d'un bâtiment (ou aucune), en fondu : appelée à chaque image, elle ne change que l'utile.
export function ambience(track: Track | null, level: number) {
  if (loop && loop.track === track) {
    if (Math.abs(loop.level - level) < 0.01) return
    loop.level = level
    loop.amp.gain.setTargetAtTime(level * gainOf('ambiance'), loop.amp.context.currentTime, 0.1)
    return
  }
  if (loop) {
    const { source, amp } = loop
    amp.gain.setTargetAtTime(0, amp.context.currentTime, 0.15)
    source?.stop(amp.context.currentTime + 1)
    loop = null
  }
  if (!track || !level || !gainOf('ambiance')) return
  const ctx = audio()
  if (!ctx) return
  const amp = ctx.createGain()
  amp.gain.value = 0
  amp.connect(out!)
  const current = { track, source: null as AudioBufferSourceNode | null, amp, level }
  loop = current
  void bufferOf(ctx, LOOPS[`./sounds/ambience/${track}.mp3`]).then((buffer) => {
    if (!buffer || loop !== current) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(amp)
    source.start()
    current.source = source
    amp.gain.setTargetAtTime(current.level * gainOf('ambiance'), ctx.currentTime, 0.2)
  })
}
