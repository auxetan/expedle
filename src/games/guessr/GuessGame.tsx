import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { COUNTRY_BY_CODE } from '../../geo/countries'
import { distanceKm } from '../../geo/measure'
import { recordPlay, useStopwatch } from '../../lib/stats'
import { copyText, load, save } from '../../lib/util'
import AppBar from '../../ui/AppBar'
import CountUp from '../../ui/CountUp'
import GuessMap, { type LatLng, type Pair } from './GuessMap'
import { MODES, score, type Mode } from './guess'
import './guessr.css'

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
  find: (mode: Mode, seen: Set<string>, signal: AbortSignal) => Promise<S>
  // reste monté d'une manche à l'autre : un seul panorama Street View par partie
  View: ComponentType<{ spot: S }>
  Details: ComponentType<{ spot: S }>
  Thumb: ComponentType<{ spot: S }>
  explain: (e: unknown) => string
}

const ROUNDS = 5
type Phase = 'menu' | 'play' | 'summary' | 'error'

const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km).toLocaleString('fr-FR')} km`)
const countryName = (s: Spot) => (s.country ? COUNTRY_BY_CODE.get(s.country)?.name ?? s.country : 'en mer ou hors carte')

export default function GuessGame<S extends Spot>({ source, settings, menuTop }: { source: GuessSource<S>; settings?: ReactNode; menuTop?: ReactNode }) {
  const { game, modes = MODES } = source
  const store = source.store ?? game
  const [mode, setMode] = useState<Mode>(() => modes.find((m) => m.id === load(`${store}:mode`, 'monde')) ?? modes[0])
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
    next.current = source.find(modeRef.current, seen.current, abort.current!.signal).then((s) => {
      seen.current.add(s.id)
      return s
    })
    next.current.catch(() => {})
  }

  const prefetchRef = useRef(prefetch)
  useEffect(() => {
    prefetchRef.current = prefetch
  })
  useEffect(() => {
    abort.current = new AbortController()
    prefetchRef.current()
    return () => abort.current?.abort()
  }, [])

  async function show(index: number) {
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
      if (abort.current?.signal.aborted) return
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

  function validate() {
    if (!ready || revealed || !pick) return
    setGuesses((g) => [...g.slice(0, round), pick])
    setRevealed(true)
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
    setPhase('summary')
    prefetch()
    const prev = load<number | null>(`${store}:best:${mode.id}`, null)
    if (prev === null || total > prev) {
      save(`${store}:best:${mode.id}`, total)
      setRecord(true)
    }
    recordPlay(game, { pts: total / (ROUNDS * 50), s: total, ms: elapsed(), sub: mode.id })
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
    if (!spots.length) return start()
    prefetch()
    void show(spots.length)
  }

  async function share() {
    const text = `${source.title} Méridien · ${mode.label}\n${results
      .map((r, i) => `${i + 1}. ${r.points.toLocaleString('fr-FR')} pts (${fmtKm(r.km)})`)
      .join('\n')}\nTotal : ${total.toLocaleString('fr-FR')} / ${(ROUNDS * 5000).toLocaleString('fr-FR')}`
    setToast((await copyText(text)) ? 'Résultat copié !' : 'Copie impossible')
    setTimeout(() => setToast(''), 1800)
  }

  // pendant l'attente du lieu suivant, la vue garde l'ancien lieu sous le voile de chargement
  const shown = spot ?? spots[round - 1]
  const { View, Details, Thumb } = source

  return (
    <div className="wg">
      <AppBar title={source.title} settings={settings} />

      {phase === 'menu' && (
        <main className="wg-menu">
          <h1>{source.question}</h1>
          <p className="muted">{source.intro}</p>
          {menuTop}
          <div className="wg-modes">
            {modes.map((m) => {
              const b = load<number | null>(`${store}:best:${m.id}`, null)
              return (
                <button key={m.id} className={m.id === mode.id ? 'on' : ''} onClick={() => start(m)}>
                  <b>{m.label}</b>
                  <span>{b !== null ? `record ${b.toLocaleString('fr-FR')}` : 'jamais joué'}</span>
                </button>
              )
            })}
          </div>
          <p className="wg-note muted">{source.note}</p>
        </main>
      )}

      {phase === 'error' && (
        <main className="wg-wait">
          <p>{error}</p>
          <div className="wg-row">
            <button className="ui-btn" onClick={retry}>
              Réessayer
            </button>
            <button className="ui-btn line" onClick={() => setPhase('menu')}>
              Changer de mode
            </button>
          </div>
        </main>
      )}

      {phase === 'play' && (
        <main className="wg-play">
          <div className="wg-hud">
            <span>
              {mode.label} · manche <b>{round + 1}</b> / {ROUNDS}
            </span>
            <span>
              <b>{total.toLocaleString('fr-FR')}</b> pts
            </span>
          </div>

          <div className="wg-stage">
            {shown && <View spot={shown} />}
            {!ready && (
              <div className="wg-veil">
                <div className="wg-spinner" />
                <p>Recherche d’un lieu{round ? '' : ' de départ'}…</p>
              </div>
            )}

            {ready && !revealed && (
              <>
                <div className={mapOpen ? 'wg-map open' : 'wg-map'}>
                  <GuessMap view={mode.view} guess={pick} onGuess={setPick} />
                  <button className="ui-btn wg-validate" disabled={!pick} onClick={validate}>
                    {pick ? 'Valider ce lieu' : 'Place ton repère'}
                  </button>
                </div>
                <button className="ui-btn wg-map-toggle" onClick={() => setMapOpen(!mapOpen)}>
                  {mapOpen ? 'Revenir au lieu' : 'Ouvrir la carte'}
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
                    <span>points · à {fmtKm(results[round].km)}</span>
                  </div>
                  <div className="wg-bar">
                    <i style={{ width: `${(results[round].points / 5000) * 100}%` }} />
                  </div>
                  <p className="wg-place">{countryName(spot)}</p>
                  <Details spot={spot} />
                  <button className="ui-btn" onClick={advance} autoFocus>
                    {round + 1 < ROUNDS ? 'Manche suivante →' : 'Voir le bilan'}
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
            <span className="ui-label">{mode.label} · bilan</span>
            <b>
              <CountUp value={total} /> <small>/ {(ROUNDS * 5000).toLocaleString('fr-FR')}</small>
            </b>
            {record ? <span className="wg-record">Nouveau record !</span> : best !== null && <span className="muted">Record : {best.toLocaleString('fr-FR')}</span>}
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
                <b>{results[i].points.toLocaleString('fr-FR')}</b>
              </li>
            ))}
          </ol>
          <div className="wg-row">
            <button className="ui-btn" onClick={() => start()}>
              Rejouer ↻
            </button>
            <button className="ui-btn line" onClick={share}>
              Partager
            </button>
            <button className="ui-btn line" onClick={() => setPhase('menu')}>
              Changer de mode
            </button>
          </div>
        </main>
      )}
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
