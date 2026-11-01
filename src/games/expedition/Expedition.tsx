// L'Expédition, le jeu signature d'Expedle : un voyage de 5 à 7 pays par jour, un visa à chaque frontière, un tampon
// à chaque visa. Le passeport se remplit sous les yeux du joueur, page après page. Aussi le Tour du monde, sans fin, et
// la carte de ses voyages.
import { geoAzimuthalEqualArea, geoAzimuthalEquidistant, geoPath } from 'd3-geo'
import type { FeatureCollection, Polygon } from 'geojson'
import { useEffect, useMemo, useRef, useState } from 'react'
import { worldAtlas, type Atlas } from '../../geo/atlas'
import { flagEmoji } from '../../geo/countries'
import { countryCenter, distanceKm } from '../../geo/measure'
import { Emblem } from '../../hub/passport/pages'
import '../../hub/passport.css'
import { readChallenge } from '../../lib/challenge'
import { useDuelProgress } from '../../lib/duelRoom'
import { feedback } from '../../lib/feedback'
import { plural, t } from '../../lib/i18n'
import { coverage, passport, stamp } from '../../lib/passport'
import { bestScore, dailyResult, recordPlay, saveDailyResult, submitBest, useStopwatch } from '../../lib/stats'
import { copyText, hashString, load, save, seededRng, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import GameHud from '../../ui/GameHud'
import Mascot from '../../ui/Mascot'
import NextGame from '../../ui/NextGame'
import StampArt, { InkFilter, inkOf, shapeOf } from '../../ui/StampArt'
import Carnet from './Carnet'
import { answer, CHANCES, choices, dailyTrip, here, left, nextCountry, remark, score, shareText, stars, startRun, status, tourTrip, type Run, type Trip } from './game'
import { saveTrip } from './trips'
import './expedition.css'

// le temps de chaque geste : le tampon qui s'abat, le refus, la page qui tourne, l'arrivée
const STAMP_MS = 1150
const REFUSE_MS = 1800
const FLIP_MS = 850
const CLOSE_MS = 1700
const DROP_MS = 220
const IMPACT_MS = 440
const GOLD = '#a8792a'
const MAP_W = 300
const MAP_H = 220

// La silhouette d'un pays : sa masse principale et ses terres proches, sans les territoires lointains (la Guyane
// n'aide pas à reconnaître la France).
function Shape({ atlas, code, size = 150 }: { atlas: Atlas; code: string; size?: number }) {
  const d = useMemo(() => {
    const parts = atlas.parts.filter((p) => p.code === code)
    const main = parts.reduce((a, b) => (b.area > a.area ? b : a))
    const near: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: parts.filter((p) => distanceKm(p.centroid, main.centroid) < 3500).map((p) => p.feature) }
    const projection = geoAzimuthalEqualArea()
      .rotate([-main.centroid[0], -main.centroid[1]])
      .fitExtent(
        [
          [6, 6],
          [size - 6, size - 6],
        ],
        near,
      )
    return geoPath(projection)(near) ?? ''
  }, [atlas, code, size])
  return (
    <svg className="xp-silhouette" viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <path d={d} />
    </svg>
  )
}

// La carte du visa : le pays d'où l'on vient, et celui à reconnaître, en or, au milieu de ses voisins.
function VisaMap({ atlas, from, to }: { atlas: Atlas; from: string; to: string }) {
  const draw = useMemo(() => {
    const [a, b] = [countryCenter(atlas, from), countryCenter(atlas, to)]
    const focus: FeatureCollection = { type: 'FeatureCollection', features: [from, to].flatMap((c) => atlas.features.get(c) ?? []) }
    const projection = geoAzimuthalEquidistant()
      .rotate([-(a[0] + b[0]) / 2, -(a[1] + b[1]) / 2])
      .clipAngle(100)
      .fitExtent(
        [
          [24, 24],
          [MAP_W - 24, MAP_H - 24],
        ],
        focus,
      )
    return geoPath(projection)
  }, [atlas, from, to])
  return (
    <svg className="xp-map" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden>
      {[...atlas.features].map(([code, f]) => (
        <path key={code} d={draw(f) ?? ''} className={code === to ? 'next' : code === from ? 'from' : ''} />
      ))}
    </svg>
  )
}

