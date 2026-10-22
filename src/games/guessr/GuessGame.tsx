import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { countryName as nameOf } from '../../geo/countries'
import { distanceKm } from '../../geo/measure'
import { readChallenge } from '../../lib/challenge'
import { go } from '../../lib/router'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, seededRng, todayKey } from '../../lib/util'
import AppBar from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import CountUp from '../../ui/CountUp'
import GuessMap, { type LatLng, type Pair } from './GuessMap'
import { MODES, score, type Mode } from './guess'
import './guessr.css'
import { fmt, locale, msg, t, tx } from '../../lib/i18n'
import { stamp } from '../../lib/passport'
import { countryAt } from '../../geo/measure'
import { getWorld } from '../../geo/world'
import { feedback } from '../../lib/feedback'

export interface Spot {
  id: string
  lat: number
  lng: number
  country: string | null
}

// Ce qui distingue PhotoGuessr (photos) de GeoGuessr (vues de rue 360°) ; tout le reste de la partie est commun.
export interface GuessSource<S extends Spot> {
  game: 'photoguessr' | 'geoguessr'
  // préfixe des records et des lieux déjà vus, quand une même partie existe avec plusieurs imageries
  store?: string
  modes?: Mode[]
  title: string
  question: string
  intro: string
  note: string
  // rng fourni : tirage reproductible, le même pour tous (défi du jour)
  find: (mode: Mode, seen: Set<string>, signal: AbortSignal, rng?: () => number) => Promise<S>
  // le mode du défi du jour
  dailyMode: string
  // un défi se rejoue avec la même imagerie, sur les lieux mêmes du créateur, désignés par keyOf et rechargés par load
  imagery: string
  keyOf: (spot: S) => string
  load: (key: string, signal: AbortSignal) => Promise<S>
  // reste monté d'une manche à l'autre : un seul panorama Street View par partie ; still : interdit d'avancer
  View: ComponentType<{ spot: S; still: boolean }>
  Details: ComponentType<{ spot: S }>
  Thumb: ComponentType<{ spot: S }>
  explain: (e: unknown) => string
}

const ROUNDS = 5
type Phase = 'menu' | 'play' | 'summary' | 'error'

// Règles de la partie : chrono par manche (0 = sans) et déplacements, libres, sans bouger, ou NMPZ (ni bouger,
// ni tourner, ni zoomer).
type Moves = 'libre' | 'fixe' | 'nmpz'
interface Rules {
  timer: number
  moves: Moves
}
const TIMERS = [0, 30, 60, 120]
const MOVES: { id: Moves; label: string }[] = [
  { id: 'libre', label: msg('Libres') },
  { id: 'fixe', label: msg('Sans bouger') },
  { id: 'nmpz', label: 'NMPZ' },
]
const FREE: Rules = { timer: 0, moves: 'libre' }
const DAILY: Rules = { timer: 120, moves: 'libre' }
const rulesSuffix = (r: Rules) => (r.timer || r.moves !== 'libre' ? `.${r.timer}-${r.moves}` : '')
function parseRules(text = ''): Rules {
  const [timer, moves] = text.split('-')
  return { timer: TIMERS.includes(Number(timer)) ? Number(timer) : 0, moves: MOVES.some((m) => m.id === moves) ? (moves as Moves) : 'libre' }
}

