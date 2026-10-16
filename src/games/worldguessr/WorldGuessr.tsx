import { useEffect, useRef, useState } from 'react'
import { COUNTRY_BY_CODE } from '../../geo/countries'
import { distanceKm } from '../../geo/measure'
import { getWorld } from '../../geo/world'
import { recordPlay, useStopwatch } from '../../lib/stats'
import { copyText, load, save } from '../../lib/util'
import AppBar from '../../ui/AppBar'
import CountUp from '../../ui/CountUp'
import GuessMap, { type LatLng, type Pair } from './GuessMap'
import PhotoViewer from './PhotoViewer'
import { findPlace, MODES, score, type Mode, type Place } from './photos'
import './worldguessr.css'

const ROUNDS = 5
type Phase = 'menu' | 'loading' | 'guess' | 'reveal' | 'summary' | 'error'

const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km).toLocaleString('fr-FR')} km`)
const loadSeen = () => new Set(load<number[]>('wg-seen', []))

export default function WorldGuessr() {
  const world = getWorld()
  const [mode, setMode] = useState<Mode>(() => MODES.find((m) => m.id === load('wg-mode', 'monde')) ?? MODES[0])
  const [phase, setPhase] = useState<Phase>('menu')
  const [places, setPlaces] = useState<Place[]>([])
  const [guesses, setGuesses] = useState<(LatLng | null)[]>([])
  const [round, setRound] = useState(0)
  const [pick, setPick] = useState<LatLng | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [record, setRecord] = useState(false)
  const next = useRef<Promise<Place> | null>(null)
  const abort = useRef<AbortController | null>(null)
  const seen = useRef(loadSeen())
  const modeRef = useRef(mode)
  const elapsed = useStopwatch(places[0]?.pageid)

  // Le lieu suivant se cherche toujours d'avance : pendant la manche en cours, pendant le bilan pour la
  // partie d'après, et dès l'ouverture pour le premier lieu du dernier mode joué.
  function prefetch() {
    next.current = findPlace(world, modeRef.current, Math.random, seen.current, abort.current!.signal).then((p) => {
      seen.current.add(p.pageid)
      new Image().src = p.image
      return p
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
    setPhase('loading')
    try {
      const place = await next.current!
      next.current = null
      save('wg-seen', [...seen.current].slice(-500))
      setPlaces((list) => [...list.slice(0, index), place])
      setRound(index)
      setPick(null)
      setMapOpen(false)
      setPhase('guess')
      if (index + 1 < ROUNDS) prefetch()
    } catch (e) {
      if (abort.current?.signal.aborted) return
      setError(e instanceof Error && /Commons|Failed to fetch|NetworkError/.test(e.message) ? 'Impossible de joindre Wikimedia Commons. Vérifie ta connexion.' : 'Aucune photo trouvée cette fois.')
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
    save('wg-mode', m.id)
    setMode(m)
    setPlaces([])
    setGuesses([])
    setRecord(false)
    void show(0)
  }

  function validate() {
    if (phase !== 'guess' || !pick) return
    setGuesses((g) => [...g.slice(0, round), pick])
    setPhase('reveal')
  }

  const place = places[round]
  const results = places.map((p, i) => {
    const g = guesses[i]
    const km = g ? distanceKm([g[1], g[0]], [p.lng, p.lat]) : Infinity
    return { km, points: g ? score(km, mode.scaleKm) : 0 }
  })
  const total = results.slice(0, guesses.length).reduce((s, r) => s + r.points, 0)
  const best = load<number | null>(`wg-best:${mode.id}`, null)

  function advance() {
    if (round + 1 < ROUNDS) return void show(round + 1)
    setPhase('summary')
    prefetch()
    const prev = load<number | null>(`wg-best:${mode.id}`, null)
    if (prev === null || total > prev) {
      save(`wg-best:${mode.id}`, total)
      setRecord(true)
    }
    recordPlay('worldguessr', { pts: total / (ROUNDS * 50), s: total, ms: elapsed(), sub: mode.id })
  }

  // Entrée ou espace pour valider puis enchaîner, comme sur GeoGuessr.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      // un bouton qui a le focus gère lui-même Entrée et espace
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || (e.key !== 'Enter' && e.key !== ' ')) return
      if (phase === 'guess' && pick) {
        e.preventDefault()
        validate()
      } else if (phase === 'reveal') {
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
    if (!places.length) return start()
    prefetch()
    void show(places.length)
  }

  async function share() {
    const text = `WorldGuessr Méridien · ${mode.label}\n${results
      .map((r, i) => `${i + 1}. ${r.points.toLocaleString('fr-FR')} pts (${fmtKm(r.km)})`)
      .join('\n')}\nTotal : ${total.toLocaleString('fr-FR')} / ${(ROUNDS * 5000).toLocaleString('fr-FR')}`
    setToast((await copyText(text)) ? 'Résultat copié !' : 'Copie impossible')
    setTimeout(() => setToast(''), 1800)
  }

  const country = (p: Place) => (p.country ? COUNTRY_BY_CODE.get(p.country)?.name ?? p.country : 'en mer ou hors carte')

  return (
    <div className="wg">
      <AppBar title="WorldGuessr" />

      {phase === 'menu' && (
        <main className="wg-menu">
          <h1>Où a été prise cette photo ?</h1>
          <p className="muted">
            Cinq vraies photos géolocalisées, venues de Wikimedia Commons. Scrute les panneaux, la végétation, l’architecture, puis place ton repère sur la carte : plus tu
            es près, plus tu marques, jusqu’à 5 000 points par manche.
          </p>
          <div className="wg-modes">
            {MODES.map((m) => {
              const b = load<number | null>(`wg-best:${m.id}`, null)
              return (
                <button key={m.id} className={m.id === mode.id ? 'on' : ''} onClick={() => start(m)}>
                  <b>{m.label}</b>
                  <span>{b !== null ? `record ${b.toLocaleString('fr-FR')}` : 'jamais joué'}</span>
                </button>
              )
            })}
          </div>
          <p className="wg-note muted">Il faut une connexion : les photos et le fond de carte sont chargés en direct.</p>
        </main>
      )}

      {phase === 'loading' && (
        <main className="wg-wait">
          <div className="wg-spinner" />
          <p className="muted">Recherche d’un lieu{round ? '' : ' de départ'}…</p>
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

      {(phase === 'guess' || phase === 'reveal') && place && (
        <main className="wg-play">
          <div className="wg-hud">
            <span>
              {mode.label} · manche <b>{round + 1}</b> / {ROUNDS}
            </span>
            <span>
              <b>{total.toLocaleString('fr-FR')}</b> pts
            </span>
          </div>

          {phase === 'guess' ? (
            <div className="wg-stage">
              <PhotoViewer key={place.image} src={place.image} alt="Lieu à retrouver" />
              <div className={mapOpen ? 'wg-map open' : 'wg-map'}>
                <GuessMap view={mode.view} guess={pick} onGuess={setPick} />
                <button className="ui-btn wg-validate" disabled={!pick} onClick={validate}>
                  {pick ? 'Valider ce lieu' : 'Place ton repère'}
                </button>
              </div>
              <button className="ui-btn wg-map-toggle" onClick={() => setMapOpen(!mapOpen)}>
                {mapOpen ? 'Revoir la photo' : 'Ouvrir la carte'}
              </button>
            </div>
          ) : (
            <div className="wg-reveal">
              <div className="wg-reveal-map">
                <GuessMap view={mode.view} pairs={[{ guess: guesses[round], truth: [place.lat, place.lng] }]} />
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
                <p className="wg-place">
                  {place.title}
                  <span className="muted"> · {country(place)}</span>
                </p>
                <p className="wg-credit muted">
                  Photo : {place.author} ·{' '}
                  {place.licenseUrl ? (
                    <a href={place.licenseUrl} target="_blank" rel="noopener noreferrer">
                      {place.license}
                    </a>
                  ) : (
                    place.license
                  )}{' '}
                  ·{' '}
                  <a href={place.page} target="_blank" rel="noopener noreferrer">
                    Wikimedia Commons
                  </a>
                </p>
                <button className="ui-btn" onClick={advance} autoFocus>
                  {round + 1 < ROUNDS ? 'Manche suivante →' : 'Voir le bilan'}
                </button>
              </div>
            </div>
          )}
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
            <GuessMap view={mode.view} pairs={places.map((p, i): Pair => ({ guess: guesses[i], truth: [p.lat, p.lng] }))} />
          </div>
          <ol className="wg-rounds stagger">
            {places.map((p, i) => (
              <li key={p.pageid}>
                <img src={p.image} alt="" />
                <span>
                  {country(p)}
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
