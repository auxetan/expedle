import { ALL_GAMES } from '../ui/games'
import { summarize, type Play, type Summary } from './stats'
import { load, save, todayKey } from './util'

export type Tier = 'bronze' | 'argent' | 'or'

interface Context {
  plays: Play[]
  summary: Summary
}

export interface Achievement {
  id: string
  group: 'Parcours' | 'Géographie' | 'Magnitudle' | 'Culture générale'
  title: string
  desc: string
  glyph: string
  tier: Tier
  goal: number
  value: (c: Context) => number
}

export interface Progress extends Achievement {
  current: number
  unlocked: boolean
}

export const TIER_XP: Record<Tier, number> = { bronze: 50, argent: 150, or: 400 }

const count = (pred: (p: Play) => boolean) => (c: Context) => c.plays.filter(pred).length
const distinct = (pred: (p: Play) => boolean, key: (p: Play) => string | undefined) => (c: Context) =>
  new Set(c.plays.filter(pred).map(key).filter(Boolean)).size
const best = (pred: (p: Play) => boolean, of: (p: Play) => number) => (c: Context) => Math.max(0, ...c.plays.filter(pred).map(of))

const travle = (p: Play) => p.g.startsWith('itineraire')
const hourOf = (p: Play) => new Date(p.t).getHours()

// Les jeux du jour, tels qu'ils s'inscrivent dans l'historique ; entraînements, rejeux et archives n'en sont pas.
const DAILY_IDS = ALL_GAMES.filter((g) => g.rhythm === 'quotidien' && g.dailyId).map((g) => g.dailyId!)
const NOT_TODAY = new Set(['entrainement', 'libre', 'archive'])

