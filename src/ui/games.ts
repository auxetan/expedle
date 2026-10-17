export interface GameEntry {
  href: string
  title: string
  tagline: string
  rhythm: 'quotidien' | 'hebdo' | 'libre'
  // fichier de public/icons, décliné en -sombre et -clair
  icon: string
  dailyId?: string
  weekly?: boolean
}

export const GAME_SECTIONS: { label: string; games: GameEntry[] }[] = [
  {
    label: 'Géographie',
    games: [
      { href: '#/itineraire', title: 'Travle', tagline: 'Relier deux pays par la terre', rhythm: 'quotidien', dailyId: 'itineraire', icon: 'travle' },
      { href: '#/itineraire/hebdo', title: 'Travle : défi hebdo', tagline: 'Un long trajet, chaque lundi', rhythm: 'hebdo', dailyId: 'itineraire-hebdo', weekly: true, icon: 'travle-hebdo' },
      { href: '#/itineraire/usa', title: 'Travle USA', tagline: 'D’un État américain à l’autre', rhythm: 'quotidien', dailyId: 'itineraire-usa', icon: 'travle-usa' },
      { href: '#/worldle', title: 'Worldle', tagline: 'Le pays à sa silhouette, en six essais', rhythm: 'quotidien', dailyId: 'worldle', icon: 'worldle' },
      { href: '#/globle', title: 'Globle', tagline: 'Le pays mystère, de plus en plus chaud', rhythm: 'quotidien', dailyId: 'globle', icon: 'globle' },
      { href: '#/countryle', title: 'Countryle', tagline: 'Le pays mystère, indice après indice', rhythm: 'quotidien', dailyId: 'countryle', icon: 'countryle' },
      { href: '#/flagle', title: 'Flagle', tagline: 'Le drapeau se dévoile tuile après tuile', rhythm: 'quotidien', dailyId: 'flagle', icon: 'flagle' },
      { href: '#/geogrid', title: 'GeoGrid', tagline: 'Neuf cases, deux critères chacune', rhythm: 'quotidien', dailyId: 'geogrid', icon: 'geogrid' },
      { href: '#/geoguessr', title: 'GeoGuessr', tagline: 'Lâché dans une rue en 360° : où es-tu ?', rhythm: 'libre', icon: 'geoguessr' },
      { href: '#/photoguessr', title: 'PhotoGuessr', tagline: 'Où a été prise cette photo ?', rhythm: 'libre', icon: 'photoguessr' },
      { href: '#/classement', title: 'GeoHunter', tagline: 'Chaque pays dans sa meilleure catégorie', rhythm: 'quotidien', dailyId: 'classement-jour', icon: 'geohunter' },
      { href: '#/cartographe', title: 'Seterra', tagline: 'Situer pays, capitales et drapeaux', rhythm: 'libre', icon: 'seterra' },
    ],
  },
  {
    label: 'Magnitudle',
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
    games: [
      { href: '#/quiz/jour', title: 'Quiz du jour', tagline: 'Dix questions, les mêmes pour tous', rhythm: 'quotidien', dailyId: 'quiz-jour', icon: 'quiz-jour' },
      { href: '#/jetpunk', title: 'JetPunk', tagline: 'Des dizaines de quiz à remplir contre la montre', rhythm: 'libre', icon: 'jetpunk' },
      { href: '#/quiz', title: 'Quiz culture G', tagline: 'Des milliers de questions', rhythm: 'libre', icon: 'quiz-culture-g' },
      { href: '#/quiz/drapeaux', title: 'Drapeaux', tagline: 'Un pays, un drapeau', rhythm: 'libre', icon: 'drapeaux' },
      { href: '#/quiz/capitales', title: 'Capitales', tagline: 'Chaque pays et sa capitale', rhythm: 'libre', icon: 'capitales' },
    ],
  },
]

export const ALL_GAMES = GAME_SECTIONS.flatMap((s) => s.games)
