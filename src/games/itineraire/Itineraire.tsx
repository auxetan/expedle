import { useEffect, useMemo, useRef, useState } from 'react'
import { countryName } from '../../geo/countries'
import { isSolved, MARK_EMOJI, nextCountries, scoreGuess, shortestPath, startConnected, type Mark } from '../../geo/graph'
import { getWorld } from '../../geo/world'
import { go } from '../../lib/router'
import { dailyResult, recordPlay, saveDailyResult } from '../../lib/stats'
import { copyText, load, save, seededRng, todayKey, weekKey } from '../../lib/util'
import RouteMap, { type Layer } from './RouteMap'
import { exactMatch, makePuzzle, matchSuggestions, puzzleFor, type Puzzle } from './puzzle'
import './itineraire.css'

type Kind = 'jour' | 'hebdo' | 'libre'

const COLORS = {
  start: '#c9899a',
  end: '#88afa2',
  connected: '#d7c7a2',
  loose: '#4f4a45',
  solution: '#7d7464',
}

interface Saved {
  guesses: string[]
  hints: number
}

interface Stats {
  played: number
  won: number
  perfect: number
}

function initialPuzzle(kind: Kind, params: URLSearchParams): Puzzle {
  if (kind === 'jour') return makePuzzle(seededRng('itin-' + todayKey()), 3, 7)
  if (kind === 'hebdo') return makePuzzle(seededRng('itin-hebdo-' + weekKey()), 7, 11)
  const de = params.get('de')
  const a = params.get('a')
  if (de && a) {
    const p = puzzleFor(de, a)
    if (p) return p
  }
  return makePuzzle(Math.random, 3, 8)
}

function Highlight({ label, at, len }: { label: string; at: number; len: number }) {
  if (at < 0) return <>{label}</>
  return (
    <>
      {label.slice(0, at)}
      <mark>{label.slice(at, at + len)}</mark>
      {label.slice(at + len)}
    </>
  )
}

