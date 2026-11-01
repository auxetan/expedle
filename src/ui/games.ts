import { msg } from '../lib/i18n'

export interface GameEntry {
  href: string
  title: string
  tagline: string
  rhythm: 'quotidien' | 'hebdo' | 'libre'
  // fichier de public/icons, décliné en -sombre et -clair
  icon: string
  dailyId?: string
  weekly?: boolean
  // une famille de jeux dans une rubrique trop longue : un sous-titre à l'affichage, rien de plus
  family?: string
}

// Les familles de la Géographie. Les rubriques, elles, ne bougent pas : les quêtes du jour et le programme en dépendent.
const VOYAGER = msg('Voyager')
const PAYS = msg('Trouver le pays')
const MONDE = msg('Explorer le monde')
const CARTES = msg('Cartes')

export interface GameSection {
  label: string
  // la teinte de la rubrique, un jeton de index.css posé en data-tint ; l'or reste aux pépites
  tint: 'teal' | 'orange' | 'rose'
  games: GameEntry[]
}

export const GAME_SECTIONS: GameSection[] = [
  {
    label: 'Géographie',
    tint: 'teal',
    games: [
      { href: '#/expedition', title: 'L’Expédition', tagline: 'Passer chaque douane jusqu’au bout du monde', rhythm: 'quotidien', dailyId: 'expedition', icon: 'expedition', family: VOYAGER },
      { href: '#/itineraire', title: 'Travle', tagline: 'Relier deux pays par la terre', rhythm: 'quotidien', dailyId: 'itineraire', icon: 'travle', family: VOYAGER },
      { href: '#/itineraire/hebdo', title: 'Travle : défi hebdo', tagline: 'Un long trajet, chaque lundi', rhythm: 'hebdo', dailyId: 'itineraire-hebdo', weekly: true, icon: 'travle-hebdo', family: VOYAGER },
      { href: '#/itineraire/usa', title: 'Travle USA', tagline: 'D’un État américain à l’autre', rhythm: 'quotidien', dailyId: 'itineraire-usa', icon: 'travle-usa', family: VOYAGER },
      { href: '#/worldle', title: 'Worldle', tagline: 'Le pays à sa silhouette, en six essais', rhythm: 'quotidien', dailyId: 'worldle', icon: 'worldle', family: PAYS },
      { href: '#/statele', title: 'Statele', tagline: 'L’État américain à sa silhouette', rhythm: 'quotidien', dailyId: 'statele', icon: 'statele', family: PAYS },
      { href: '#/dailygeo', title: 'DailyGeo', tagline: 'Un pays puis sa capitale, indice après indice', rhythm: 'quotidien', dailyId: 'dailygeo', icon: 'dailygeo', family: PAYS },
      { href: '#/globle', title: 'Globle', tagline: 'Le pays mystère, de plus en plus chaud', rhythm: 'quotidien', dailyId: 'globle', icon: 'globle', family: PAYS },
      { href: '#/countryle', title: 'Countryle', tagline: 'Le pays mystère, indice après indice', rhythm: 'quotidien', dailyId: 'countryle', icon: 'countryle', family: PAYS },
      { href: '#/flagle', title: 'Flagle', tagline: 'Le drapeau se dévoile tuile après tuile', rhythm: 'quotidien', dailyId: 'flagle', icon: 'flagle', family: PAYS },
      { href: '#/geoguessr', title: 'GeoGuessr', tagline: 'Lâché dans une rue en 360° : où es-tu ?', rhythm: 'libre', icon: 'geoguessr', family: MONDE },
      { href: '#/photoguessr', title: 'PhotoGuessr', tagline: 'Où a été prise cette photo ?', rhythm: 'libre', icon: 'photoguessr', family: MONDE },
      { href: '#/geoguessr/jour', title: 'GeoGuessr : défi du jour', tagline: 'Cinq lieux en 360°, les mêmes pour tous', rhythm: 'quotidien', dailyId: 'geoguessr-jour', icon: 'geoguessr', family: MONDE },
      { href: '#/photoguessr/jour', title: 'PhotoGuessr : défi du jour', tagline: 'Cinq photos, les mêmes pour tous', rhythm: 'quotidien', dailyId: 'photoguessr-jour', icon: 'photoguessr', family: MONDE },
      { href: '#/geogrid', title: 'GeoGrid', tagline: 'Neuf cases, deux critères chacune', rhythm: 'quotidien', dailyId: 'geogrid', icon: 'geogrid', family: CARTES },
      { href: '#/classement', title: 'GeoHunter', tagline: 'Chaque pays dans sa meilleure catégorie', rhythm: 'quotidien', dailyId: 'classement-jour', icon: 'geohunter', family: CARTES },
      { href: '#/cartographe', title: 'Seterra', tagline: 'Situer pays, capitales et drapeaux', rhythm: 'libre', icon: 'seterra', family: CARTES },
      { href: '#/openfront', title: 'Frontières', tagline: 'Conquérir le monde contre des bots', rhythm: 'libre', icon: 'openfront', family: CARTES },
    ],
  },
  {
    label: 'Magnitudle',
    tint: 'orange',
    games: [
      { href: '#/echelle', title: 'Size It Up', tagline: 'La silhouette à sa vraie taille', rhythm: 'quotidien', dailyId: 'echelle-objets', icon: 'size-it-up' },
      { href: '#/echelle/pop', title: 'Size It Up : Pop Culture', tagline: 'La taille officielle des héros de fiction', rhythm: 'quotidien', dailyId: 'echelle-pop', icon: 'size-it-up-pop' },
      { href: '#/echelle/geo', title: 'Size It Up : Géographie', tagline: 'La vraie taille des territoires', rhythm: 'quotidien', dailyId: 'echelle-geo', icon: 'size-it-up-geo' },
      { href: '#/echelle/1000', title: 'The Weekly 1K', tagline: 'Dix manches sur un thème', rhythm: 'hebdo', dailyId: 'echelle-1000', weekly: true, icon: 'weekly-1k' },
      { href: '#/balance', title: 'Weigh It Up', tagline: 'Équilibrer la balance', rhythm: 'quotidien', dailyId: 'balance', icon: 'weigh-it-up' },
      { href: '#/question', title: 'Daily Question', tagline: 'Une question, une estimation', rhythm: 'quotidien', dailyId: 'question', icon: 'daily-question' },
      { href: '#/survie', title: 'Survival Mode', tagline: 'Estimer vite, rester en vie', rhythm: 'libre', icon: 'survival' },
    ],
  },
  {
    label: 'Culture générale',
    tint: 'rose',
    games: [
      { href: '#/quiz/jour', title: 'Quiz du jour', tagline: 'Dix questions, les mêmes pour tous', rhythm: 'quotidien', dailyId: 'quiz-jour', icon: 'quiz-jour' },
      { href: '#/factle', title: 'Factle', tagline: 'Les cinq premiers d’un classement, dans l’ordre', rhythm: 'quotidien', dailyId: 'factle', icon: 'factle' },
      { href: '#/wikitrivia', title: 'Wikitrivia', tagline: 'Chaque événement à sa place sur la frise', rhythm: 'quotidien', dailyId: 'wikitrivia', icon: 'wikitrivia' },
      { href: '#/tightrope', title: 'Tightrope', tagline: 'Neuf questions, trois faux pas', rhythm: 'quotidien', dailyId: 'tightrope', icon: 'tightrope' },
      { href: '#/jetpunk', title: 'JetPunk', tagline: 'Des dizaines de quiz à remplir contre la montre', rhythm: 'libre', icon: 'jetpunk' },
      { href: '#/quiz', title: 'Quiz culture G', tagline: 'Des milliers de questions', rhythm: 'libre', icon: 'quiz-culture-g' },
      { href: '#/quiz/drapeaux', title: 'Drapeaux', tagline: 'Un pays, un drapeau', rhythm: 'libre', icon: 'drapeaux' },
      { href: '#/quiz/capitales', title: 'Capitales', tagline: 'Chaque pays et sa capitale', rhythm: 'libre', icon: 'capitales' },
      { href: '#/quiz/francophonie', title: 'Francophonie', tagline: 'Les pays de langue française, leurs capitales et leurs drapeaux', rhythm: 'libre', icon: 'francophonie' },
    ],
  },
]

export const ALL_GAMES = GAME_SECTIONS.flatMap((s) => s.games)

// La rubrique d'une page : celle du jeu dont l'adresse est le plus long préfixe du chemin (#/itineraire/usa avant #/itineraire).
export function rubriqueOf(hash: string): GameSection | undefined {
  const path = hash.split('?')[0]
  let best: { section: GameSection; length: number } | undefined
  for (const section of GAME_SECTIONS)
    for (const { href } of section.games)
      if ((path === href || path.startsWith(href + '/')) && href.length > (best?.length ?? 0)) best = { section, length: href.length }
  return best?.section
}

// Les jeux d'une rubrique, regroupés par famille dans l'ordre où ils viennent.
export function familiesOf(games: GameEntry[]): { family?: string; games: GameEntry[] }[] {
  const groups: { family?: string; games: GameEntry[] }[] = []
  for (const g of games) {
    const last = groups.at(-1)
    if (last && last.family === g.family) last.games.push(g)
    else groups.push({ family: g.family, games: [g] })
  }
  return groups
}