function bestDailyDay(c: Context): number {
  const days = new Map<string, Set<string>>()
  for (const p of c.plays) {
    if (!DAILY_IDS.includes(p.g) || NOT_TODAY.has(p.sub ?? '')) continue
    const day = todayKey(new Date(p.t))
    days.set(day, (days.get(day) ?? new Set()).add(p.g))
  }
  return Math.max(0, ...[...days.values()].map((s) => s.size))
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'premiers-pas', group: 'Parcours', title: 'Premiers pas', desc: 'Terminer une première partie', glyph: '👣', tier: 'bronze', goal: 1, value: (c) => c.summary.total },
  { id: 'habitue', group: 'Parcours', title: 'Habitué', desc: 'Jouer 50 parties', glyph: '🎲', tier: 'bronze', goal: 50, value: (c) => c.summary.total },
  { id: 'passionne', group: 'Parcours', title: 'Passionné', desc: 'Jouer 250 parties', glyph: '🔥', tier: 'argent', goal: 250, value: (c) => c.summary.total },
  { id: 'accro', group: 'Parcours', title: 'Accro', desc: 'Jouer 1 000 parties', glyph: '💎', tier: 'or', goal: 1000, value: (c) => c.summary.total },
  { id: 'serie-3', group: 'Parcours', title: 'Trois jours de suite', desc: 'Jouer trois jours d’affilée', glyph: '📅', tier: 'bronze', goal: 3, value: (c) => c.summary.bestStreak },
  { id: 'serie-7', group: 'Parcours', title: 'Une semaine pleine', desc: 'Jouer sept jours d’affilée', glyph: '🗓️', tier: 'argent', goal: 7, value: (c) => c.summary.bestStreak },
  { id: 'serie-30', group: 'Parcours', title: 'Un mois sans faillir', desc: 'Jouer trente jours d’affilée', glyph: '🌙', tier: 'or', goal: 30, value: (c) => c.summary.bestStreak },
  { id: 'touche-a-tout', group: 'Parcours', title: 'Touche-à-tout', desc: 'Essayer dix jeux ou modes différents', glyph: '🧩', tier: 'bronze', goal: 10, value: distinct(() => true, (p) => p.g) },
  { id: 'encyclopediste', group: 'Parcours', title: 'Encyclopédiste', desc: 'Essayer vingt jeux ou modes différents', glyph: '📚', tier: 'argent', goal: 20, value: distinct(() => true, (p) => p.g) },
  { id: 'grand-chelem', group: 'Parcours', title: 'Grand chelem', desc: 'Finir tous les jeux du jour dans la même journée', glyph: '🏆', tier: 'or', goal: DAILY_IDS.length, value: bestDailyDay },
  { id: 'marathon', group: 'Parcours', title: 'Marathon', desc: 'Jouer vingt parties dans la même journée', glyph: '🏃', tier: 'argent', goal: 20, value: (c) => c.summary.bestDay?.n ?? 0 },
  { id: 'leve-tot', group: 'Parcours', title: 'Lève-tôt', desc: 'Jouer entre 5 h et 7 h du matin', glyph: '🌅', tier: 'bronze', goal: 1, value: count((p) => hourOf(p) >= 5 && hourOf(p) < 7) },
  { id: 'noctambule', group: 'Parcours', title: 'Noctambule', desc: 'Jouer entre minuit et 4 h', glyph: '🦉', tier: 'bronze', goal: 1, value: count((p) => hourOf(p) < 4) },
  { id: 'points-1k', group: 'Parcours', title: 'Mille points', desc: 'Cumuler 1 000 points', glyph: '⭐', tier: 'bronze', goal: 1000, value: (c) => c.summary.points },
  { id: 'points-10k', group: 'Parcours', title: 'Dix mille points', desc: 'Cumuler 10 000 points', glyph: '🌟', tier: 'argent', goal: 10000, value: (c) => c.summary.points },
  { id: 'points-50k', group: 'Parcours', title: 'Cinquante mille', desc: 'Cumuler 50 000 points', glyph: '✨', tier: 'or', goal: 50000, value: (c) => c.summary.points },

  { id: 'travle-1', group: 'Géographie', title: 'Premier voyage', desc: 'Gagner une partie de Travle', glyph: '🧭', tier: 'bronze', goal: 1, value: count((p) => travle(p) && p.win === true) },
  { id: 'travle-10', group: 'Géographie', title: 'Routard', desc: 'Gagner dix parties de Travle', glyph: '🎒', tier: 'argent', goal: 10, value: count((p) => travle(p) && p.win === true) },
  { id: 'travle-parfait', group: 'Géographie', title: 'Itinéraire parfait', desc: 'Gagner un Travle par le plus court chemin, sans indice', glyph: '🛣️', tier: 'argent', goal: 1, value: count((p) => travle(p) && p.pts === 100) },
  { id: 'worldle-1', group: 'Géographie', title: 'Coup d’œil', desc: 'Trouver le Worldle du premier coup', glyph: '👁️', tier: 'or', goal: 1, value: count((p) => p.g === 'worldle' && p.win === true && p.s === 1) },
  { id: 'worldle-10', group: 'Géographie', title: 'Silhouettes', desc: 'Gagner dix Worldle', glyph: '🗺️', tier: 'argent', goal: 10, value: count((p) => p.g === 'worldle' && p.win === true) },
  { id: 'globle-5', group: 'Géographie', title: 'Tête chercheuse', desc: 'Trouver le Globle en cinq essais ou moins', glyph: '🌡️', tier: 'argent', goal: 1, value: count((p) => p.g === 'globle' && p.win === true && (p.s ?? 99) <= 5) },
  { id: 'globle-10', group: 'Géographie', title: 'Globe-trotter', desc: 'Gagner dix Globle', glyph: '🌍', tier: 'argent', goal: 10, value: count((p) => p.g === 'globle' && p.win === true) },
  { id: 'geoguessr-10', group: 'Géographie', title: 'Arpenteur', desc: 'Jouer dix parties de GeoGuessr', glyph: '🚶', tier: 'bronze', goal: 10, value: count((p) => p.g === 'geoguessr') },
  { id: 'geoguessr-20k', group: 'Géographie', title: 'Œil de lynx', desc: 'Marquer 20 000 points sur une partie de GeoGuessr', glyph: '📍', tier: 'or', goal: 20000, value: best((p) => p.g === 'geoguessr', (p) => p.s ?? 0) },
  { id: 'photo-15k', group: 'Géographie', title: 'Photographe', desc: 'Marquer 15 000 points sur une partie de PhotoGuessr', glyph: '📷', tier: 'argent', goal: 15000, value: best((p) => p.g === 'photoguessr', (p) => p.s ?? 0) },
  { id: 'seterra-100', group: 'Géographie', title: 'Sans faute', desc: 'Réussir un quiz Seterra à 100 %', glyph: '🎯', tier: 'argent', goal: 1, value: count((p) => p.g === 'cartographe' && p.s === 100) },
  { id: 'seterra-10', group: 'Géographie', title: 'Cartographe', desc: 'Réussir dix quiz Seterra différents à 100 %', glyph: '📐', tier: 'or', goal: 10, value: distinct((p) => p.g === 'cartographe' && p.s === 100, (p) => p.sub) },
  { id: 'geohunter-parfait', group: 'Géographie', title: 'Chasseur d’élite', desc: 'Score parfait au défi du jour de GeoHunter', glyph: '🦅', tier: 'or', goal: 1, value: count((p) => p.g === 'classement-jour' && p.pts === 100) },

  { id: 'size-90', group: 'Magnitudle', title: 'Œil de mesureur', desc: 'Au moins 90 de moyenne sur une partie de Size It Up', glyph: '📏', tier: 'argent', goal: 1, value: count((p) => p.g.startsWith('echelle') && p.pts >= 90) },
  { id: 'weigh-90', group: 'Magnitudle', title: 'Équilibriste', desc: 'Au moins 90 % sur une partie de Weigh It Up', glyph: '⚖️', tier: 'argent', goal: 1, value: count((p) => p.g === 'balance' && p.pts >= 90) },
  { id: 'question-95', group: 'Magnitudle', title: 'Estimation chirurgicale', desc: 'Au moins 95 / 100 à la Daily Question', glyph: '🔬', tier: 'argent', goal: 1, value: count((p) => p.g === 'question' && (p.s ?? 0) >= 95) },
  { id: 'survie-20', group: 'Magnitudle', title: 'Survivant', desc: 'Tenir vingt questions en Survival Mode', glyph: '🛟', tier: 'or', goal: 20, value: best((p) => p.g === 'survie', (p) => p.s ?? 0) },

  { id: 'quiz-parfait', group: 'Culture générale', title: 'Dix sur dix', desc: 'Sans faute au Quiz du jour', glyph: '🧠', tier: 'argent', goal: 1, value: count((p) => p.g === 'quiz-jour' && p.pts === 100) },
  { id: 'quiz-25', group: 'Culture générale', title: 'Puits de science', desc: 'Jouer 25 parties de quiz', glyph: '📖', tier: 'bronze', goal: 25, value: count((p) => p.g.startsWith('quiz')) },
  { id: 'drapeaux-parfait', group: 'Culture générale', title: 'Porte-drapeau', desc: 'Sans faute au quiz des drapeaux', glyph: '🚩', tier: 'argent', goal: 1, value: count((p) => p.g === 'quiz-drapeaux' && p.pts === 100) },
  { id: 'capitales-parfait', group: 'Culture générale', title: 'Toutes les capitales', desc: 'Sans faute au quiz des capitales', glyph: '🏛️', tier: 'argent', goal: 1, value: count((p) => p.g === 'quiz-capitales' && p.pts === 100) },
  { id: 'jetpunk-100', group: 'Culture générale', title: 'Liste complète', desc: 'Remplir un quiz JetPunk à 100 %', glyph: '✅', tier: 'argent', goal: 1, value: count((p) => p.g === 'jetpunk' && p.s === 100) },
  { id: 'jetpunk-25', group: 'Culture générale', title: 'Collectionneur', desc: 'Jouer 25 quiz JetPunk différents', glyph: '🗂️', tier: 'or', goal: 25, value: distinct((p) => p.g === 'jetpunk', (p) => p.sub) },
]

