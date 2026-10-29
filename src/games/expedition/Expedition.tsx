// L'Expédition, le jeu signature d'Expedle : chaque jour, relier deux pays par la terre en passant les frontières, en
// reconnaissant chaque pays à la douane. Aussi le Tour du monde, sans destination, et la carte de ses expéditions.
import { geoAzimuthalEqualArea, geoAzimuthalEquidistant, geoPath } from 'd3-geo'
import type { FeatureCollection, Polygon } from 'geojson'
import { useMemo, useRef, useState } from 'react'
import { worldAtlas, type Atlas } from '../../geo/atlas'
import { COUNTRY_BY_CODE, flagEmoji } from '../../geo/countries'
import { countryCenter, distanceKm, rhumbBearing } from '../../geo/measure'
import { readChallenge } from '../../lib/challenge'
import { feedback, runOf } from '../../lib/feedback'
import { fmt, msg, plural, t } from '../../lib/i18n'
import { stamp } from '../../lib/passport'
import { bestScore, dailyResult, recordPlay, saveDailyResult, submitBest, useStopwatch } from '../../lib/stats'
import { copyText, load, save, seededRng, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import GameHud from '../../ui/GameHud'
import Mascot from '../../ui/Mascot'
import NextGame from '../../ui/NextGame'
import { COUNTRY_STATS } from '../classement/data'
import Carnet from './Carnet'
import {
  answerCustoms,
  bordersOf,
  choices,
  closedBetween,
  cross,
  customsDue,
  customsQuestion,
  dailyExpedition,
  here,
  hops,
  known,
  miss,
  score,
  shareText,
  stars,
  startRun,
  status,
  tourExpedition,
  visited,
  type CustomsQuestion,
  type Expedition as Plan,
  type Run,
} from './game'
import { saveTrip } from './trips'
import './expedition.css'

const POP = new Map(COUNTRY_STATS.map((s) => [s.code, s.pop]))
const capital = (c: string) => COUNTRY_BY_CODE.get(c)?.capital ?? ''

const WINDS = [msg('nord'), msg('nord-est'), msg('est'), msg('sud-est'), msg('sud'), msg('sud-ouest'), msg('ouest'), msg('nord-ouest')]
const windOf = (deg: number) => WINDS[Math.round(deg / 45) % 8]

// le sac de vivres, dans la jauge du bandeau
function Bag() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden className="ex-bag">
      <path d="M8 7V5.5a4 4 0 0 1 8 0V7M5.5 9.5A2.5 2.5 0 0 1 8 7h8a2.5 2.5 0 0 1 2.5 2.5V19a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM9 14h6" />
    </svg>
  )
}

// La silhouette d'un pays : sa masse principale et ses terres proches, sans les territoires lointains (la Guyane
// n'aide pas à reconnaître la France).
function Shape({ atlas, code, size = 72 }: { atlas: Atlas; code: string; size?: number }) {
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
    <svg className="ex-shape" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
      <path d={d} />
    </svg>
  )
}

const W = 640
const H = 380

