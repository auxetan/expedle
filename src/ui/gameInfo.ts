import { ALL_GAMES } from './games'

// Nom, lien et unité de score de chaque jeu tel qu'il s'inscrit dans l'historique.
export interface GameInfo {
  title: string
  href: string
  unit: (s: number) => string
  lower?: boolean
  // le chrono n'a pas de sens quand tenir longtemps est le but
  untimed?: boolean
}

const pts = (s: number) => `${s.toLocaleString('fr-FR')} pts`
const essais = (s: number) => `${s} essai${s > 1 ? 's' : ''}`
const rang = (s: number) => `total ${s}`

const GAMES: Record<string, GameInfo> = {
  itineraire: { title: 'Travle', href: '#/itineraire', unit: essais, lower: true },
  'itineraire-hebdo': { title: 'Travle : défi hebdo', href: '#/itineraire/hebdo', unit: essais, lower: true },
  'itineraire-usa': { title: 'Travle USA', href: '#/itineraire/usa', unit: essais, lower: true },
  'itineraire-libre': { title: 'Travle : entraînement', href: '#/itineraire/libre', unit: essais, lower: true },
  'classement-classique': { title: 'GeoHunter', href: '#/classement/classique', unit: rang, lower: true },
  'classement-facile': { title: 'GeoHunter facile', href: '#/classement/facile', unit: rang, lower: true },
  'classement-monde': { title: 'GeoHunter Monde', href: '#/classement/monde', unit: rang, lower: true },
  'classement-special': { title: 'GeoHunter Spécial', href: '#/classement/special', unit: rang, lower: true },
  'classement-villes': { title: 'GeoHunter Villes', href: '#/classement/villes', unit: rang, lower: true },
  'classement-jour': { title: 'GeoHunter : défi du jour', href: '#/classement/jour', unit: rang, lower: true },
  'classement-hebdo': { title: 'GeoHunter hebdo', href: '#/classement/hebdo', unit: rang, lower: true },
  cartographe: { title: 'Seterra', href: '#/cartographe', unit: (s) => `${s} %` },
  'echelle-objets': { title: 'Size It Up', href: '#/echelle', unit: pts },
  'echelle-pop': { title: 'Size It Up : Pop Culture', href: '#/echelle/pop', unit: pts },
  'echelle-geo': { title: 'Size It Up : Géographie', href: '#/echelle/geo', unit: pts },
  'echelle-1000': { title: 'The Weekly 1K', href: '#/echelle/1000', unit: pts },
  balance: { title: 'Weigh It Up', href: '#/balance', unit: pts },
  question: { title: 'Daily Question', href: '#/question', unit: (s) => `${s} / 100`, untimed: true },
  survie: { title: 'Survival Mode', href: '#/survie', unit: (s) => `${s} question${s > 1 ? 's' : ''}`, untimed: true },
  'quiz-jour': { title: 'Quiz du jour', href: '#/quiz/jour', unit: pts },
  'quiz-culture': { title: 'Quiz culture G', href: '#/quiz', unit: pts },
  'quiz-drapeaux': { title: 'Drapeaux', href: '#/quiz/drapeaux', unit: pts },
  'quiz-capitales': { title: 'Capitales', href: '#/quiz/capitales', unit: pts },
  jetpunk: { title: 'JetPunk', href: '#/jetpunk', unit: (s) => `${s} %` },
  worldle: { title: 'Worldle', href: '#/worldle', unit: (s) => `${s}/6`, lower: true },
  globle: { title: 'Globle', href: '#/globle', unit: essais, lower: true },
  photoguessr: { title: 'PhotoGuessr', href: '#/photoguessr', unit: pts },
  geoguessr: { title: 'GeoGuessr', href: '#/geoguessr', unit: pts },
}

export const gameInfo = (g: string): GameInfo => GAMES[g] ?? { title: g, href: '#/', unit: pts }
export function gameIcon(g: string): string | null {
  const href = gameInfo(g).href
  const exact = ALL_GAMES.find((x) => x.dailyId === g || x.href === href)
  const parent = ALL_GAMES.filter((x) => href.startsWith(x.href)).sort((a, b) => b.href.length - a.href.length)[0]
  return (exact ?? parent)?.icon ?? null
}
