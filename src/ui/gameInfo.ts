import { ALL_GAMES } from './games'
import { fmt, plural, t } from '../lib/i18n'

// Nom, lien et unité de score de chaque jeu tel qu'il s'inscrit dans l'historique.
export interface GameInfo {
  title: string
  href: string
  unit: (s: number) => string
  lower?: boolean
  // le chrono n'a pas de sens quand tenir longtemps est le but
  untimed?: boolean
}

const pts = (s: number) => t('{n} pts', { n: fmt(s) })
const essais = (s: number) => plural(s, '{n} essai', '{n} essais')
const rang = (s: number) => t('total {n}', { n: s })

export const GAMES: Record<string, GameInfo> = {
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
  openfront: { title: 'Frontières', href: '#/openfront', unit: (s) => t('{n} % des terres', { n: s }) },
  'echelle-objets': { title: 'Size It Up', href: '#/echelle', unit: pts },
  'echelle-pop': { title: 'Size It Up : Pop Culture', href: '#/echelle/pop', unit: pts },
  'echelle-geo': { title: 'Size It Up : Géographie', href: '#/echelle/geo', unit: pts },
  'echelle-1000': { title: 'The Weekly 1K', href: '#/echelle/1000', unit: pts },
  balance: { title: 'Weigh It Up', href: '#/balance', unit: pts },
  question: { title: 'Daily Question', href: '#/question', unit: (s) => `${s} / 100`, untimed: true },
  survie: { title: 'Survival Mode', href: '#/survie', unit: (s) => plural(s, '{n} question', '{n} questions'), untimed: true },
  'quiz-jour': { title: 'Quiz du jour', href: '#/quiz/jour', unit: pts },
  'quiz-culture': { title: 'Quiz culture G', href: '#/quiz', unit: pts },
  'quiz-drapeaux': { title: 'Drapeaux', href: '#/quiz/drapeaux', unit: pts },
  'quiz-capitales': { title: 'Capitales', href: '#/quiz/capitales', unit: pts },
  'quiz-francophonie': { title: 'Francophonie', href: '#/quiz/francophonie', unit: pts },
  jetpunk: { title: 'JetPunk', href: '#/jetpunk', unit: (s) => `${s} %` },
  worldle: { title: 'Worldle', href: '#/worldle', unit: (s) => `${s}/6`, lower: true },
  expedition: { title: 'L’Expédition', href: '#/expedition', unit: (s) => plural(s, '{n} frontière', '{n} frontières'), lower: true },
  'expedition-tour': { title: 'Tour du monde', href: '#/expedition/tour', unit: (s) => plural(s, '{n} pays', '{n} pays'), untimed: true },
  duel: { title: 'Duel', href: '#/duel', unit: (s) => (s === 1 ? t('gagné') : s === 0 ? t('perdu') : t('égalité')) },
  statele: { title: 'Statele', href: '#/statele', unit: (s) => `${s}/6`, lower: true },
  dailygeo: { title: 'DailyGeo', href: '#/dailygeo', unit: (s) => `${s}/100` },
  factle: { title: 'Factle', href: '#/factle', unit: (s) => `${s}/5`, lower: true },
  wikitrivia: { title: 'Wikitrivia', href: '#/wikitrivia', unit: (s) => `${s}/15` },
  tightrope: { title: 'Tightrope', href: '#/tightrope', unit: (s) => `${s}/9` },
  globle: { title: 'Globle', href: '#/globle', unit: essais, lower: true },
  countryle: { title: 'Countryle', href: '#/countryle', unit: (s) => `${s}/8`, lower: true },
  flagle: { title: 'Flagle', href: '#/flagle', unit: (s) => `${s}/6`, lower: true },
  geogrid: { title: 'GeoGrid', href: '#/geogrid', unit: (s) => `${s}/9` },
  photoguessr: { title: 'PhotoGuessr', href: '#/photoguessr', unit: pts },
  geoguessr: { title: 'GeoGuessr', href: '#/geoguessr', unit: pts },
  'photoguessr-jour': { title: 'PhotoGuessr : défi du jour', href: '#/photoguessr/jour', unit: pts },
  'geoguessr-jour': { title: 'GeoGuessr : défi du jour', href: '#/geoguessr/jour', unit: pts },
}

// le titre est traduit à l'affichage : t(gameInfo(g).title)
export const gameInfo = (g: string): GameInfo => GAMES[g] ?? { title: g, href: '#/', unit: pts }
export function gameIcon(g: string): string | null {
  const href = gameInfo(g).href
  const exact = ALL_GAMES.find((x) => x.dailyId === g || x.href === href)
  const parent = ALL_GAMES.filter((x) => href.startsWith(x.href)).sort((a, b) => b.href.length - a.href.length)[0]
  return (exact ?? parent)?.icon ?? null
}
