import { CONTINENT_NAMES, COUNTRIES, COUNTRY_BY_CODE, flagEmoji, type Continent } from '../../geo/countries'
import { CROSSINGS, getWorld } from '../../geo/world'
import { hashString, todayKey } from '../../lib/util'
import { CITY_STATS, COUNTRY_STATS, RANK_LISTS } from '../classement/data'
import {
  ANIMALS,
  BOOKS,
  CURRENCIES,
  DEPARTEMENTS,
  ELEMENTS,
  FILMS,
  INVENTIONS,
  LANGUAGES,
  MUSIC,
  OLYMPICS,
  PAINTINGS,
  US_CAPITALS,
  WORLD_CUPS,
} from '../quiz/facts'
import type { Row, TableQuiz } from './model'

type Meta = Omit<TableQuiz, 'id' | 'rows' | 'time'> & { time?: number }

// Environ six secondes par réponse, entre une minute et quinze minutes, arrondi à la demi-minute.
const timeFor = (n: number) => Math.min(900, Math.max(60, Math.ceil((n * 6) / 30) * 30))

function quiz(id: string, meta: Meta, rows: Row[]): TableQuiz {
  return { id, ...meta, time: meta.time ?? timeFor(rows.length), rows, author: 'Méridien' }
}

const sovereign = COUNTRIES.filter((c) => !c.territory && c.continent !== 'AN')
const countryRow = (code: string, extra: Partial<Row> = {}): Row => {
  const c = COUNTRY_BY_CODE.get(code)!
  return { answer: c.name, ...(c.aliases.length ? { alts: c.aliases } : {}), ...extra }
}
const codes = (list: string) => list.trim().split(/\s+/)

const CAPITAL_ALTS: Record<string, string[]> = {
  Pékin: ['Beijing', 'Peking'],
  Dacca: ['Dhaka'],
  'New Delhi': ['Delhi'],
  Washington: ['Washington DC'],
  Koweït: ['Koweït City'],
  'Andorre-la-Vieille': ['Andorra la Vella'],
  Bogota: ['Bogotá'],
  Brasilia: ['Brasília'],
}
const capitalRow = (c: (typeof COUNTRIES)[number]): Row => ({
  hint: c.name,
  answer: c.capital,
  ...(CAPITAL_ALTS[c.capital] ? { alts: CAPITAL_ALTS[c.capital] } : {}),
})

// Le nom de famille suffit, comme sur JetPunk : « Hugo » pour « Victor Hugo ».
const personRow = (hint: string, name: string): Row => {
  const last = name.split(' ').at(-1)!
  return last !== name ? { hint, answer: name, alts: [last] } : { hint, answer: name }
}

const CONTINENTS: Continent[] = ['EU', 'AF', 'AS', 'NA', 'SA', 'OC']
const OF: Record<Continent, string> = {
  EU: 'd’Europe',
  AF: 'd’Afrique',
  AS: 'd’Asie',
  NA: 'd’Amérique du Nord',
  SA: 'd’Amérique du Sud',
  OC: 'd’Océanie',
  AN: 'd’Antarctique',
}

