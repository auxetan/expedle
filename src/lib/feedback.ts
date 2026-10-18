import { load, save } from './util'

// Sons et vibrations des jeux. Les sons sont synthétisés à la volée (Web Audio) : aucun fichier à charger.
export type Cue = 'good' | 'bad' | 'tap' | 'win' | 'lose' | 'page'

export interface FeedbackSettings {
  sound: boolean
  haptics: boolean
}

export const feedbackSettings = (): FeedbackSettings => load<FeedbackSettings>('feedback', { sound: true, haptics: true })
export const saveFeedbackSettings = (s: FeedbackSettings) => save('feedback', s)

// notes (Hz), durée de chacune (s), forme d'onde
const SOUNDS: Record<Exclude<Cue, 'page'>, { notes: number[]; step: number; wave: OscillatorType; gain: number }> = {
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

function play(cue: Cue) {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  audio ??= new AC()
  // un navigateur garde le son suspendu tant que la page n'a pas reçu de geste
  if (audio.state === 'suspended') void audio.resume()
  if (cue === 'page') return rustle(audio)
  const { notes, step, wave, gain } = SOUNDS[cue]
  const t0 = audio.currentTime
  notes.forEach((freq, i) => {
    const osc = audio!.createOscillator()
    const amp = audio!.createGain()
    osc.type = wave
    osc.frequency.value = freq
    const start = t0 + i * step
    amp.gain.setValueAtTime(0, start)
    amp.gain.linearRampToValueAtTime(gain, start + 0.01)
    amp.gain.exponentialRampToValueAtTime(0.0001, start + step * 2.2)
    osc.connect(amp).connect(audio!.destination)
    osc.start(start)
    osc.stop(start + step * 2.4)
  })
}

export function feedback(cue: Cue): void {
  if (typeof window === 'undefined') return
  const settings = feedbackSettings()
  try {
    if (settings.sound) play(cue)
  } catch {
    // pas de son possible ici : le jeu continue en silence
  }
  if (settings.haptics) navigator.vibrate?.(VIBRATIONS[cue])
}
