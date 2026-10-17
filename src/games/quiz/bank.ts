import { COUNTRIES, CONTINENT_NAMES, countryName, flagEmoji } from '../../geo/countries'
import { mulberry32, shuffle } from '../../lib/util'
import { CITY_STATS, COUNTRY_STATS } from '../classement/data'
import {
  ANIMALS,
  BOOKS,
  CURRENCIES,
  DEPARTEMENTS,
  ELEMENTS,
  EVENTS,
  FILMS,
  INVENTIONS,
  LANGUAGES,
  MUSIC,
  OLYMPICS,
  PAINTINGS,
  US_CAPITALS,
  WORLD_CUPS,
} from './facts'
import { QUESTIONS } from './questions'
import { msg } from '../../lib/i18n'

export interface BankQuestion {
  id: string
  cat: string
  q: string
  big?: string
  a: string
  w: string[]
}

export const CATEGORIES = [
  msg('Géographie'),
  msg('Histoire'),
  msg('Sciences'),
  msg('Arts & Lettres'),
  msg('Cinéma & Musique'),
  msg('Sport'),
  msg('France'),
  msg('Nature'),
  msg('Divers'),
]

// Les mauvaises réponses sont tirées de façon déterministe : une question garde toujours les mêmes choix.
function distractors(pool: string[], answer: string, seed: number, prefer: string[] = []): string[] {
  const rng = mulberry32(seed)
  const firsts = shuffle(prefer.filter((p) => p !== answer), rng)
  const rest = shuffle(pool.filter((p) => p !== answer && !prefer.includes(p)), rng)
  return [...new Set([...firsts, ...rest])].slice(0, 3)
}

function nearYears(year: number, seed: number): string[] {
  const rng = mulberry32(seed)
  const out = new Set<number>()
  while (out.size < 3) {
    const d = Math.ceil(rng() * 25) * (rng() < 0.5 ? -1 : 1)
    if (d !== 0) out.add(year + d)
  }
  return [...out].map(fmtYear)
}

function fmtYear(y: number): string {
  return y < 0 ? `${-y} av. J.-C.` : String(y)
}

let bank: BankQuestion[] | null = null