function geography(): TableQuiz[] {
  // tableaux par continent dans l'ordre habituel, pays par ordre alphabétique dans chacun
  const byContinent = [...sovereign].sort((a, b) => CONTINENTS.indexOf(a.continent) - CONTINENTS.indexOf(b.continent))
  const out: TableQuiz[] = [
    quiz(
      'pays-du-monde',
      {
        title: 'Les pays du monde',
        description: 'Le grand classique : cite tous les pays souverains, rangés par continent.',
        category: 'Géographie',
        tags: ['pays', 'monde', 'continents', 'carte'],
        answer: 'Pays',
      },
      byContinent.map((c) => countryRow(c.code, { group: CONTINENT_NAMES[c.continent] })),
    ),
    quiz(
      'capitales-du-monde',
      {
        title: 'Les capitales du monde',
        description: 'Pour chaque pays, donne sa capitale.',
        category: 'Géographie',
        tags: ['capitales', 'villes', 'monde'],
        hint: 'Pays',
        answer: 'Capitale',
      },
      byContinent.filter((c) => c.capital !== '—').map((c) => ({ ...capitalRow(c), group: CONTINENT_NAMES[c.continent] })),
    ),
  ]
  for (const k of CONTINENTS) {
    const list = sovereign.filter((c) => c.continent === k)
    const name = CONTINENT_NAMES[k]
    out.push(
      quiz(`pays-${k.toLowerCase()}`, { title: `Les pays ${OF[k]}`, description: `Cite les ${list.length} pays ${OF[k]}.`, category: 'Géographie', tags: ['pays', name.toLowerCase()], answer: 'Pays' }, list.map((c) => countryRow(c.code))),
      quiz(
        `capitales-${k.toLowerCase()}`,
        { title: `Les capitales ${OF[k]}`, description: `Retrouve la capitale de chaque pays ${OF[k]}.`, category: 'Géographie', tags: ['capitales', 'villes', name.toLowerCase()], hint: 'Pays', answer: 'Capitale' },
        list.filter((c) => c.capital !== '—').map(capitalRow),
      ),
      quiz(
        `drapeaux-${k.toLowerCase()}`,
        { title: `Les drapeaux ${OF[k]}`, description: `À quel pays appartient chaque drapeau ?`, category: 'Géographie', tags: ['drapeaux', 'pays', name.toLowerCase()], hint: 'Drapeau', answer: 'Pays' },
        list.map((c) => countryRow(c.code, { hint: flagEmoji(c.code) })),
      ),
    )
  }

  const neighbors = getWorld().neighbors
  for (const [code, of] of [
    ['FR', 'de la France'],
    ['DE', 'de l’Allemagne'],
    ['RU', 'de la Russie'],
    ['CN', 'de la Chine'],
    ['BR', 'du Brésil'],
  ]) {
    const list = [...(neighbors.get(code) ?? [])].filter((n) => !CROSSINGS.has(`${code}-${n}`) && COUNTRY_BY_CODE.has(n))
    out.push(
      quiz(
        `voisins-${code.toLowerCase()}`,
        { title: `Les pays frontaliers ${of}`, description: `Cite les ${list.length} pays qui ont une frontière terrestre avec ce pays.`, category: 'Géographie', tags: ['frontières', 'voisins', 'pays'], answer: 'Pays' },
        list.map((n) => countryRow(n, n === 'GF' ? { alts: ['France', 'Guyane française'] } : {})),
      ),
    )
  }

  const byStat = (key: 'pop' | 'area' | 'gdp' | 'tourists', dir: 1 | -1, n: number) =>
    [...COUNTRY_STATS]
      .filter((c) => c[key] > 0 && COUNTRY_BY_CODE.has(c.code))
      .sort((a, b) => dir * (b[key] - a[key]))
      .slice(0, n)
      .map((c, i) => countryRow(c.code, { hint: `${i + 1}` }))
  const ranked = (id: string, title: string, description: string, tags: string[], rows: Row[]) =>
    quiz(id, { title, description, category: 'Géographie', tags: ['classement', ...tags], hint: 'Rang', answer: 'Pays' }, rows)
  out.push(
    ranked('plus-peuples', 'Les 20 pays les plus peuplés', 'Du plus peuplé au vingtième.', ['population', 'habitants'], byStat('pop', 1, 20)),
    ranked('plus-grands', 'Les 20 plus grands pays', 'Classés par superficie.', ['superficie', 'taille'], byStat('area', 1, 20)),
    ranked('plus-petits', 'Les 15 plus petits pays', 'Du plus petit au quinzième.', ['superficie', 'micro-États'], byStat('area', -1, 15)),
    ranked('plus-riches', 'Les 15 plus grandes économies', 'Classées par PIB.', ['économie', 'PIB', 'argent'], byStat('gdp', 1, 15)),
    ranked('plus-visites', 'Les 15 pays les plus visités', 'Selon le nombre de touristes internationaux.', ['tourisme', 'voyage'], byStat('tourists', 1, 15)),
  )
  const lists: [keyof typeof RANK_LISTS, string, string, string[]][] = [
    ['oil', 'petrole', 'Les 10 premiers producteurs de pétrole', ['pétrole', 'énergie']],
    ['gas', 'gaz', 'Les 10 premiers producteurs de gaz naturel', ['gaz', 'énergie']],
    ['coffee', 'cafe', 'Les 10 premiers producteurs de café', ['café', 'agriculture']],
    ['unesco', 'unesco', 'Les 10 pays aux plus de sites UNESCO', ['patrimoine', 'unesco']],
    ['idh', 'idh', 'Les 10 pays au plus fort développement humain', ['IDH', 'développement']],
    ['militaire', 'armees', 'Les 10 armées les plus puissantes', ['armée', 'militaire']],
  ]
  for (const [k, id, title, tags] of lists) {
    const rows = codes(RANK_LISTS[k])
      .filter((c) => COUNTRY_BY_CODE.has(c))
      .slice(0, 10)
      .map((c, i) => countryRow(c, { hint: `${i + 1}` }))
    out.push(ranked(id, title, 'Du premier au dixième.', tags, rows))
  }

  const cities = [...CITY_STATS].sort((a, b) => b.pop - a.pop).slice(0, 20)
  out.push(
    quiz(
      'grandes-villes',
      { title: 'Les 20 plus grandes villes du monde', description: 'Agglomérations classées par population ; le pays est donné en indice.', category: 'Géographie', tags: ['villes', 'population', 'métropoles'], hint: 'Pays', answer: 'Ville' },
      cities.map((c, i) => ({ hint: `${i + 1}. ${COUNTRY_BY_CODE.get(c.cc)?.name ?? c.cc}`, answer: c.name })),
    ),
    quiz(
      'departements',
      { title: 'Les départements français', description: 'Du numéro au nom : les 101 départements.', category: 'Géographie', tags: ['France', 'départements', 'numéros'], hint: 'N°', answer: 'Département' },
      DEPARTEMENTS.map(([n, name]) => ({ hint: n, answer: name })),
    ),
    quiz(
      'prefectures',
      { title: 'Les préfectures françaises', description: 'Donne la préfecture de chaque département.', category: 'Géographie', tags: ['France', 'villes', 'préfectures'], hint: 'Département', answer: 'Préfecture' },
      DEPARTEMENTS.map(([n, name, pref]) => ({ hint: `${n} · ${name}`, answer: pref })),
    ),
    quiz(
      'etats-americains',
      { title: 'Les 50 États américains', description: 'Cite les cinquante États des États-Unis.', category: 'Géographie', tags: ['États-Unis', 'USA', 'États'], answer: 'État' },
      US_CAPITALS.map(([state]) => ({ answer: state })),
    ),
    quiz(
      'capitales-americaines',
      { title: 'Les capitales des États américains', description: 'Sacramento, Albany… à toi de jouer.', category: 'Géographie', tags: ['États-Unis', 'USA', 'capitales'], hint: 'État', answer: 'Capitale' },
      US_CAPITALS.map(([state, cap]) => ({ hint: state, answer: cap })),
    ),
    quiz(
      'monnaies',
      { title: 'Les monnaies du monde', description: 'Quelle monnaie utilise chaque pays ?', category: 'Géographie', tags: ['monnaies', 'argent', 'économie'], hint: 'Pays', answer: 'Monnaie' },
      CURRENCIES.slice(0, 40).map(([country, money]) => ({ hint: country, answer: money })),
    ),
    quiz(
      'langues',
      { title: 'Les langues officielles', description: 'Quelle langue parle-t-on officiellement dans chaque pays ?', category: 'Langues', tags: ['langues', 'pays'], hint: 'Pays', answer: 'Langue' },
      LANGUAGES.slice(0, 40).map(([country, lang]) => ({ hint: country, answer: lang })),
    ),
  )
  return out
}