const fmtKm = (km: number) => (!Number.isFinite(km) ? '—' : km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km).toLocaleString(locale())} km`)
const timerLabel = (s: number) => (s === 0 ? t('Sans') : s < 60 ? t('{n} s', { n: s }) : t('{n} min', { n: s / 60 }))
const countryName = (s: Spot) => (s.country ? nameOf(s.country) : t('en mer ou hors carte'))

interface Props<S extends Spot> {
  source: GuessSource<S>
  settings?: ReactNode
  menuTop?: ReactNode
  // défi du jour : cinq lieux tirés d'après la date, les mêmes pour tous
  daily?: boolean
}

export default function GuessGame<S extends Spot>({ source, settings, menuTop, daily = false }: Props<S>) {
  const { game, modes = MODES } = source
  const store = source.store ?? game
  const day = todayKey()
  const dailyId = `${game}-jour`
  // partie imposée : le défi du jour, ou un défi reçu (graine imagerie.mode.lieu1,lieu2,….chrono-déplacements)
  const [plan] = useState(() => {
    if (daily) return { seed: null, mode: modes.find((x) => x.id === source.dailyMode) ?? modes[0], keys: null, rules: DAILY }
    const c = readChallenge()
    const [imagery, modeId, keys, opts] = c?.seed.split('.') ?? []
    const m = modes.find((x) => x.id === modeId)
    return c && imagery === source.imagery && m && keys ? { seed: c.seed, mode: m, keys: keys.split(','), rules: parseRules(opts) } : null
  })
  const [doneToday] = useState(() => (daily ? dailyResult<{ total: number }>(dailyId, day) : null))
  const [rules, setRules] = useState<Rules>(() => plan?.rules ?? load<Rules>(`${store}:rules`, FREE))
  const fetched = useRef(0)
  const [ms, setMs] = useState<number>()
  const [left, setLeft] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>(() => plan?.mode ?? modes.find((m) => m.id === load(`${store}:mode`, 'monde')) ?? modes[0])
  const [phase, setPhase] = useState<Phase>('menu')
  const [spots, setSpots] = useState<S[]>([])
  const [guesses, setGuesses] = useState<(LatLng | null)[]>([])
  const [round, setRound] = useState(0)
  const [waiting, setWaiting] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [pick, setPick] = useState<LatLng | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [record, setRecord] = useState(false)
  const next = useRef<Promise<S> | null>(null)
  const abort = useRef<AbortController | null>(null)
  const seen = useRef(new Set(load<string[]>(`${store}:seen`, [])))
  const modeRef = useRef(mode)
  const elapsed = useStopwatch(spots[0]?.id)

  // Le lieu suivant se cherche toujours d'avance : pendant la manche en cours, pendant le bilan pour la
  // partie d'après, et dès l'ouverture pour le premier lieu du dernier mode joué.
  function prefetch() {
    const signal = abort.current!.signal
    if (plan?.keys) {
      const key = plan.keys[fetched.current++]
      next.current = key ? source.load(key, signal) : Promise.reject(new Error(t('Ce défi est incomplet.')))
    } else if (plan) next.current = source.find(plan.mode, new Set(), signal, seededRng(`${game}-jour-${source.imagery}-${day}-${fetched.current++}`))
    else
      next.current = source.find(modeRef.current, seen.current, signal).then((s) => {
        seen.current.add(s.id)
        return s
      })
    next.current.catch(() => {})
  }

  const prefetchRef = useRef(prefetch)
  useEffect(() => {
    prefetchRef.current = prefetch
  })
  // un lien de défi lance la partie tout de suite, dans le mode du créateur
  const startRef = useRef(start)
  useEffect(() => {
    startRef.current = start
  })
  useEffect(() => {
    abort.current = new AbortController()
    fetched.current = 0
    if (doneToday) return
    prefetchRef.current()
    if (plan) startRef.current(plan.mode)
    return () => abort.current?.abort()
  }, [plan, doneToday])

  async function show(index: number) {
    const signal = abort.current!.signal
    setPhase('play')
    setRound(index)
    setRevealed(false)
    setPick(null)
    setMapOpen(false)
    setWaiting(true)
    try {
      const spot = await next.current!
      next.current = null
      save(`${store}:seen`, [...seen.current].slice(-500))
      setSpots((list) => [...list.slice(0, index), spot])
      setWaiting(false)
      if (index + 1 < ROUNDS) prefetch()
    } catch (e) {
      // une recherche abandonnée (changement de mode, page quittée) n'est pas une erreur
      if (signal.aborted) return
      setError(source.explain(e))
      setPhase('error')
    }
  }

  function start(m = mode) {
    // un lieu déjà cherché pour ce mode sert tel quel ; sinon on repart de zéro pour le nouveau mode
    if (m.id !== modeRef.current.id || !next.current) {
      abort.current?.abort()
      abort.current = new AbortController()
      modeRef.current = m
      prefetch()
    }
    save(`${store}:mode`, m.id)
    setMode(m)
    setSpots([])
    setGuesses([])
    setRecord(false)
    void show(0)
  }

  const spot = spots[round]
  const ready = !waiting && !!spot

  // force : le chrono est à zéro ; sans repère posé, la manche vaut 0 point
  function validate(force = false) {
    if (!ready || revealed || (!pick && !force)) return
    setGuesses((g) => [...g.slice(0, round), pick])
    setRevealed(true)
    const km = pick ? distanceKm([pick[1], pick[0]], [spot.lng, spot.lat]) : Infinity
    feedback(score(km, mode.scaleKm) >= 3500 ? 'good' : pick ? 'tap' : 'bad')
    // repère posé dans le bon pays : le pays entre au passeport
    if (pick && spot.country && countryAt(getWorld(), [pick[1], pick[0]]) === spot.country) stamp(spot.country, game)
  }

  const results = spots.map((s, i) => {
    const g = guesses[i]
    const km = g ? distanceKm([g[1], g[0]], [s.lng, s.lat]) : Infinity
    return { km, points: g ? score(km, mode.scaleKm) : 0 }
  })
  const total = results.slice(0, guesses.length).reduce((s, r) => s + r.points, 0)
  const best = load<number | null>(`${store}:best:${mode.id}`, null)

  function advance() {
    if (round + 1 < ROUNDS) return void show(round + 1)
    const time = elapsed()
    setMs(time)
    setPhase('summary')
    if (!plan) prefetch()
    const prev = load<number | null>(`${store}:best:${mode.id}`, null)
    if (prev === null || total > prev) {
      save(`${store}:best:${mode.id}`, total)
      setRecord(true)
    }
    if (daily) {
      recordPlay(dailyId, { pts: total / (ROUNDS * 50), s: total, ms: time })
      saveDailyResult(dailyId, { total }, day)
    } else recordPlay(game, { pts: total / (ROUNDS * 50), s: total, ms: time, sub: plan ? 'defi' : mode.id })
  }

  // Le chrono tourne pendant que le lieu est affiché ; à zéro, la manche se valide avec le repère posé, s'il y en a un.
  const timeUp = useRef(() => validate(true))
  useEffect(() => {
    timeUp.current = () => validate(true)
  })
  useEffect(() => {
    if (phase !== 'play' || !ready || revealed || !rules.timer) return setLeft(null)
    const end = Date.now() + rules.timer * 1000
    const id = setInterval(() => {
      const remaining = Math.max(0, end - Date.now())
      setLeft(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        timeUp.current()
      }
    }, 250)
    return () => clearInterval(id)
  }, [phase, ready, revealed, round, rules.timer])

  function setRule(patch: Partial<Rules>) {
    const next = { ...rules, ...patch }
    setRules(next)
    save(`${store}:rules`, next)
  }

  // Entrée ou espace pour valider puis enchaîner, comme sur GeoGuessr.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      // un bouton qui a le focus gère lui-même Entrée et espace
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || (e.key !== 'Enter' && e.key !== ' ')) return
      if (phase !== 'play' || !ready) return
      if (!revealed && pick) {
        e.preventDefault()
        validate()
      } else if (revealed) {
        e.preventDefault()
        advance()
      }
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function retry() {
    if (!spots.length && !plan) return start()
    fetched.current = spots.length
    prefetch()
    void show(spots.length)
  }

  async function share() {
    const text = `${source.title} Expedle · ${t(mode.label)}\n${results
      .map((r, i) => `${i + 1}. ${t('{n} pts', { n: fmt(r.points) })} (${fmtKm(r.km)})`)
      .join('\n')}\n${t('Total : {total} / {max}', { total: fmt(total), max: fmt(ROUNDS * 5000) })}`
    setToast((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  // pendant l'attente du lieu suivant, la vue garde l'ancien lieu sous le voile de chargement
  const shown = spot ?? spots[round - 1]
  const { View, Details, Thumb } = source

  return (
    <div className="wg">
      <AppBar title={source.title} settings={settings} />

      {phase === 'menu' && doneToday && (
        <main className="wg-menu">
          <h1>{t('Défi du jour terminé')}</h1>
          <p className="muted">{t('Tu as marqué {n} points sur {max}. Cinq nouveaux lieux t’attendent demain.', { n: fmt(doneToday.total), max: fmt(ROUNDS * 5000) })}</p>
          <div className="wg-row">
            <a className="ui-btn" href="#/classements">
              {t('Voir le classement')}
            </a>
            <a className="ui-btn line" href={`#/${game}`}>
              {t('Partie libre')}
            </a>
          </div>
        </main>
      )}

      {phase === 'menu' && !doneToday && (
        <main className="wg-menu">
          <h1>{t(source.question)}</h1>
          <p className="muted">{t(source.intro)}</p>
          {menuTop}
          <a className="wg-daily" href={`#/${game}/jour`}>
            <b>{t('Défi du jour')}</b>
            <span>
              {dailyResult<{ total: number }>(dailyId, day)
                ? t('Fait : {n} pts', { n: fmt(dailyResult<{ total: number }>(dailyId, day)!.total) })
                : t('Cinq lieux, les mêmes pour tous · {time} par manche', { time: timerLabel(DAILY.timer) })}
            </span>
          </a>
          <div className="wg-modes">
            {modes.map((m) => {
              const b = load<number | null>(`${store}:best:${m.id}`, null)
              return (
                <button key={m.id} className={m.id === mode.id ? 'on' : ''} onClick={() => start(m)}>
                  <b>{t(m.label)}</b>
                  <span>{b !== null ? t('record {n}', { n: fmt(b) }) : t('jamais joué')}</span>
                </button>
              )
            })}
          </div>
          <div className="wg-rules">
            <span>{t('Chrono par manche')}</span>
            <div className="ui-seg">
              {TIMERS.map((s) => (
                <button key={s} className={rules.timer === s ? 'on' : ''} onClick={() => setRule({ timer: s })}>
                  {timerLabel(s)}
                </button>
              ))}
            </div>
            <span>{t('Déplacements')}</span>
            <div className="ui-seg">
              {MOVES.map((m) => (
                <button key={m.id} className={rules.moves === m.id ? 'on' : ''} onClick={() => setRule({ moves: m.id })}>
                  {t(m.label)}
                </button>
              ))}
            </div>
          </div>
          <p className="wg-note muted">{t(source.note)}</p>
        </main>
      )}

      {phase === 'error' && (
        <main className="wg-wait">
          <p>{error}</p>
          <div className="wg-row">
            <button className="ui-btn" onClick={retry}>
              {t('Réessayer')}
            </button>
            <button className="ui-btn line" onClick={() => setPhase('menu')}>
              {t('Changer de mode')}
            </button>
          </div>
        </main>
      )}

      {phase === 'play' && (
        <main className="wg-play">
          <div className="wg-hud">
            <span>
              {tx('{mode} · manche {round} / {total}', { mode: t(mode.label), round: <b>{round + 1}</b>, total: ROUNDS })}
            </span>
            {left !== null && <span className={left < 10000 ? 'wg-timer low' : 'wg-timer'}>{Math.ceil(left / 1000)} s</span>}
            <span>
              {tx('{n} pts', { n: <b>{fmt(total)}</b> })}
            </span>
          </div>

          <div className="wg-stage">
            {shown && <View spot={shown} still={rules.moves !== 'libre'} />}
            {/* NMPZ : la vue ne bouge plus du tout, ni rotation ni zoom */}
            {rules.moves === 'nmpz' && <div className="wg-freeze" />}
            {!ready && (
              <div className="wg-veil">
                <div className="wg-spinner" />
                <p>{round ? t('Recherche d’un lieu…') : t('Recherche d’un lieu de départ…')}</p>
              </div>
            )}

            {ready && !revealed && (
              <>
                <div className={mapOpen ? 'wg-map open' : 'wg-map'}>
                  <GuessMap view={mode.view} guess={pick} onGuess={setPick} />
                  <button className="ui-btn wg-validate" disabled={!pick} onClick={() => validate()}>
                    {pick ? t('Valider ce lieu') : t('Place ton repère')}
                  </button>
                </div>
                <button className="ui-btn wg-map-toggle" onClick={() => setMapOpen(!mapOpen)}>
                  {mapOpen ? t('Revenir au lieu') : t('Ouvrir la carte')}
                </button>
              </>
            )}

            {ready && revealed && (
              <div className="wg-reveal">
                <div className="wg-reveal-map">
                  <GuessMap view={mode.view} pairs={[{ guess: guesses[round], truth: [spot.lat, spot.lng] }]} />
                </div>
                <div className="wg-reveal-card">
                  <div className="wg-reveal-score">
                    <b>
                      <CountUp value={results[round].points} />
                    </b>
                    <span>{guesses[round] ? t('points · à {km}', { km: fmtKm(results[round].km) }) : t('points : temps écoulé sans repère')}</span>
                  </div>
                  <div className="wg-bar">
                    <i style={{ width: `${(results[round].points / 5000) * 100}%` }} />
                  </div>
                  <p className="wg-place">{countryName(spot)}</p>
                  <Details spot={spot} />
                  <button className="ui-btn" onClick={advance} autoFocus>
                    {round + 1 < ROUNDS ? t('Manche suivante →') : t('Voir le bilan')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {phase === 'summary' && (
        <main className="wg-summary">
          <div className="wg-total">
            <span className="ui-label">{t('{mode} · bilan', { mode: t(mode.label) })}</span>
            <b>
              <CountUp value={total} /> <small>/ {(ROUNDS * 5000).toLocaleString(locale())}</small>
            </b>
            {record ? <span className="wg-record">{t('Nouveau record !')}</span> : best !== null && <span className="muted">{t('Record : {n}', { n: fmt(best) })}</span>}
          </div>
          <div className="wg-reveal-map tall">
            <GuessMap view={mode.view} pairs={spots.map((s, i): Pair => ({ guess: guesses[i], truth: [s.lat, s.lng] }))} />
          </div>
          <ol className="wg-rounds stagger">
            {spots.map((s, i) => (
              <li key={s.id}>
                <Thumb spot={s} />
                <span>
                  {countryName(s)}
                  <small className="muted">{fmtKm(results[i].km)}</small>
                </span>
                <b>{results[i].points.toLocaleString(locale())}</b>
              </li>
            ))}
          </ol>
          <ChallengeBox
            game={game}
            path={`/${game}`}
            seed={plan?.seed ?? `${source.imagery}.${mode.id}.${spots.map(source.keyOf).join(',')}${rulesSuffix(rules)}`}
            result={{ pts: total / (ROUNDS * 50), s: total, ms }}
          />
          <div className="wg-row">
            <button className="ui-btn" onClick={() => (plan ? go(`/${game}`) : start())}>
              {t('Rejouer ↻')}
            </button>
            <button className="ui-btn line" onClick={share}>
              {t('Partager')}
            </button>
            <button className="ui-btn line" onClick={() => setPhase('menu')}>
              {t('Changer de mode')}
            </button>
          </div>
        </main>
      )}
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
