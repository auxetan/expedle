// La logique du bandeau de jeu : le combo en cours, l'humeur de Pépite et le mot qu'elle dit aux paliers.
import type { Mood } from '../ui/Mascot'
import { runOf } from './feedback'
import { msg } from './i18n'

// une case du bandeau : juste, ratée, presque (une manche notée moyenne), ou pas encore jouée
export type Step = boolean | 'presque' | null

// une manche notée sur 100 : juste à partir de 80, ratée sous 40, presque entre les deux
export const roundStep = (score: number): Step => (score >= 80 ? true : score < 40 ? false : 'presque')

const PALIERS: Record<number, string> = { 3: msg('Ça chauffe'), 5: msg('Inarrêtable'), 8: msg('Légendaire') }
const OUPS = msg('Oups')

export interface HudState {
  combo: number
  mood: Mood
  // le mot du palier tout juste atteint, ou du beau combo tout juste cassé
  word: string | null
}

export function hudState(steps: Step[]): HudState {
  const played = steps.filter((s) => s !== null).map((s) => s === true)
  const last = steps.filter((s) => s !== null).at(-1)
  const combo = runOf(played)
  const before = runOf(played.slice(0, -1))
  const word = last === true ? (PALIERS[combo] ?? null) : last === false && before >= 3 ? OUPS : null
  const mood: Mood = last === undefined ? 'calme' : last === true ? 'joie' : last === false ? 'rate' : 'surprise'
  return { combo, mood, word }
}