function history(): TableQuiz[] {
  const westGermany = ['Allemagne', 'RFA']
  return [
    quiz(
      'coupe-du-monde',
      { title: 'Les vainqueurs de la Coupe du monde', description: 'Pour chaque édition, le pays champion. Une réponse remplit toutes ses années.', category: 'Sport', tags: ['football', 'Coupe du monde', 'FIFA'], hint: 'Année', answer: 'Vainqueur' },
      WORLD_CUPS.map(([y, w]) => ({ hint: y, answer: w, ...(w.startsWith('Allemagne de') ? { alts: westGermany } : {}) })),
    ),
    quiz(
      'jo-ete',
      { title: 'Les villes des Jeux olympiques d’été', description: 'De 1896 à Paris 2024.', category: 'Sport', tags: ['JO', 'olympiques', 'villes'], hint: 'Année', answer: 'Ville' },
      OLYMPICS.filter((o) => o[2] === 'été').map(([y, city]) => ({ hint: y, answer: city })),
    ),
    quiz(
      'jo-hiver',
      { title: 'Les villes des Jeux olympiques d’hiver', description: 'De Chamonix 1924 à nos jours.', category: 'Sport', tags: ['JO', 'olympiques', 'hiver', 'ski'], hint: 'Année', answer: 'Ville' },
      OLYMPICS.filter((o) => o[2] === 'hiver').map(([y, city]) => ({ hint: y, answer: city })),
    ),
    quiz(
      'medailles',
      { title: 'Les 10 nations les plus médaillées aux JO', description: 'Au total des médailles olympiques.', category: 'Sport', tags: ['JO', 'médailles', 'classement'], hint: 'Rang', answer: 'Pays' },
      codes(RANK_LISTS.medals)
        .slice(0, 10)
        .map((c, i) => countryRow(c, { hint: `${i + 1}` })),
    ),
    quiz(
      'nobel',
      { title: 'Les 10 pays aux plus de prix Nobel', description: 'Du premier au dixième.', category: 'Histoire', tags: ['Nobel', 'sciences', 'classement'], hint: 'Rang', answer: 'Pays' },
      codes(RANK_LISTS.nobel)
        .slice(0, 10)
        .map((c, i) => countryRow(c, { hint: `${i + 1}` })),
    ),
  ]
}

