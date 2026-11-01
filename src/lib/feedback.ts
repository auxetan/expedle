import { load, save } from './util'

// Sons et vibrations des jeux. Les sons sont synthétisés à la volée (Web Audio) : aucun fichier à charger.
export type Cue = 'good' | 'bad' | 'tap' | 'win' | 'lose' | 'page' | 'stamp'

export interface FeedbackSettings {
  sound: boolean
  haptics: boolean
}

export const feedbackSettings = (): FeedbackSettings => load<FeedbackSettings>('feedback', { sound: true, haptics: true })
export const saveFeedbackSettings = (s: FeedbackSettings) => save('feedback', s)

// notes (Hz), durée de chacune (s), forme d'onde
const SOUNDS: Record<Exclude<Cue, 'page' | 'stamp'>, { notes: number[]; step: number; wave: OscillatorType; gain: number }> = {
  good: { notes: [660, 990], step: 0.07, wave: 'sine', gain: 0.07 },
  bad: { notes: [220, 165], step: 0.09, wave: 'triangle', gain: 0.07 },
  tap: { notes: [880], step: 0.03, wave: 'sine', gain: 0.035 },
  win: { notes: [523, 659, 784, 1047], step: 0.09, wave: 'triangle', gain: 0.06 },
  lose: { notes: [392, 330, 262], step: 0.12, wave: 'sine', gain: 0.05 },
}

const VIBRATIONS: Record<Cue, number[]> = {
  good: [12],
  bad: [30, 40, 30],
  tap: [6],
  win: [20, 50, 20, 50, 40],
  lose: [60],
  page: [5],
  stamp: [22],
}

let audio: AudioContext | null = null

// Une page qu'on tourne : un souffle de bruit filtré, qui monte puis retombe.
function rustle(ctx: AudioContext) {
  const length = Math.round(ctx.sampleRate * 0.28)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / length) ** 2
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2400
  band.Q.value = 0.7
  const amp = ctx.createGain()
  amp.gain.value = 0.12
  source.connect(band).connect(amp).connect(ctx.destination)
  source.start()
}

// Un coup de tampon : un choc sourd qui tombe d'une octave, et le claquement sec du papier.
function thump(ctx: AudioContext) {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.frequency.setValueAtTime(150, t0)
  osc.frequency.exponentialRampToValueAtTime(50, t0 + 0.12)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(0.3, t0 + 0.006)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24)
  osc.connect(amp).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + 0.26)
  const length = Math.round(ctx.sampleRate * 0.07)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const high = ctx.createBiquadFilter()
  high.type = 'highpass'
  high.frequency.value = 1800
  const gain = ctx.createGain()
  gain.gain.value = 0.16
  source.connect(high).connect(gain).connect(ctx.destination)
  source.start(t0)
}

function context(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  audio ??= new AC()
  // un navigateur garde le son suspendu tant que la page n'a pas reçu de geste
  if (audio.state === 'suspended') void audio.resume()
  return audio
}

// gamme pentatonique, en demi-tons
const PENTATONIC = [0, 2, 4, 7, 9]

// un cran de la gamme par niveau, jusqu'à l'octave
const lift = (level: number) => {
  const s = Math.max(0, Math.min(level, 5))
  return 2 ** ((12 * Math.floor(s / 5) + PENTATONIC[s % 5]) / 12)
}

function play(cue: Cue, level: number) {
  const ctx = context()
  if (!ctx) return
  if (cue === 'page') return rustle(ctx)
  if (cue === 'stamp') return thump(ctx)
  const { notes, step, wave, gain } = SOUNDS[cue]
  const pitch = cue === 'good' || cue === 'tap' ? lift(level) : 1
  const t0 = ctx.currentTime
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = wave
    osc.frequency.value = freq * pitch
    const start = t0 + i * step
    amp.gain.setValueAtTime(0, start)
    amp.gain.linearRampToValueAtTime(gain, start + 0.01)
    amp.gain.exponentialRampToValueAtTime(0.0001, start + step * 2.2)
    osc.connect(amp).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + step * 2.4)
  })
}

// Une pépite qui tombe dans le solde : une note de cloche (un partiel inharmonique lui donne son timbre de métal),
// un cran plus aiguë à chaque pépite, et la dernière qui résonne.
export function coin(i: number, last = false): void {
  if (typeof window === 'undefined') return
  const settings = feedbackSettings()
  if (settings.haptics) navigator.vibrate?.(last ? [14] : [4])
  if (!settings.sound) return
  try {
    const ctx = context()
    if (!ctx) return
    const step = Math.min(i, 9)
    const freq = 880 * 2 ** ((12 * Math.floor(step / 5) + PENTATONIC[step % 5]) / 12)
    const t0 = ctx.currentTime
    const decay = last ? 0.9 : 0.25
    for (const [ratio, gain] of [
      [1, 0.045],
      [2.76, 0.012],
    ]) {
      const osc = ctx.createOscillator()
      const amp = ctx.createGain()
      osc.frequency.value = freq * ratio
      amp.gain.setValueAtTime(0, t0)
      amp.gain.linearRampToValueAtTime(gain, t0 + 0.004)
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
      osc.connect(amp).connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + decay + 0.05)
    }
  } catch {
    // pas de son possible ici : la pépite arrive en silence
  }
}

// les bonnes réponses d'affilée au bout d'une liste de résultats
export function runOf(oks: boolean[]): number {
  let n = 0
  while (n < oks.length && oks[oks.length - 1 - n]) n++
  return n
}

// `level` fait monter la note d'une bonne réponse ou d'un « tap » : les bonnes réponses d'affilée, ou la proximité
export function feedback(cue: Cue, level = 0): void {
  if (typeof window === 'undefined') return
  const settings = feedbackSettings()
  try {
    if (settings.sound) play(cue, level)
  } catch {
    // pas de son possible ici : le jeu continue en silence
  }
  if (settings.haptics) navigator.vibrate?.(VIBRATIONS[cue])
}

// Le son d'une manche notée de 0 à 100 : d'autant plus aigu que la réponse est juste.
export function feedbackScore(score: number): void {
  if (score >= 80) feedback('good', Math.round((score - 80) / 5))
  else feedback(score >= 40 ? 'tap' : 'bad')
}

// la vibration seule, pour un jeu qui joue ses propres sons
export function buzz(cue: Cue): void {
  if (typeof window !== 'undefined' && feedbackSettings().haptics) navigator.vibrate?.(VIBRATIONS[cue])
}