// Le tampon en bois qui s'abat sur la page, à l'encre du pays.
function StampTool({ ink }: { ink: string }) {
  return (
    <svg className="xp-tool" viewBox="0 0 100 120" aria-hidden>
      <defs>
        <linearGradient id="xp-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b98457" />
          <stop offset="1" stopColor="#5e3b22" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="20" rx="21" ry="17" fill="url(#xp-wood)" />
      <rect x="42" y="33" width="16" height="33" rx="5" fill="#6b4a2e" />
      <rect x="15" y="64" width="70" height="22" rx="6" fill="#2d2621" />
      <rect x="11" y="84" width="78" height="10" rx="3" fill={ink} />
    </svg>
  )
}

interface Question {
  // le numéro du visa : la frontière du voyage qu'il ouvre
  n: number
  from: string
  to: string
  options: string[]
}

// La route en haut du passeport : le départ, une case par frontière, et Pépite sur la case à venir.
function Journey({ trip, run }: { trip: Trip; run: Run }) {
  const crossed = run.path.length - 1
  const slots = trip.end ? trip.route.slice(1) : [...run.path.slice(1).slice(-6), '']
  const offset = trip.end ? 0 : Math.max(0, crossed - 6)
  const at = Math.min(crossed - offset, slots.length - 1)
  return (
    <ol className="xp-journey" aria-label={trip.end ? t('{n} frontières sur {total}', { n: crossed, total: slots.length }) : plural(crossed, '{n} tampon', '{n} tampons')}>
      <li className="flag">{flagEmoji(trip.start)}</li>
      {slots.map((code, i) => {
        const done = i + offset < crossed
        const wrong = done && run.picks[i + offset] !== run.path[i + offset + 1]
        const goal = !!trip.end && i === slots.length - 1
        return (
          <li key={i} className={done ? (wrong ? 'done wrong' : 'done') : i === at ? 'now' : goal ? 'goal' : ''} style={done ? { ['--ink' as string]: inkOf(code) } : undefined}>
            {done || goal ? flagEmoji(code) : ''}
            {i === at && run.mistakes < CHANCES && (
              <span className="xp-pep" key={crossed}>
                <Mascot size={24} />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// Une page de visa : la silhouette du pays et sa place sur la carte, puis quatre noms. Une fois répondu, le tampon
// (ou le refus) s'y imprime.
function VisaPage({
  atlas,
  q,
  label,
  picked,
  phase,
  gold,
  time,
  onPick,
}: {
  atlas: Atlas
  q: Question
  label: string
  picked: string | null
  phase: string
  gold: boolean
  time: number
  onPick?: (code: string) => void
}) {
  const name = (c: string) => atlas.name(c)
  const ok = picked === q.to
  return (
    <div className="pp-paper xp-visa">
      <div className="pp-watermark" aria-hidden />
      <div className="xp-visa-head">
        <span>{t('VISA')}</span>
        <span>{label}</span>
      </div>
      <div className="xp-visa-body">
        <Shape atlas={atlas} code={q.to} />
        <VisaMap atlas={atlas} from={q.from} to={q.to} />
      </div>
      <p className="xp-q">{t('Quel est ce pays ?')}</p>
      <div className="xp-options">
        {q.options.map((o) => (
          <button key={o} disabled={!!picked || !onPick} className={!picked ? '' : o === q.to ? 'right' : o === picked ? 'wrong' : 'dim'} onClick={() => onPick?.(o)}>
            {name(o)}
          </button>
        ))}
      </div>
      {picked && ok && (
        <div className={`pp-stamp xp-ink shape-${shapeOf(q.to)}`} style={{ color: gold ? GOLD : inkOf(q.to) }}>
          <StampArt code={q.to} time={time} line={t('L’EXPÉDITION')} />
        </div>
      )}
      {picked && !ok && phase !== 'ask' && <div className="xp-refused">{t('REFUSÉ')}</div>}
      {picked && !ok && <p className="xp-note">{t('C’était {country}.', { country: name(q.to) })}</p>}
    </div>
  )
}

// La page souvenir : les tampons du voyage, qui retombent un à un ; le dernier, à l'arrivée, est doré.
function Souvenir({ atlas, trip, run, day, arrived, time }: { atlas: Atlas; trip: Trip; run: Run; day: string; arrived: boolean; time: number }) {
  const [, m, d] = day.split('-')
  const stamps = run.path.slice(1).slice(-8)
  return (
    <div className="pp-paper xp-souvenir">
      <div className="pp-watermark" aria-hidden />
      <div className="xp-visa-head">
        <span>{trip.end ? t('Voyage du {date}', { date: `${d}/${m}` }) : t('Tour du monde')}</span>
        <span>{plural(stamps.length, '{n} tampon', '{n} tampons')}</span>
      </div>
      {trip.end && (
        <p className="xp-souvenir-route">
          {atlas.name(trip.start)} → {atlas.name(trip.end)}
        </p>
      )}
      {stamps.map((code, i) => {
        const h = hashString(code + i)
        const last = arrived && i === stamps.length - 1
        return (
          <div
            key={`${code}${i}`}
            className={`pp-stamp xp-drop shape-${shapeOf(code)}`}
            style={{
              left: `${5 + (i % 2) * 47 + (h % 7)}%`,
              top: `${17 + Math.floor(i / 2) * 20 + ((h >> 4) % 5)}%`,
              rotate: `${((h >> 7) % 21) - 10}deg`,
              color: last ? GOLD : inkOf(code),
              animationDelay: `${0.55 + (i * DROP_MS) / 1000}s`,
            }}
          >
            <StampArt code={code} time={time} line={t('L’EXPÉDITION')} />
          </div>
        )
      })}
      {!arrived && <div className="xp-refused xp-halt">{t('VOYAGE INTERROMPU')}</div>}
    </div>
  )
}

// La première fois : le voyage, le visa, les chances, en trois cartes.
function Intro({ trip, atlas, onDone }: { trip: Trip; atlas: Atlas; onDone: () => void }) {
  const [step, setStep] = useState(0)
  const cards = [
    {
      title: t('Ton voyage du jour'),
      text: trip.end
        ? t('{start} → {end} : {n} frontières à passer.', { start: atlas.name(trip.start), end: atlas.name(trip.end), n: trip.route.length - 1 })
        : t('Départ : {start}. Va aussi loin que possible.', { start: atlas.name(trip.start) }),
      art: `${flagEmoji(trip.start)} ✈ ${trip.end ? flagEmoji(trip.end) : '🌍'}`,
    },
    { title: t('À chaque frontière, un visa'), text: t('Reconnais le pays à sa forme et à sa place sur la carte : tu gagnes son tampon.'), art: '🛂' },
    { title: t('Trois chances'), text: t('Une erreur ne t’arrête pas, mais à la troisième, le voyage s’interrompt.'), art: '❤️ ❤️ ❤️' },
  ]
  const card = cards[step]
  return (
    <div className="xp-intro" role="dialog" aria-label={card.title}>
      <div className="xp-intro-card" key={step}>
        <span className="xp-intro-art" aria-hidden>
          {card.art}
        </span>
        <h2>{card.title}</h2>
        <p>{card.text}</p>
        <div className="xp-intro-dots" aria-hidden>
          {cards.map((_, i) => (
            <i key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <div className="ex-actions">
          <button className="ui-btn" onClick={() => (step < cards.length - 1 ? setStep(step + 1) : onDone())}>
            {step < cards.length - 1 ? t('Suivant') : t('C’est parti !')}
          </button>
          {step < cards.length - 1 && (
            <button className="ex-link" onClick={onDone}>
              {t('Passer')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

type Phase = 'ask' | 'stamp' | 'refuse' | 'flip' | 'close' | 'souvenir' | 'fin'

function Play({ atlas, tour }: { atlas: Atlas; tour: boolean }) {
  const [challenge] = useState(readChallenge)
  const day = todayKey()
  const seed = challenge?.seed ?? day
  const official = !tour && !challenge
  const pool = atlas.playable
  const [tourSeed] = useState(() => `tour-${Math.random().toString(36).slice(2, 8)}`)
  const [trip] = useState<Trip>(() => {
    if (!tour) return dailyTrip(atlas.neighbors, pool, atlas.region, seed)
    const starts = pool.filter((c) => atlas.neighbors.get(c)?.size)
    return tourTrip(starts[Math.floor(Math.random() * starts.length)])
  })
  // le voyage du jour reprend où on l'a laissé ; le Tour du monde repart de zéro
  const key = tour ? null : `expedition:v2:${seed}`
  const [run, setRun] = useState<Run>(() => (key && load<Run | null>(key, null)) || startRun(trip))
  const nextOf = (r: Run) => (status(trip, r) === 'en route' ? nextCountry(atlas.neighbors, trip, r, tour ? tourSeed : seed) : null)
  const questionOf = (r: Run): Question | null => {
    const to = nextOf(r)
    return to ? { n: r.path.length, from: here(r), to, options: choices(atlas.neighbors, atlas.region, pool, here(r), to, seededRng(`${tour ? tourSeed : seed}:${r.path.length}:${to}`)) } : null
  }
  const [q, setQ] = useState<Question | null>(() => questionOf(run))
  const [under, setUnder] = useState<Question | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const done = !q
  const [phase, setPhase] = useState<Phase>(done ? 'fin' : 'ask')
  const [intro, setIntro] = useState(() => !done && !load<boolean>('expedition-intro', false))
  const [fresh, setFresh] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  // la date imprimée sur les tampons du voyage
  const [now] = useState(Date.now)
  const elapsed = useStopwatch()
  const ended = useRef(done)
  const timers = useRef<number[]>([])
  const after = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const st = status(trip, run)
  const arrived = st === 'arrivé'
  useDuelProgress(challenge && st === 'en route' ? { left: left(trip, run), unit: 'frontieres' } : null)

  // la fin, inscrite une seule fois : historique, résultat du jour, passeport, carte des voyages
  function finish(r: Run) {
    if (ended.current) return
    ended.current = true
    const ms = elapsed()
    const ok = status(trip, r) === 'arrivé'
    const before = coverage(passport()).stamped
    stamp(r.path.slice(1), 'expedition')
    setFresh(coverage(passport()).stamped - before)
    if (tour) {
      const n = r.path.length - 1
      submitBest('expedition-tour', n)
      recordPlay('expedition-tour', { pts: Math.min(100, n * 5), s: n, ms, sub: 'libre' })
    } else {
      if (official && !dailyResult('expedition', day)) saveDailyResult('expedition', { won: ok, steps: r.path.length - 1, mistakes: r.mistakes }, day)
      recordPlay('expedition', { pts: score(trip, r), s: r.mistakes, win: ok, ms, sub: challenge ? 'defi' : undefined })
    }
    saveTrip({ day, start: trip.start, end: trip.end, path: r.path, arrived: ok, tour, at: Date.now() })
  }

  // le voyage fini : le livret se referme, puis se rouvre sur la page souvenir où retombent les tampons
  function closeTrip(r: Run) {
    setPhase('close')
    after(CLOSE_MS, () => {
      setPhase('souvenir')
      r.path.slice(1).slice(-8).forEach((_, i) => after(550 + i * DROP_MS + 120, () => feedback('stamp')))
      after(550 + Math.min(8, r.path.length - 1) * DROP_MS + 700, () => {
        finish(r)
        setPhase('fin')
      })
    })
  }

  function choose(code: string) {
    if (phase !== 'ask' || !q) return
    const next = answer(run, q.to, code)
    const ok = code === q.to
    setPicked(code)
    setRun(next)
    if (key) save(key, next)
    const following = questionOf(next)
    if (ok) {
      setPhase('stamp')
      after(IMPACT_MS, () => feedback('stamp'))
    } else {
      setPhase('refuse')
      feedback('bad')
      after(120, () => feedback('stamp'))
    }
    after(ok ? STAMP_MS : REFUSE_MS, () => {
      if (!following) return closeTrip(next)
      setUnder(following)
      setPhase('flip')
      feedback('page')
      after(FLIP_MS, () => {
        setQ(following)
        setUnder(null)
        setPicked(null)
        setPhase('ask')
      })
    })
  }

  async function share() {
    const text = tour
      ? `🧭 ${t('Tour du monde')} · ${plural(run.path.length - 1, '{n} tampon', '{n} tampons')}\n${run.path.map(flagEmoji).join('')}\nexpedle.com`
      : shareText(trip, run, seed, (c) => atlas.name(c))
    setCopied(await copyText(text))
    window.setTimeout(() => setCopied(false), 1800)
  }

  const crossed = run.path.length - 1
  const total = trip.route.length - 1
  const label = (v: Question) => (trip.end ? `${v.n} / ${total}` : `N° ${v.n}`)
  const lastIsGoal = !!q && q.to === trip.end
  const showSouvenir = phase === 'close' || phase === 'souvenir' || phase === 'fin'
  const s = stars(trip, run)
  const cov = coverage(passport())

  return (
    <div className="ex">
      <InkFilter />
      <AppBar title={t('L’Expédition')}>
        <SubLink href="#/expedition" active={!tour}>
          {t('Du jour')}
        </SubLink>
        <SubLink href="#/expedition/tour" active={tour}>
          {t('Tour du monde')}
        </SubLink>
        <SubLink href="#/expedition/carte">{t('Ma carte')}</SubLink>
      </AppBar>
      <main className="ex-main">
        <header className="ex-head">
          <h1>{tour ? t('Tour du monde') : `${flagEmoji(trip.start)} ${atlas.name(trip.start)} → ${atlas.name(trip.end)} ${flagEmoji(trip.end)}`}</h1>
          {st === 'en route' && <p>{tour ? t('Reconnais chaque pays et va aussi loin que possible.') : t('Reconnais chaque pays pour obtenir ton visa.')}</p>}
        </header>

        <GameHud
          steps={[...run.picks.map((p, i) => p === run.path[i + 1]), ...(st === 'en route' ? [null] : [])]}
          trail={tour ? 12 : undefined}
          label={tour ? plural(crossed, '{n} tampon', '{n} tampons') : t('{n} frontières sur {total}', { n: crossed, total })}
          lives={{ left: CHANCES - run.mistakes, total: CHANCES }}
          say={remark(trip, run, tour ? bestScore('expedition-tour') : null)}
        />

        <Journey trip={trip} run={run} />

        <div className="xp-book">
          {(showSouvenir || under) && (
            <div className="xp-page">
              {showSouvenir ? (
                <Souvenir atlas={atlas} trip={trip} run={run} day={seed} arrived={arrived} time={now} />
              ) : (
                <VisaPage atlas={atlas} q={under!} label={label(under!)} picked={null} phase="ask" gold={false} time={now} />
              )}
            </div>
          )}
          {q && phase !== 'souvenir' && phase !== 'fin' && (
            <div className={`xp-page top${phase === 'flip' ? ' flip' : ''}${phase === 'stamp' ? ' hit' : ''}`}>
              <VisaPage atlas={atlas} q={q} label={label(q)} picked={picked} phase={phase} gold={lastIsGoal} time={now} onPick={phase === 'ask' && !intro ? choose : undefined} />
              {phase === 'stamp' && <StampTool ink={lastIsGoal ? GOLD : inkOf(q.to)} />}
            </div>
          )}
          {(phase === 'close' || phase === 'souvenir') && (
            <div className={`xp-cover${phase === 'souvenir' ? ' open' : ''}`}>
              <div className="pp-leather">
                <span className="pp-gold pp-cover-country">{t('République d’Expedle')}</span>
                <Emblem />
                <span className="pp-gold xp-cover-title">{arrived ? t('Voyage accompli') : t('Fin du voyage')}</span>
                <span className="pp-gold pp-cover-sub">{tour ? plural(crossed, '{n} tampon', '{n} tampons') : `${atlas.name(trip.start)} → ${atlas.name(trip.end)}`}</span>
              </div>
            </div>
          )}
          {intro && (
            <Intro
              trip={trip}
              atlas={atlas}
              onDone={() => {
                setIntro(false)
                save('expedition-intro', true)
              }}
            />
          )}
        </div>

        {phase === 'fin' && (
          <section className="ex-end">
            <h2>
              {tour
                ? t('Tour du monde : {n} tampons', { n: crossed })
                : arrived
                  ? t('Arrivé : {country} !', { country: atlas.name(trip.end) })
                  : t('Voyage interrompu : {country}', { country: atlas.name(here(run)) })}
            </h2>
            {!tour && (
              <p className="ex-stars" aria-label={plural(s, '{n} étoile sur 3', '{n} étoiles sur 3')}>
                {'★'.repeat(s)}
                <span>{'★'.repeat(CHANCES - s)}</span>
              </p>
            )}
            <p className="ex-flags">{run.path.map(flagEmoji).join(' ')}</p>
            <dl className="ex-facts">
              <div>
                <dt>{t('Pays tamponnés')}</dt>
                <dd>{crossed}</dd>
              </div>
              <div>
                <dt>{t('Erreurs')}</dt>
                <dd>
                  {run.mistakes} / {CHANCES}
                </dd>
              </div>
              {tour && bestScore('expedition-tour') !== null && (
                <div>
                  <dt>{t('Ton record')}</dt>
                  <dd>{plural(bestScore('expedition-tour')!, '{n} tampon', '{n} tampons')}</dd>
                </div>
              )}
              <div>
                <dt>{t('Ton passeport')}</dt>
                <dd>
                  {fresh ? <b className="gold">{plural(fresh, '+{n} nouveau', '+{n} nouveaux')} · </b> : null}
                  {t('{n} pays sur {total}', { n: cov.stamped, total: cov.total })}
                </dd>
              </div>
            </dl>
            <div className="ex-actions">
              <button className="ui-btn" onClick={share}>
                {copied ? t('Résultat copié !') : t('Partager le voyage')}
              </button>
              {tour ? (
                <button className="ui-btn line" onClick={() => (window.location.hash = `#/expedition/tour?r=${Date.now()}`)}>
                  {t('Encore un tour')}
                </button>
              ) : (
                <a className="ui-btn line" href="#/expedition/tour">
                  {t('Tour du monde')}
                </a>
              )}
              <a className="ui-btn line" href="#/passeport">
                {t('Mon passeport')}
              </a>
            </div>
            {tour ? <NextGame /> : <ChallengeBox game="expedition" path="/expedition" seed={seed} result={{ pts: score(trip, run), s: run.mistakes, win: arrived, ms: 0 }} />}
          </section>
        )}
      </main>
    </div>
  )
}

export default function Expedition({ mode }: { mode?: string }) {
  const atlas = worldAtlas()
  if (mode === 'carte') return <Carnet atlas={atlas} />
  return <Play atlas={atlas} tour={mode === 'tour'} />
}