export default function Itineraire({ mode, params }: { mode?: string; params: URLSearchParams }) {
  const kind: Kind = mode === 'hebdo' ? 'hebdo' : mode === 'libre' ? 'libre' : 'jour'
  const storageKey = kind === 'jour' ? `itin:jour:${todayKey()}` : kind === 'hebdo' ? `itin:hebdo:${weekKey()}` : null
  const [puzzle] = useState(() => initialPuzzle(kind, params))
  const saved = storageKey ? load<Saved>(storageKey, { guesses: [], hints: 0 }) : { guesses: [], hints: 0 }
  const [guesses, setGuesses] = useState<string[]>(saved.guesses)
  const [hints, setHints] = useState(saved.hints)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState(false)
  const [modal, setModal] = useState<'help' | 'results' | null>(null)
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const g = getWorld().graph
  const { start, end, maxGuesses, shortest } = puzzle
  const guessedSet = useMemo(() => new Set(guesses), [guesses])
  const marks: Mark[] = useMemo(
    () => guesses.map((c, i) => scoreGuess(g, start, end, guesses.slice(0, i), c)),
    [g, start, end, guesses],
  )
  const won = useMemo(() => isSolved(g, start, end, guessedSet), [g, start, end, guessedSet])
  const lost = !won && guesses.length >= maxGuesses
  const over = won || lost
  const connected = useMemo(() => startConnected(g, start, guessedSet), [g, start, guessedSet])
  const next = useMemo(() => (hints >= 1 && !over ? nextCountries(g, start, end, guessedSet) : []), [g, start, end, guessedSet, hints, over])
  const solution = useMemo(() => shortestPath(g, start, end), [g, start, end])

  useEffect(() => {
    if (storageKey) save(storageKey, { guesses, hints })
  }, [storageKey, guesses, hints])

  const recorded = useRef(false)
  useEffect(() => {
    if (!over || recorded.current) return
    recorded.current = true
    const dailyId = kind === 'jour' ? 'itineraire' : kind === 'hebdo' ? 'itineraire-hebdo' : null
    const day = kind === 'hebdo' ? weekKey() : todayKey()
    if (dailyId && dailyResult(dailyId, day)) return
    if (dailyId) saveDailyResult(dailyId, { won, guesses: guesses.length }, day)
    const stats = load<Stats>('itin-stats', { played: 0, won: 0, perfect: 0 })
    stats.played += 1
    if (won) stats.won += 1
    if (won && guesses.length === shortest) stats.perfect += 1
    save('itin-stats', stats)
    recordPlay('itineraire')
    setTimeout(() => setModal('results'), 900)
  }, [over, won, kind, guesses.length, shortest])

  const suggestions = useMemo(() => matchSuggestions(query), [query])

  function flash(text: string) {
    setMessage(text)
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  function submit(code?: string) {
    if (over) return
    const target = code ?? suggestions[active]?.s.code ?? exactMatch(query)?.code
    if (!target) return flash('Pays inconnu')
    if (target === start) return flash(`${countryName(start)} est le pays de départ`)
    if (target === end) return flash(`${countryName(end)} est le pays d’arrivée`)
    if (guessedSet.has(target)) return flash('Déjà essayé')
    setGuesses([...guesses, target])
    setQuery('')
    setOpen(false)
    setMessage('')
    setActive(0)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') setOpen(false)
  }

  const visibleGuesses = guesses.filter((c) => !hidden.has(c))
  const layers: Layer[] = [
    ...(lost ? solution.filter((c) => !guessedSet.has(c)).map((c) => ({ code: c, fill: COLORS.solution })) : []),
    ...visibleGuesses.map((c) => ({ code: c, fill: connected.has(c) ? COLORS.connected : COLORS.loose })),
    { code: start, fill: COLORS.start },
    { code: end, fill: COLORS.end },
  ]
  const focus = [start, end, ...visibleGuesses, ...next, ...(lost ? solution : [])]

  const shareUrl = `${location.origin}${location.pathname}#/itineraire/libre?de=${start}&a=${end}`
  const label = kind === 'jour' ? todayKey() : kind === 'hebdo' ? weekKey() : 'entraînement'
  const shareText = `#Itinéraire ${label}\n${countryName(start)} ➡️ ${countryName(end)}\n${marks.map((m) => MARK_EMOJI[m]).join('')}${won ? '' : '❌'} (${guesses.length}/${maxGuesses})\n${shareUrl}`

  async function copy(text: string, ok: string) {
    setToast((await copyText(text)) ? ok : 'Copie impossible')
    setTimeout(() => setToast(''), 1800)
  }

  const stats = load<Stats>('itin-stats', { played: 0, won: 0, perfect: 0 })
  const hintLabels = [
    'Montrer les contours du (des) pays suivant(s)',
    'Montrer les contours de tous les pays',
    'Montrer les initiales des pays',
  ]

  return (
    <div className="itin">
      <nav className="itin-nav">
        <a href="#/" className="itin-logo">
          <span className="itin-logo-mark">◎</span>itinéraire
        </a>
        <div className="itin-links">
          <a href="#/itineraire" className={kind === 'jour' ? 'on' : ''}>
            Quotidien
          </a>
          <a href="#/itineraire/hebdo" className={kind === 'hebdo' ? 'on' : ''}>
            <small>CHAQUE LUNDI</small>
            Défi hebdomadaire
          </a>
          <a href={`#/itineraire/libre?n=${Date.now()}`} className={kind === 'libre' ? 'on' : ''}>
            Entraînement
          </a>
          <a href="#/">Hub</a>
        </div>
      </nav>

      <main className="itin-main">
        <p className="itin-title">
          {kind === 'hebdo' ? 'Cette semaine' : kind === 'jour' ? "Aujourd'hui" : 'En route'}, j'aimerais <b>voyager</b> de{' '}
          <span className="c-start">{countryName(start)}</span> à <span className="c-end">{countryName(end)}</span>
        </p>
        <div className="itin-actions">
          <button className="itin-help" onClick={() => setModal('help')}>
            <span className="q">?</span> Aide
          </button>
          <button className="itin-send" onClick={() => copy(shareUrl, 'Lien copié !')}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
              <path d="M2 11.5 21.5 3l-5 18-5.2-6.3-4.8 4.1.9-6.4L2 11.5Zm7.4 1.4-.4 3 2-1.7 7.4-9.5-9 8.2Z" />
            </svg>
            Envoyer cet itinéraire à un ami
          </button>
        </div>

        <RouteMap layers={layers} focus={focus} outlines={next} showAll={hints >= 2 || over} initials={hints >= 3} />

        {over ? (
          <>
            <div className="itin-over">
              <button className="big-teal" onClick={() => go(`/itineraire/libre?n=${Date.now()}`)}>
                Jouer une autre <span className="ico">⟳</span>
              </button>
              <div className="itin-over-side">
                <button className="pink" onClick={() => setModal('results')}>
                  Voir les résultats <span className="ico">⇄</span>
                </button>
                <button className="pink" onClick={() => copy(shareText, 'Résultat copié !')}>
                  Partager avec des amis <span className="ico">📋</span>
                </button>
              </div>
            </div>
            <p className="itin-more">
              <a href="#/classement">Jouez à Classement !</a> · <a href="#/echelle/geo">Essayez Géographie à l’échelle</a> ·{' '}
              <a href="#/cartographe">Cartographe</a>
            </p>
          </>
        ) : (
          <div className="itin-input-row">
            {open && suggestions.length > 0 && (
              <ul className="itin-suggest">
                {suggestions.map(({ s, at }, i) => (
                  <li
                    key={s.code}
                    className={i === active ? 'active' : ''}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      submit(s.code)
                    }}
                  >
                    <Highlight label={s.label} at={at} len={query.trim().length} />
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={inputRef}
              className={shake ? 'shake' : ''}
              value={query}
              placeholder="Entrez un pays, un territoire..."
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
                setOpen(true)
                setMessage('')
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onKey}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="itin-guess" onClick={() => submit()}>
              Essais ({guesses.length + 1}/{maxGuesses})
            </button>
          </div>
        )}
        {message && <p className="itin-msg">{message}</p>}
        {lost && (
          <p className="itin-msg">
            Le chemin le plus court : {[start, ...solution, end].map(countryName).join(' → ')}
          </p>
        )}

        <h3 className="itin-h">Essais précédents (cliquer pour afficher/masquer) :</h3>
        <div className="itin-chips">
          {guesses.map((c, i) => (
            <button
              key={c}
              className={hidden.has(c) ? 'chip off' : 'chip'}
              onClick={() => {
                const h = new Set(hidden)
                if (h.has(c)) h.delete(c)
                else h.add(c)
                setHidden(h)
              }}
            >
              <span className="n">{i + 1}.</span> {countryName(c)} <span className="e">{MARK_EMOJI[marks[i]]}</span>
            </button>
          ))}
        </div>

        {!over && (
          <>
            <h3 className="itin-h">Avoir un indice ({hints}/3) :</h3>
            <div className="itin-hints">
              {hintLabels.map((text, i) => (
                <button key={text} disabled={i !== hints} className={i === hints ? 'hint on' : 'hint'} onClick={() => setHints(hints + 1)}>
                  {text}
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      {modal && (
        <div className="itin-modal-bg" onClick={() => setModal(null)}>
          <article className="itin-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setModal(null)} aria-label="Fermer">
              ✕
            </button>
            {modal === 'help' ? (
              <>
                <h2>itinéraire</h2>
                <p>
                  Nommez les pays à traverser pour aller du <span className="c-start">pays de départ</span> au{' '}
                  <span className="c-end">pays d’arrivée</span>. Essayez d’y arriver en un minimum d’essais !
                </p>
                <h4>Score</h4>
                <ul className="legend">
                  <li>✅ Essai optimal ! Vous vous rapprochez d’un pas.</li>
                  <li>🟩 Bon essai : ce pays est sur un chemin le plus court, mais ce n’est pas le prochain pays.</li>
                  <li>🟧 Plutôt bien : ce pays est proche, mais ne vous rapproche pas.</li>
                  <li>🟥 Pas terrible : ce pays est un gros détour.</li>
                </ul>
                <p>Les essais qui ne sont pas reliés au pays de départ sont affichés en gris.</p>
                <h4>Frontières & connexions</h4>
                <p>
                  Il s’agit de voyager à pied : ponts et tunnels comptent (tunnel sous la Manche, pont de l’Øresund…), pas les
                  exclaves ni les territoires lointains. L’Irlande se relie au Royaume-Uni, l’Indonésie au continent via la
                  Malaisie. La Russie ne touche pas la Pologne via Kaliningrad.
                </p>
                <p>
                  Nombre d’essais : longueur du plus court chemin + 4 à 8 essais bonus selon la difficulté.
                </p>
              </>
            ) : (
              <>
                <h2>{won ? 'Bravo !' : over ? 'Dommage !' : 'Résultats'}</h2>
                <p>
                  {countryName(start)} → {countryName(end)}
                </p>
                {over && (
                  <p>
                    {won ? `Trajet trouvé en ${guesses.length} essai${guesses.length > 1 ? 's' : ''}` : 'Trajet non trouvé'} (minimum :{' '}
                    {shortest})
                  </p>
                )}
                <p className="emoji-line">{marks.map((m) => MARK_EMOJI[m]).join('')}</p>
                <p>
                  Un plus court chemin : {[start, ...solution, end].map(countryName).join(' → ')}
                </p>
                <div className="stat-row">
                  <div>
                    <b>{stats.played}</b>Parties
                  </div>
                  <div>
                    <b>{stats.played ? Math.round((stats.won / stats.played) * 100) : 0}%</b>Victoires
                  </div>
                  <div>
                    <b>{stats.perfect}</b>Parfaites
                  </div>
                </div>
                <button className="pink wide" onClick={() => copy(shareText, 'Résultat copié !')}>
                  Partager avec des amis 📋
                </button>
              </>
            )}
          </article>
        </div>
      )}
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