// La carte de l'expédition, centrée sur le pays où l'on se trouve : ses voisins se touchent pour passer la frontière,
// le chemin parcouru se dessine, et la destination, hors de vue, se signale au bord par une flèche.
function ExMap({ atlas, exp, run, onPick }: { atlas: Atlas; exp: Plan; run: Run; onPick?: (code: string) => void }) {
  const at = here(run)
  const view = useMemo(() => {
    const [lon, lat] = countryCenter(atlas, at)
    const focus = [at, ...bordersOf(atlas.neighbors, at), ...run.path.slice(-3)]
    const fc: FeatureCollection = { type: 'FeatureCollection', features: focus.flatMap((c) => atlas.features.get(c) ?? []) }
    const projection = geoAzimuthalEquidistant()
      .rotate([-lon, -lat])
      .clipAngle(100)
      .fitExtent(
        [
          [28, 28],
          [W - 28, H - 28],
        ],
        fc,
      )
    return { projection, path: geoPath(projection) }
  }, [atlas, at, run.path])

  const borders = new Set(bordersOf(atlas.neighbors, at, exp.closed))
  const point = (c: string) => view.projection(countryCenter(atlas, c))
  const trail = run.path.map(point).filter((p): p is [number, number] => !!p)
  const me = point(at) ?? [W / 2, H / 2]
  const goal = exp.end ? point(exp.end) : null
  const goalInView = !!goal && goal[0] > 12 && goal[0] < W - 12 && goal[1] > 12 && goal[1] < H - 12
  // la destination hors de vue : une flèche au bord de la carte, dans la direction où elle se trouve
  let arrow: { x: number; y: number; deg: number } | null = null
  if (exp.end && !goalInView) {
    const deg = rhumbBearing(countryCenter(atlas, at), countryCenter(atlas, exp.end))
    const [dx, dy] = [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)]
    const reach = Math.min(dx ? ((dx > 0 ? W - 22 : 22) - me[0]) / dx : Infinity, dy ? ((dy > 0 ? H - 22 : 22) - me[1]) / dy : Infinity)
    arrow = { x: me[0] + dx * reach, y: me[1] + dy * reach, deg }
  }

  return (
    <div className="ex-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Carte de l’expédition')}>
        {[...atlas.features].map(([code, f]) => {
          const cls = code === at ? 'here' : borders.has(code) ? 'border' : run.path.includes(code) ? 'trail' : code === exp.end ? 'goal' : ''
          const pick = borders.has(code) && onPick ? () => onPick(code) : undefined
          return <path key={code} d={view.path(f) ?? ''} className={cls} onClick={pick} />
        })}
        {trail.length > 1 && <polyline className="ex-route" points={trail.map((p) => p.join(',')).join(' ')} />}
        {goalInView && goal && <circle className="ex-beacon" cx={goal[0]} cy={goal[1]} r={10} />}
        {arrow && (
          <g transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.deg})`} className="ex-arrow">
            <path d="M0 -12 L9 6 L0 2 L-9 6 Z" />
          </g>
        )}
      </svg>
      <span key={at} className="ex-me" style={{ left: `${(me[0] / W) * 100}%`, top: `${(me[1] / H) * 100}%` }}>
        <Mascot size={30} />
      </span>
    </div>
  )
}

interface Saved {
  run: Run
  // chaque passage à la douane, juste ou faux, pour le bandeau
  log: boolean[]
}

interface Desk {
  to: string
  options: string[]
  picked?: string
}

function Play({ atlas, tour }: { atlas: Atlas; tour: boolean }) {
  const [challenge] = useState(readChallenge)
  const day = todayKey()
  const seed = challenge?.seed ?? day
  const official = !tour && !challenge
  const pool = atlas.playable
  const [exp] = useState(() => {
    if (!tour) return dailyExpedition(atlas.neighbors, pool, atlas.region, seed)
    const starts = pool.filter((c) => atlas.neighbors.get(c)?.size)
    return tourExpedition(starts[Math.floor(Math.random() * starts.length)])
  })
  // l'expédition du jour reprend où on l'a laissée ; le Tour du monde repart de zéro
  const key = tour ? null : `expedition:${seed}`
  const [{ run, log }, setState] = useState<Saved>(() => (key && load<Saved | null>(key, null)) || { run: startRun(exp), log: [] })
  const [desk, setDesk] = useState<Desk | null>(null)
  const [bonus, setBonus] = useState<{ q: CustomsQuestion; code: string; picked?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const elapsed = useStopwatch()
  const st = status(exp, run)
  const at = here(run)
  const name = (c: string) => atlas.name(c)
  const ended = useRef(st !== 'en route')

  function update(next: Saved) {
    setState(next)
    if (key) save(key, next)
  }

  // la fin, inscrite une seule fois : historique, résultat du jour, carte de ses expéditions
  function finish(next: Run) {
    if (ended.current) return
    ended.current = true
    const ms = elapsed()
    const arrived = status(exp, next) === 'arrivé'
    if (tour) {
      const n = visited(next)
      submitBest('expedition-tour', n)
      recordPlay('expedition-tour', { pts: Math.min(100, n * 4), s: n, ms, sub: 'libre' })
    } else {
      if (official && !dailyResult('expedition', day)) saveDailyResult('expedition', { won: arrived, steps: next.path.length - 1, supplies: next.supplies }, day)
      recordPlay('expedition', { pts: score(atlas.neighbors, exp, next), s: next.path.length - 1, win: arrived, ms, sub: challenge ? 'defi' : undefined })
    }
    saveTrip({ day, start: exp.start, end: exp.end, path: next.path, arrived, tour, at: Date.now() })
  }

  function pass(to: string, logged: boolean[]) {
    const next = cross(exp, run, to)
    stamp(to, 'expedition')
    update({ run: next, log: logged })
    if (status(exp, next) !== 'en route') return finish(next)
    if (customsDue(next)) setBonus({ q: customsQuestion(to, at, pool, atlas.region, capital, (c) => POP.get(c), seededRng(`${seed}:douane:${next.path.length}`)), code: to })
  }

  function choose(to: string) {
    if (known(run, to)) return pass(to, log)
    setDesk({ to, options: choices(atlas.neighbors, atlas.region, pool, at, to, seededRng(`${seed}:${run.path.length}:${to}`)) })
  }

  function answer(opt: string) {
    if (!desk || desk.picked) return
    const ok = opt === desk.to
    feedback(ok ? 'good' : 'bad', runOf(log))
    setDesk({ ...desk, picked: opt })
    window.setTimeout(
      () => {
        setDesk(null)
        if (ok) return pass(desk.to, [...log, true])
        const next = miss(run, desk.to)
        update({ run: next, log: [...log, false] })
        if (status(exp, next) !== 'en route') finish(next)
      },
      ok ? 900 : 1400,
    )
  }

  function answerBonus(opt: string) {
    if (!bonus || bonus.picked) return
    const ok = opt === bonus.q.answer
    feedback(ok ? 'good' : 'bad')
    setBonus({ ...bonus, picked: opt })
    window.setTimeout(() => {
      setBonus(null)
      update({ run: answerCustoms(run, ok), log })
    }, 1300)
  }

  async function share() {
    const text = tour
      ? `🧭 ${t('Tour du monde')} · ${plural(visited(run), '{n} pays traversé', '{n} pays traversés')}\n${run.path.map(flagEmoji).join('')}\nexpedle.com`
      : shareText(exp, run, seed, name)
    setCopied(await copyText(text))
    window.setTimeout(() => setCopied(false), 1800)
  }

  const crossed = run.path.length - 1
  const left = exp.end ? hops(atlas.neighbors, at, exp.closed).get(exp.end) : undefined
  const borders = bordersOf(atlas.neighbors, at)
  const center = countryCenter(atlas, at)
  const playing = st === 'en route' && !desk && !bonus

  return (
    <div className="ex">
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
          <h1>{tour ? t('Tour du monde') : `${name(exp.start)} → ${name(exp.end)}`}</h1>
          {st === 'en route' && (
            <p>
              {tour
                ? t('Passe le plus de frontières possible avant d’être à court de vivres.')
                : `${t('{goal} à {km} km, direction {wind}', {
                    goal: name(exp.end),
                    km: fmt(Math.round(distanceKm(center, countryCenter(atlas, exp.end)) / 100) * 100),
                    wind: t(windOf(rhumbBearing(center, countryCenter(atlas, exp.end)))),
                  })}${left === undefined ? '' : ` · ${plural(left, 'encore {n} frontière au moins', 'encore {n} frontières au moins')}`}`}
            </p>
          )}
        </header>

        <GameHud
          steps={[...log, ...(st === 'en route' ? [null] : [])]}
          trail={12}
          label={tour ? plural(visited(run), '{n} pays traversé', '{n} pays traversés') : plural(crossed, '{n} frontière passée', '{n} frontières passées')}
          gauge={{ value: Math.max(0, run.supplies), max: Math.max(exp.supplies, run.supplies), icon: <Bag /> }}
        />

        <ExMap atlas={atlas} exp={exp} run={run} onPick={playing ? choose : undefined} />

        {playing && (
          <section className="ex-borders">
            <h2>{t('Quelle frontière passer ?')}</h2>
            <div className="ex-cards">
              {borders.map((n) => {
                const shut = closedBetween(exp.closed, at, n)
                const cache = n === exp.cache && !run.cacheTaken
                return (
                  <button key={n} className={shut ? 'ex-card shut' : run.path.includes(n) ? 'ex-card seen' : 'ex-card'} disabled={shut} onClick={() => choose(n)}>
                    <Shape atlas={atlas} code={n} />
                    <b>{known(run, n) ? name(n) : '?'}</b>
                    <small>{shut ? t('Frontière fermée aujourd’hui') : t(windOf(rhumbBearing(center, countryCenter(atlas, n))))}</small>
                    {cache && <span className="ex-cache">{t('Vivres +2')}</span>}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {desk && (
          <section className="ex-desk" key={desk.to}>
            <small>{t('Douane')}</small>
            <h2>{t('Ce pays, c’est… ?')}</h2>
            <Shape atlas={atlas} code={desk.to} size={150} />
            <div className="ex-options">
              {desk.options.map((o) => (
                <button key={o} className={!desk.picked ? '' : o === desk.to ? 'right' : o === desk.picked ? 'wrong' : 'dim'} disabled={!!desk.picked} onClick={() => answer(o)}>
                  {name(o)}
                </button>
              ))}
            </div>
            {desk.picked === desk.to && (
              <div className="ex-stamp" aria-live="polite">
                {flagEmoji(desk.to)} {name(desk.to)}
              </div>
            )}
            {desk.picked && desk.picked !== desk.to && <p className="ex-note">{t('Raté, la réponse : {country}. Deux vivres de moins.', { country: name(desk.to) })}</p>}
            {!desk.picked && (
              <button className="ex-back" onClick={() => setDesk(null)}>
                {t('Choisir une autre frontière')}
              </button>
            )}
          </section>
        )}

        {bonus && (
          <section className="ex-desk bonus">
            <small>{t('Douane renforcée')}</small>
            {bonus.q.kind === 'capitale' ? (
              <>
                <h2>{t('{country} : quelle capitale ?', { country: name(bonus.code) })}</h2>
                <div className="ex-options">
                  {bonus.q.options.map((o) => (
                    <button key={o} className={!bonus.picked ? '' : o === bonus.q.answer ? 'right' : o === bonus.picked ? 'wrong' : 'dim'} disabled={!!bonus.picked} onClick={() => answerBonus(o)}>
                      {o}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2>{t('{country} face à {other} : plus ou moins d’habitants ?', { country: name(bonus.code), other: name(bonus.q.than) })}</h2>
                <div className="ex-options two">
                  {(['plus', 'moins'] as const).map((o) => (
                    <button key={o} className={!bonus.picked ? '' : o === bonus.q.answer ? 'right' : o === bonus.picked ? 'wrong' : 'dim'} disabled={!!bonus.picked} onClick={() => answerBonus(o)}>
                      {t(o)}
                    </button>
                  ))}
                </div>
              </>
            )}
            {bonus.picked && <p className="ex-note">{bonus.picked === bonus.q.answer ? t('Bien vu : un vivre de plus.') : t('Raté, pas de vivre en plus.')}</p>}
          </section>
        )}

        {st !== 'en route' && (
          <section className="ex-end">
            <h2>
              {tour
                ? t('Tour du monde terminé : {n} pays', { n: visited(run) })
                : st === 'arrivé'
                  ? t('Arrivé : {country} !', { country: name(exp.end) })
                  : t('Bloqué : {country}, à court de vivres', { country: name(at) })}
            </h2>
            {!tour && (
              <p className="ex-stars" aria-label={t('{n} étoiles sur 3', { n: stars(exp, run) })}>
                {'★'.repeat(stars(exp, run))}
                <span>{'★'.repeat(3 - stars(exp, run))}</span>
              </p>
            )}
            <p className="ex-flags">{run.path.map(flagEmoji).join(' ')}</p>
            <dl className="ex-facts">
              {!tour && (
                <div>
                  <dt>{t('Frontières passées')}</dt>
                  <dd>
                    {crossed} <small>{t('record possible {n}', { n: exp.optimal })}</small>
                  </dd>
                </div>
              )}
              {tour && bestScore('expedition-tour') !== null && (
                <div>
                  <dt>{t('Ton record')}</dt>
                  <dd>{plural(bestScore('expedition-tour')!, '{n} pays', '{n} pays')}</dd>
                </div>
              )}
              <div>
                <dt>{t('Vivres restants')}</dt>
                <dd>{Math.max(0, run.supplies)}</dd>
              </div>
              <div>
                <dt>{t('Douanes réussies')}</dt>
                <dd>
                  {log.filter(Boolean).length} / {log.length}
                </dd>
              </div>
            </dl>
            <div className="ex-actions">
              <button className="ui-btn" onClick={share}>
                {copied ? t('Résultat copié !') : t('Partager l’expédition')}
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
              <a className="ui-btn line" href="#/expedition/carte">
                {t('Ma carte')}
              </a>
            </div>
            {tour ? (
              <NextGame />
            ) : (
              <ChallengeBox game="expedition" path="/expedition" seed={seed} result={{ pts: score(atlas.neighbors, exp, run), s: crossed, win: st === 'arrivé', ms: 0 }} />
            )}
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