function culture(): TableQuiz[] {
  const works = (id: string, title: string, description: string, tags: string[], hint: string, answer: string, table: string[][]) =>
    quiz(id, { title, description, category: 'Arts & culture', tags, hint, answer }, table.slice(0, 30).map(([w, who]) => personRow(w, who)))
  return [
    works('ecrivains', 'Qui a écrit… ?', 'Retrouve l’auteur de chaque œuvre ; le nom de famille suffit.', ['livres', 'littérature', 'auteurs'], 'Œuvre', 'Auteur', BOOKS),
    works('peintres', 'Qui a peint… ?', 'L’artiste derrière chaque tableau célèbre.', ['peinture', 'art', 'tableaux'], 'Œuvre', 'Artiste', PAINTINGS),
    works('compositeurs', 'Qui a composé… ?', 'Le compositeur de chaque grande œuvre.', ['musique', 'classique', 'compositeurs'], 'Œuvre', 'Compositeur', MUSIC),
    works('realisateurs', 'Qui a réalisé… ?', 'Le réalisateur de chaque film culte.', ['cinéma', 'films', 'réalisateurs'], 'Film', 'Réalisateur', FILMS),
    works('inventeurs', 'Qui a inventé… ?', 'Les grandes inventions et découvertes.', ['sciences', 'inventions', 'histoire'], 'Invention', 'Inventeur', INVENTIONS),
    quiz(
      'petits-animaux',
      { title: 'Les petits des animaux', description: 'Le veau, le poulain… et les autres ?', category: 'Langues', tags: ['animaux', 'vocabulaire'], hint: 'Animal', answer: 'Petit' },
      ANIMALS.map(([a, petit]) => ({ hint: a, answer: petit })),
    ),
    quiz(
      'cris-animaux',
      { title: 'Les cris des animaux', description: 'La vache meugle, le cheval… ?', category: 'Langues', tags: ['animaux', 'vocabulaire', 'verbes'], hint: 'Animal', answer: 'Cri' },
      ANIMALS.filter(([, , cri]) => cri).map(([a, , cri]) => ({ hint: a, answer: cri })),
    ),
  ]
}

function science(): TableQuiz[] {
  return [
    quiz(
      'elements',
      { title: 'Le tableau périodique', description: 'Les 118 éléments à partir de leur symbole.', category: 'Sciences', tags: ['chimie', 'éléments', 'Mendeleïev'], hint: 'Symbole', answer: 'Élément' },
      ELEMENTS.map(([, sym, name]) => ({ hint: sym, answer: name })),
    ),
    quiz(
      'elements-30',
      { title: 'Les 30 premiers éléments', description: 'De l’hydrogène au zinc.', category: 'Sciences', tags: ['chimie', 'éléments'], hint: 'N° · symbole', answer: 'Élément' },
      ELEMENTS.slice(0, 30).map(([n, sym, name]) => ({ hint: `${n} · ${sym}`, answer: name })),
    ),
    quiz(
      'symboles-30',
      { title: 'Les symboles chimiques', description: 'Donne le symbole des 30 premiers éléments.', category: 'Sciences', tags: ['chimie', 'symboles'], hint: 'Élément', answer: 'Symbole' },
      ELEMENTS.slice(0, 30).map(([, sym, name]) => ({ hint: name, answer: sym })),
    ),
  ]
}

// Petits quiz écrits à la main : « indice|réponse|variante;variante » par ligne.
function hand(id: string, meta: Meta, raw: string): TableQuiz {
  const rows = raw
    .trim()
    .split('\n')
    .map((line) => {
      const [hint, answer, alts] = line.split('|')
      const row: Row = { answer }
      if (hint) row.hint = hint
      if (alts) row.alts = alts.split(';')
      return row
    })
  return quiz(id, meta, rows)
}

const eu = codes('AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK')