export function questionBank(): BankQuestion[] {
  if (bank) return bank
  const out: BankQuestion[] = []
  let n = 0
  const add = (cat: string, q: string, a: string, w: string[], big?: string) => {
    if (w.length < 3 || w.includes(a)) return
    out.push({ id: `q${n++}`, cat, q, a, w, big })
  }

  QUESTIONS.forEach((x) => add(x.cat, x.q, x.a, x.w))

  const sovereign = COUNTRIES.filter((c) => !c.territory && c.capital !== '—')
  const capitals = sovereign.map((c) => c.capital)
  const names = sovereign.map((c) => c.name)
  sovereign.forEach((c, i) => {
    const sameCont = sovereign.filter((o) => o.continent === c.continent)
    add('Géographie', 'Quelle est la capitale de ce pays ?', c.capital, distractors(capitals, c.capital, i * 7 + 1, sameCont.map((o) => o.capital)), c.name)
    add('Géographie', `De quel pays ${c.capital} est-elle la capitale ?`, c.name, distractors(names, c.name, i * 7 + 2, sameCont.map((o) => o.name)))
    add('Géographie', 'À quel pays appartient ce drapeau ?', c.name, distractors(names, c.name, i * 7 + 3, sameCont.map((o) => o.name)), flagEmoji(c.code))
    const conts = Object.entries(CONTINENT_NAMES)
      .filter(([k]) => k !== 'AN')
      .map(([, v]) => v)
    add('Géographie', `Sur quel continent se trouve ce pays : ${c.name} ?`, CONTINENT_NAMES[c.continent], distractors(conts, CONTINENT_NAMES[c.continent], i * 7 + 4))
  })

  const cityCountries = [...new Set(CITY_STATS.map((c) => countryName(c.cc)))]
  CITY_STATS.forEach((c, i) => {
    const country = countryName(c.cc)
    add('Géographie', `Dans quel pays se trouve la ville de ${c.name} ?`, country, distractors(cityCountries, country, 9000 + i))
  })

  const comparisons: [string, string, (s: (typeof COUNTRY_STATS)[number]) => number][] = [
    ['Lequel de ces pays est le plus peuplé ?', 'Géographie', (s) => s.pop],
    ['Lequel de ces pays est le plus vaste ?', 'Géographie', (s) => s.area],
    ['Lequel de ces pays a le point culminant le plus haut ?', 'Géographie', (s) => s.peak],
    ['Lequel de ces pays accueille le plus de touristes étrangers ?', 'Divers', (s) => s.tourists],
    ['Lequel de ces pays a le PIB le plus élevé ?', 'Divers', (s) => s.gdp],
    ['Lequel de ces pays a la plus forte espérance de vie ?', 'Divers', (s) => s.life],
  ]
  comparisons.forEach(([q, cat, value], k) => {
    const stats = COUNTRY_STATS.filter((s) => value(s) > 0)
    stats.forEach((s, i) => {
      const rng = mulberry32(20000 + k * 1000 + i)
      const others = shuffle(
        stats.filter((o) => o !== s),
        rng,
      ).slice(0, 3)
      const group = [s, ...others]
      const vals = group.map(value)
      if (new Set(vals).size < 4) return
      const best = group[vals.indexOf(Math.max(...vals))]
      add(cat, q, countryName(best.code), group.filter((g) => g !== best).map((g) => countryName(g.code)))
    })
  })

  const elNames = ELEMENTS.map((e) => e[2])
  const symbols = ELEMENTS.map((e) => e[1])
  ELEMENTS.forEach(([num, sym, name], i) => {
    add('Sciences', `Quel est le symbole chimique de l’élément « ${name} » ?`, sym, distractors(symbols, sym, 30000 + i, symbols.filter((s) => s[0] === sym[0])))
    add('Sciences', `Quel élément a pour symbole chimique « ${sym} » ?`, name, distractors(elNames, name, 31000 + i))
    const z = Number(num)
    const near = [z - 2, z - 1, z + 1, z + 2, z + 3].filter((x) => x > 0 && x <= 118).map(String)
    add('Sciences', `Quel est le numéro atomique de l’élément « ${name} » ?`, num, distractors(near, num, 32000 + i))
  })

  const depNames = DEPARTEMENTS.map((d) => d[1])
  const depNums = DEPARTEMENTS.map((d) => d[0])
  const prefs = DEPARTEMENTS.map((d) => d[2])
  DEPARTEMENTS.forEach(([num, name, pref], i) => {
    add('France', `Quel département porte le numéro ${num} ?`, name, distractors(depNames, name, 40000 + i))
    add('France', `Quel est le numéro du département « ${name} » ?`, num, distractors(depNums, num, 41000 + i))
    if (pref !== name) {
      add('France', `Quelle est la préfecture du département « ${name} » ?`, pref, distractors(prefs, pref, 42000 + i))
      add('France', `${pref} est la préfecture de quel département ?`, name, distractors(depNames, name, 43000 + i))
    }
  })

  const usCaps = US_CAPITALS.map((u) => u[1])
  US_CAPITALS.forEach(([state, cap], i) =>
    add('Géographie', `Quelle est la capitale de l’État américain « ${state} » ?`, cap, distractors(usCaps, cap, 44000 + i)),
  )

  const winners = [...new Set(WORLD_CUPS.map((w) => w[1]))]
  const hosts = [...new Set(WORLD_CUPS.map((w) => w[2]))]
  WORLD_CUPS.forEach(([year, winner, host], i) => {
    add('Sport', `Quel pays a remporté la Coupe du monde de football ${year} ?`, winner, distractors(winners, winner, 45000 + i))
    add('Sport', `Quel pays a organisé la Coupe du monde de football ${year} ?`, host, distractors(hosts, host, 46000 + i))
  })
  const olyCities = [...new Set(OLYMPICS.map((o) => o[1]))]
  OLYMPICS.forEach(([year, city, season], i) =>
    add('Sport', `Quelle ville a accueilli les Jeux olympiques d’${season} de ${year} ?`, city, distractors(olyCities, city, 47000 + i)),
  )

  const pairs: [string[][], string, string, string, number][] = [
    [BOOKS, 'Arts & Lettres', 'Qui a écrit « {w} » ?', 'Quelle œuvre a été écrite par {p} ?', 50000],
    [PAINTINGS, 'Arts & Lettres', 'Qui est l’auteur de l’œuvre « {w} » ?', 'Quelle œuvre doit-on à {p} ?', 52000],
    [MUSIC, 'Cinéma & Musique', 'Qui a composé ou interprété « {w} » ?', 'Quelle œuvre doit-on à {p} ?', 54000],
    [FILMS, 'Cinéma & Musique', 'Qui a réalisé le film « {w} » ?', 'Quel film a été réalisé par {p} ?', 56000],
    [INVENTIONS, 'Sciences', 'À qui doit-on {w} ?', 'Quelle invention ou découverte doit-on à {p} ?', 58000],
  ]
  for (const [table, cat, qWork, qPerson, seed] of pairs) {
    const people = [...new Set(table.map((r) => r[1]))]
    const works = table.map((r) => r[0])
    table.forEach(([work, person], i) => {
      add(cat, qWork.replace('{w}', seed === 58000 ? work.charAt(0).toLowerCase() + work.slice(1) : work), person, distractors(people, person, seed + i))
      const own = table.filter((r) => r[1] === person).map((r) => r[0])
      if (own[0] === work)
        add(cat, qPerson.replace('{p}', person), work, distractors(works.filter((x) => !own.includes(x)), work, seed + 900 + i))
    })
  }

  EVENTS.forEach(([event, y], i) => {
    const year = Number(y)
    add('Histoire', `En quelle année : ${event} ?`, fmtYear(year), nearYears(year, 60000 + i))
  })

  const currencies = [...new Set(CURRENCIES.map((c) => c[1]))]
  CURRENCIES.forEach(([country, cur], i) => add('Divers', `Quelle est la monnaie officielle du pays suivant : ${country} ?`, cur, distractors(currencies, cur, 62000 + i)))
  const langs = [...new Set(LANGUAGES.map((l) => l[1]))]
  LANGUAGES.forEach(([country, lang], i) => add('Divers', `Quelle est la langue officielle du pays suivant : ${country} ?`, lang, distractors(langs, lang, 63000 + i)))

  const young = ANIMALS.map((a) => a[1])
  const cries = [...new Set(ANIMALS.map((a) => a[2]).filter(Boolean))]
  ANIMALS.forEach(([animal, baby, cry], i) => {
    add('Nature', `Comment appelle-t-on le petit de ${animal} ?`, baby, distractors(young, baby, 64000 + i))
    if (cry) add('Nature', `Quel verbe désigne le cri de ${animal} ?`, cry, distractors(cries, cry, 65000 + i))
  })

  bank = out
  return bank
}