export function evaluate(plays: Play[], now = new Date()): Progress[] {
  const c = { plays, summary: summarize(plays, now) }
  return ACHIEVEMENTS.map((a) => {
    const current = a.value(c)
    return { ...a, current: Math.min(current, a.goal), unlocked: current >= a.goal }
  })
}

const TITLES: [number, string][] = [
  [1, 'Touriste'],
  [5, 'Voyageur'],
  [10, 'Explorateur'],
  [15, 'Navigateur'],
  [20, 'Cartographe'],
  [30, 'Globe-trotter'],
  [40, 'Érudit'],
  [50, 'Méridien'],
]

export interface Level {
  xp: number
  level: number
  title: string
  // XP gagnée dans le niveau en cours, et ce qu'il faut pour passer au suivant
  into: number
  need: number
}

// Chaque partie rapporte ses points (0 à 100), chaque succès un bonus selon son rang.
// Le premier niveau demande 200 XP, et chacun 100 de plus que le précédent.
export function levelOf(plays: Play[], progress: Progress[]): Level {
  const xp = plays.reduce((s, p) => s + p.pts, 0) + progress.filter((a) => a.unlocked).reduce((s, a) => s + TIER_XP[a.tier], 0)
  let level = 1
  let need = 200
  let into = xp
  while (into >= need) {
    into -= need
    level++
    need += 100
  }
  const title = TITLES.filter(([from]) => level >= from).at(-1)![1]
  return { xp, level, title, into, need }
}

// Succès et niveau déjà annoncés, pour ne célébrer que les nouveautés.
export interface Seen {
  ids: string[]
  level: number
}

export const loadSeen = () => load<Seen | null>('achievements-seen', null)
export const saveSeen = (seen: Seen) => save('achievements-seen', seen)