function handmade(): TableQuiz[] {
  return [
    quiz('union-europeenne', { title: 'Les pays de l’Union européenne', description: 'Les 27 États membres.', category: 'Géographie', tags: ['Europe', 'UE', 'pays'], answer: 'Pays' }, eu.map((c) => countryRow(c))),
    quiz('g7', { title: 'Les pays du G7', description: 'Les sept grandes puissances économiques.', category: 'Géographie', tags: ['économie', 'G7', 'pays'], answer: 'Pays' }, codes('CA FR DE IT JP GB US').map((c) => countryRow(c))),
    quiz('conseil-securite', { title: 'Les membres permanents du Conseil de sécurité', description: 'Ceux qui ont un droit de veto à l’ONU.', category: 'Histoire', tags: ['ONU', 'veto', 'pays'], answer: 'Pays' }, codes('CN US FR GB RU').map((c) => countryRow(c))),
    hand(
      'regions-france',
      { title: 'Les régions françaises', description: 'Les 13 régions de métropole et les 5 d’outre-mer.', category: 'Géographie', tags: ['France', 'régions'], answer: 'Région' },
      `|Auvergne-Rhône-Alpes|Auvergne Rhône Alpes;AURA
|Bourgogne-Franche-Comté|Bourgogne Franche Comté
|Bretagne
|Centre-Val de Loire|Centre
|Corse
|Grand Est
|Hauts-de-France
|Île-de-France
|Normandie
|Nouvelle-Aquitaine
|Occitanie
|Pays de la Loire
|Provence-Alpes-Côte d’Azur|PACA;Provence
|Guadeloupe
|Martinique
|Guyane
|La Réunion|Réunion
|Mayotte`,
    ),
    hand(
      'presidents',
      { title: 'Les présidents de la Ve République', description: 'De 1959 à aujourd’hui ; le nom de famille suffit.', category: 'Histoire', tags: ['France', 'politique', 'présidents'], hint: 'Mandat', answer: 'Président' },
      `1959–1969|Charles de Gaulle|de Gaulle;Gaulle
1969–1974|Georges Pompidou|Pompidou
1974–1981|Valéry Giscard d’Estaing|Giscard;Giscard d’Estaing;VGE
1981–1995|François Mitterrand|Mitterrand
1995–2007|Jacques Chirac|Chirac
2007–2012|Nicolas Sarkozy|Sarkozy
2012–2017|François Hollande|Hollande
2017–|Emmanuel Macron|Macron`,
    ),
    hand(
      'merveilles',
      { title: 'Les Sept Merveilles du monde antique', description: 'Une seule tient encore debout.', category: 'Histoire', tags: ['Antiquité', 'monuments'], answer: 'Merveille' },
      `|Pyramide de Khéops|Khéops;Pyramide;Grande pyramide de Gizeh
|Jardins suspendus de Babylone|Jardins suspendus;Jardins de Babylone
|Statue de Zeus à Olympie|Statue de Zeus;Zeus
|Temple d’Artémis à Éphèse|Temple d’Artémis;Artémis
|Mausolée d’Halicarnasse|Mausolée
|Colosse de Rhodes|Colosse
|Phare d’Alexandrie|Phare`,
    ),
    hand(
      'dieux',
      { title: 'Dieux grecs et romains', description: 'Donne le nom romain de chaque dieu grec.', category: 'Histoire', tags: ['mythologie', 'Antiquité', 'dieux'], hint: 'Dieu grec', answer: 'Équivalent romain' },
      `Zeus|Jupiter
Héra|Junon
Poséidon|Neptune
Hadès|Pluton
Arès|Mars
Aphrodite|Vénus
Athéna|Minerve
Artémis|Diane
Hermès|Mercure
Héphaïstos|Vulcain
Déméter|Cérès
Dionysos|Bacchus
Hestia|Vesta
Éros|Cupidon
Cronos|Saturne`,
    ),
    hand(
      'planetes',
      { title: 'Les planètes du système solaire', description: 'De la plus proche à la plus lointaine du Soleil.', category: 'Sciences', tags: ['astronomie', 'espace', 'planètes'], hint: 'Ordre', answer: 'Planète' },
      `1|Mercure
2|Vénus
3|Terre
4|Mars
5|Jupiter
6|Saturne
7|Uranus
8|Neptune`,
    ),
    hand(
      'continents',
      { title: 'Les continents et les océans', description: 'Les sept continents et les cinq océans.', category: 'Géographie', tags: ['monde', 'océans', 'continents'], answer: 'Nom' },
      `Continent|Afrique
Continent|Amérique du Nord
Continent|Amérique du Sud
Continent|Antarctique|Antarctica
Continent|Asie
Continent|Europe
Continent|Océanie|Australie
Océan|Pacifique|Océan Pacifique
Océan|Atlantique|Océan Atlantique
Océan|Indien|Océan Indien
Océan|Arctique|Océan Arctique
Océan|Austral|Océan Austral`,
    ),
    hand(
      'montagnes',
      { title: 'Les 10 plus hauts sommets', description: 'Tous dépassent 8 000 mètres.', category: 'Géographie', tags: ['montagnes', 'Himalaya', 'altitude'], hint: 'Altitude', answer: 'Sommet' },
      `8 849 m|Everest|Mont Everest
8 611 m|K2
8 586 m|Kangchenjunga
8 516 m|Lhotse
8 485 m|Makalu
8 188 m|Cho Oyu
8 167 m|Dhaulagiri
8 163 m|Manaslu
8 126 m|Nanga Parbat
8 091 m|Annapurna`,
    ),
    hand(
      'fleuves',
      { title: 'Les 10 plus longs fleuves', description: 'Classés par longueur.', category: 'Géographie', tags: ['fleuves', 'rivières', 'eau'], hint: 'Longueur', answer: 'Fleuve' },
      `6 650 km|Nil
6 400 km|Amazone
6 300 km|Yangzi Jiang|Yangzi;Yangtsé;Yang-Tsé-Kiang;Fleuve Bleu
6 275 km|Mississippi-Missouri|Mississippi;Missouri
5 539 km|Ienisseï|Ienissei;Yenisei
5 464 km|Fleuve Jaune|Huang He
5 410 km|Ob|Ob-Irtych
4 880 km|Paraná|Parana
4 700 km|Congo
4 444 km|Amour|Amur`,
    ),
    hand(
      'fleuves-france',
      { title: 'Les cinq grands fleuves français', description: 'L’indice donne leur embouchure.', category: 'Géographie', tags: ['France', 'fleuves'], hint: 'Embouchure', answer: 'Fleuve' },
      `Océan Atlantique, à Saint-Nazaire|Loire
La Manche, au Havre|Seine
La Méditerranée, en Camargue|Rhône
L’estuaire de la Gironde|Garonne
La mer du Nord, aux Pays-Bas|Rhin`,
    ),
    hand(
      'zodiaque',
      { title: 'Les signes du zodiaque', description: 'Un signe pour chaque période de l’année.', category: 'Divers', tags: ['astrologie', 'signes'], hint: 'Période', answer: 'Signe' },
      `21 mars – 19 avril|Bélier
20 avril – 20 mai|Taureau
21 mai – 20 juin|Gémeaux
21 juin – 22 juillet|Cancer
23 juillet – 22 août|Lion
23 août – 22 septembre|Vierge
23 septembre – 22 octobre|Balance
23 octobre – 21 novembre|Scorpion
22 novembre – 21 décembre|Sagittaire
22 décembre – 19 janvier|Capricorne
20 janvier – 18 février|Verseau
19 février – 20 mars|Poissons`,
    ),
    hand(
      'zodiaque-chinois',
      { title: 'Le zodiaque chinois', description: 'Les douze animaux, dans l’ordre.', category: 'Divers', tags: ['Chine', 'astrologie', 'animaux'], hint: 'Ordre', answer: 'Animal' },
      `1|Rat
2|Bœuf|Buffle
3|Tigre
4|Lapin|Lièvre;Chat
5|Dragon
6|Serpent
7|Cheval
8|Chèvre|Mouton
9|Singe
10|Coq
11|Chien
12|Cochon|Porc;Sanglier`,
    ),
    hand(
      'alphabet-grec',
      { title: 'L’alphabet grec', description: 'Le nom des 24 lettres.', category: 'Langues', tags: ['grec', 'alphabet', 'lettres'], hint: 'Lettre', answer: 'Nom' },
      `α|Alpha
β|Bêta
γ|Gamma
δ|Delta
ε|Epsilon
ζ|Zêta
η|Êta
θ|Thêta
ι|Iota
κ|Kappa
λ|Lambda
μ|Mu|Mû
ν|Nu|Nû
ξ|Xi|Ksi
ο|Omicron
π|Pi
ρ|Rhô|Rho
σ|Sigma
τ|Tau
υ|Upsilon
φ|Phi
χ|Khi|Chi
ψ|Psi
ω|Oméga`,
    ),
    hand(
      'nombres-anglais',
      { title: 'Compter jusqu’à 20 en anglais', description: 'De one à twenty.', category: 'Langues', tags: ['anglais', 'nombres'], hint: 'Nombre', answer: 'En anglais' },
      'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'
        .split(' ')
        .map((w, i) => `${i + 1}|${w}`)
        .join('\n'),
    ),
    hand(
      'nombres-allemand',
      { title: 'Compter jusqu’à 10 en allemand', description: 'Eins, zwei, drei…', category: 'Langues', tags: ['allemand', 'nombres'], hint: 'Nombre', answer: 'En allemand' },
      `1|eins
2|zwei
3|drei
4|vier
5|fünf|funf;fuenf
6|sechs
7|sieben
8|acht
9|neun
10|zehn`,
    ),
    hand(
      'jours-espagnol',
      { title: 'Les jours de la semaine en espagnol', description: 'De lunes à domingo.', category: 'Langues', tags: ['espagnol', 'jours'], hint: 'Jour', answer: 'En espagnol' },
      `lundi|lunes
mardi|martes
mercredi|miércoles
jeudi|jueves
vendredi|viernes
samedi|sábado
dimanche|domingo`,
    ),
    hand(
      'mois-anglais',
      { title: 'Les mois en anglais', description: 'January, February…', category: 'Langues', tags: ['anglais', 'mois', 'calendrier'], hint: 'Mois', answer: 'En anglais' },
      'janvier|January\nfévrier|February\nmars|March\navril|April\nmai|May\njuin|June\njuillet|July\naoût|August\nseptembre|September\noctobre|October\nnovembre|November\ndécembre|December',
    ),
    hand(
      'arc-en-ciel',
      { title: 'Les couleurs de l’arc-en-ciel', description: 'Dans l’ordre, de l’extérieur vers l’intérieur.', category: 'Divers', tags: ['couleurs', 'lumière'], hint: 'Ordre', answer: 'Couleur' },
      `1|Rouge
2|Orange
3|Jaune
4|Vert
5|Bleu
6|Indigo
7|Violet`,
    ),
    hand(
      'notes',
      { title: 'Les notes de musique', description: 'La gamme de do majeur.', category: 'Arts & culture', tags: ['musique', 'solfège'], hint: 'Degré', answer: 'Note' },
      `1|Do|Ut
2|Ré
3|Mi
4|Fa
5|Sol
6|La
7|Si`,
    ),
    hand(
      'sept-nains',
      { title: 'Les sept nains', description: 'Blanche-Neige, version française de Disney.', category: 'Arts & culture', tags: ['Disney', 'contes', 'cinéma'], answer: 'Nain' },
      '|Prof\n|Atchoum\n|Dormeur\n|Grincheux\n|Joyeux\n|Simplet\n|Timide',
    ),
    hand(
      'harry-potter',
      { title: 'Les sept tomes de Harry Potter', description: 'Le titre français de chaque tome.', category: 'Arts & culture', tags: ['livres', 'Harry Potter', 'fantasy'], hint: 'Tome', answer: 'Titre' },
      `1|Harry Potter à l’école des sorciers|À l’école des sorciers;École des sorciers
2|Harry Potter et la Chambre des secrets|Chambre des secrets
3|Harry Potter et le Prisonnier d’Azkaban|Prisonnier d’Azkaban
4|Harry Potter et la Coupe de feu|Coupe de feu
5|Harry Potter et l’Ordre du phénix|Ordre du phénix
6|Harry Potter et le Prince de sang-mêlé|Prince de sang-mêlé
7|Harry Potter et les Reliques de la Mort|Reliques de la Mort`,
    ),
    hand(
      'poudlard',
      { title: 'Les maisons de Poudlard', description: 'Le Choixpeau t’attend.', category: 'Arts & culture', tags: ['Harry Potter', 'livres'], answer: 'Maison' },
      '|Gryffondor\n|Poufsouffle\n|Serdaigle\n|Serpentard',
    ),
    hand(
      'beatles',
      { title: 'Les Beatles', description: 'Les quatre garçons de Liverpool.', category: 'Arts & culture', tags: ['musique', 'rock', 'groupes'], answer: 'Membre' },
      '|John Lennon|Lennon;John\n|Paul McCartney|McCartney;Paul\n|George Harrison|Harrison;George\n|Ringo Starr|Starr;Ringo',
    ),
    hand(
      'pokemon-starters',
      { title: 'Les Pokémon de départ', description: 'Les starters des quatre premières générations.', category: 'Arts & culture', tags: ['Pokémon', 'jeux vidéo'], hint: 'Génération · type', answer: 'Pokémon' },
      `1 · Plante|Bulbizarre
1 · Feu|Salamèche
1 · Eau|Carapuce
2 · Plante|Germignon
2 · Feu|Héricendre
2 · Eau|Kaiminus
3 · Plante|Arcko
3 · Feu|Poussifeu
3 · Eau|Gobou
4 · Plante|Tortipouss
4 · Feu|Ouisticram
4 · Eau|Tiplouf`,
    ),
    hand(
      'ballon-or',
      { title: 'Les Ballons d’or depuis 2000', description: 'Le lauréat de chaque année (pas d’édition en 2020).', category: 'Sport', tags: ['football', 'Ballon d’or', 'joueurs'], hint: 'Année', answer: 'Lauréat' },
      `2000|Luís Figo|Figo
2001|Michael Owen|Owen
2002|Ronaldo|Ronaldo Nazário
2003|Pavel Nedvěd|Nedved
2004|Andriy Shevchenko|Shevchenko;Chevtchenko
2005|Ronaldinho
2006|Fabio Cannavaro|Cannavaro
2007|Kaká|Kaka
2008|Cristiano Ronaldo|CR7
2009|Lionel Messi|Messi
2010|Lionel Messi|Messi
2011|Lionel Messi|Messi
2012|Lionel Messi|Messi
2013|Cristiano Ronaldo|CR7
2014|Cristiano Ronaldo|CR7
2015|Lionel Messi|Messi
2016|Cristiano Ronaldo|CR7
2017|Cristiano Ronaldo|CR7
2018|Luka Modrić|Modric
2019|Lionel Messi|Messi
2021|Lionel Messi|Messi
2022|Karim Benzema|Benzema
2023|Lionel Messi|Messi
2024|Rodri|Rodrigo Hernández`,
    ),
    hand(
      'grand-chelem',
      { title: 'Les tournois du Grand Chelem', description: 'Les quatre majeurs du tennis, dans l’ordre de la saison.', category: 'Sport', tags: ['tennis'], hint: 'Mois', answer: 'Tournoi' },
      `Janvier|Open d’Australie|Australian Open;Melbourne
Mai–juin|Roland-Garros|Roland Garros
Juillet|Wimbledon
Août–septembre|US Open|Open des États-Unis;Flushing Meadows`,
    ),
    hand(
      'six-nations',
      { title: 'Les équipes du Tournoi des Six Nations', description: 'Le grand rendez-vous du rugby européen.', category: 'Sport', tags: ['rugby'], answer: 'Équipe' },
      '|Angleterre\n|Écosse\n|France\n|Irlande\n|Italie\n|Pays de Galles|Galles',
    ),
    hand(
      'decathlon',
      { title: 'Les épreuves du décathlon', description: 'Dix épreuves sur deux jours.', category: 'Sport', tags: ['athlétisme', 'JO'], hint: 'Jour', answer: 'Épreuve' },
      `1er jour|100 m|100 mètres
1er jour|Saut en longueur|Longueur
1er jour|Lancer du poids|Poids
1er jour|Saut en hauteur|Hauteur
1er jour|400 m|400 mètres
2e jour|110 m haies|110 mètres haies
2e jour|Lancer du disque|Disque
2e jour|Saut à la perche|Perche
2e jour|Lancer du javelot|Javelot
2e jour|1 500 m|1500 m;1500 mètres`,
    ),
    hand(
      'echecs',
      { title: 'Les pièces d’échecs', description: 'Les six pièces de chaque camp.', category: 'Divers', tags: ['jeux', 'échecs'], answer: 'Pièce' },
      '|Roi\n|Dame|Reine\n|Tour\n|Fou\n|Cavalier\n|Pion',
    ),
    hand(
      'doigts',
      { title: 'Les doigts de la main', description: 'Du pouce au petit doigt.', category: 'Sciences', tags: ['corps humain', 'anatomie'], hint: 'Ordre', answer: 'Doigt' },
      '1|Pouce\n2|Index\n3|Majeur\n4|Annulaire\n5|Auriculaire|Petit doigt',
    ),
  ]
}

let all: TableQuiz[] | null = null
export function builtInQuizzes(): TableQuiz[] {
  all ??= [...geography(), ...history(), ...culture(), ...science(), ...handmade()]
  return all
}

export function featuredQuiz(day = todayKey()): TableQuiz {
  const list = builtInQuizzes()
  return list[hashString('jetpunk-' + day) % list.length]
}
