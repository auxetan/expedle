import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Atlas } from '../../geo/atlas'
import { isSolved, MARK_EMOJI, nextCountries, scoreGuess, shortestPath, startConnected, type Mark } from '../../geo/graph'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, todayKey } from '../../lib/util'
import { addRecord, computeStats, type GameRecord, type ItinSettings } from './history'
import { exactMatch, matchSuggestions, routeGraph, type Puzzle } from './puzzle'
import RouteMap, { type Layer } from './RouteMap'
import { useTheme } from '../../ui/theme'

const PALETTES = {
  sombre: { start: '#c9899a', end: '#88afa2', connected: '#d7c7a2', loose: '#4f4a45', solution: '#7d7464' },
  clair: { start: '#c97b8f', end: '#6ea596', connected: '#c6ad7c', loose: '#b9b0a2', solution: '#a39880' },
}

interface Saved {
  guesses: string[]
  hints: number
}

export interface GameSlot {
  kind: GameRecord['kind']
  storageKey: string | null
  dailyId: string | null
  dayKey: string
  label: string
  intro: string
}

interface Props {
  atlas: Atlas
  puzzle: Puzzle
  slot: GameSlot
  settings: ItinSettings
  hard: boolean
  shareUrl: string
  onAnother: () => void
  onHelp: () => void
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

export default function ItinGame({ atlas, puzzle, slot, settings, hard, shareUrl, onAnother, onHelp }: Props) {
  const saved = slot.storageKey ? load<Saved>(slot.storageKey, { guesses: [], hints: 0 }) : { guesses: [], hints: 0 }
  const [guesses, setGuesses] = useState<string[]>(saved.guesses)
  const [hints, setHints] = useState(saved.hints)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState(false)
  const [results, setResults] = useState(false)
  const [toast, setToast] = useState('')

  const g = useMemo(() => routeGraph(atlas, puzzle), [atlas, puzzle])
  const { start, end, maxGuesses, shortest } = puzzle
  const palette = PALETTES[useTheme()]
  const guessedSet = useMemo(() => new Set(guesses), [guesses])
  const marks: Mark[] = useMemo(() => guesses.map((c, i) => scoreGuess(g, start, end, guesses.slice(0, i), c)), [g, start, end, guesses])
  const won = useMemo(() => isSolved(g, start, end, guessedSet), [g, start, end, guessedSet])
  const lost = !won && guesses.length >= maxGuesses
  const over = won || lost
  const connected = useMemo(() => startConnected(g, start, guessedSet), [g, start, guessedSet])
  const next = useMemo(() => (hints >= 1 && !over ? nextCountries(g, start, end, guessedSet) : []), [g, start, end, guessedSet, hints, over])
  const solution = useMemo(() => shortestPath(g, start, end), [g, start, end])

  useEffect(() => {
    if (slot.storageKey) save(slot.storageKey, { guesses, hints })
  }, [slot.storageKey, guesses, hints])

  const recorded = useRef(false)
  const backRef = useRef<HTMLDivElement>(null)
  const [backHeight, setBackHeight] = useState(0)
  useLayoutEffect(() => {
    const body = backRef.current
    if (!body) return
    const face = body.parentElement!
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(face)
      setBackHeight(body.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom))
    })
    ro.observe(body)
    return () => ro.disconnect()
  }, [over])
  const elapsed = useStopwatch()
  useEffect(() => {
    if (!over || recorded.current) return
    recorded.current = true
    if (slot.dailyId && dailyResult(slot.dailyId, slot.dayKey)) return
    if (slot.dailyId) saveDailyResult(slot.dailyId, { won, guesses: guesses.length }, slot.dayKey)
    addRecord({
      id: slot.storageKey ?? `libre:${Date.now()}`,
      kind: slot.kind,
      date: slot.kind === 'libre' ? todayKey() : slot.dayKey,
      won,
      guesses: guesses.length,
      shortest,
      hints,
    })
    recordPlay(slot.kind === 'jour' ? 'itineraire' : `itineraire-${slot.kind}`, {
      pts: won ? Math.max(10, 100 - 15 * (guesses.length - shortest) - 10 * hints) : 0,
      s: guesses.length,
      ms: elapsed(),
      win: won,
    })
    setTimeout(() => setResults(true), 900)
  }, [over, won, slot, guesses.length, shortest, hints, elapsed])

  const suggestions = useMemo(() => matchSuggestions(atlas, query), [atlas, query])
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])
  const name = atlas.name

  function flash(text: string) {
    setMessage(text)
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  function submit(code?: string) {
    if (over) return
    const target = code ?? suggestions[active]?.s.code ?? exactMatch(atlas, query)?.code
    if (!target) return flash(`${atlas.noun === 'pays' ? 'Pays' : 'État'} inconnu`)
    if (target === start) return flash(`${name(start)} est le point de départ`)
    if (target === end) return flash(`${name(end)} est la destination`)
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
    ...(lost ? solution.filter((c) => !guessedSet.has(c)).map((c) => ({ code: c, fill: palette.solution })) : []),
    ...visibleGuesses.map((c) => ({ code: c, fill: connected.has(c) ? palette.connected : palette.loose })),
    { code: start, fill: palette.start },
    { code: end, fill: palette.end },
  ]
  const focus = [start, end, ...visibleGuesses, ...next, ...(lost ? solution : [])]
  const named = useMemo(
    () => (hard && !over ? new Set<string>() : new Set([start, end, ...guesses, ...(lost ? solution : [])])),
    [hard, over, start, end, guesses, lost, solution],
  )

  const extra = guesses.length - shortest
  const emojis = marks.map((m) => MARK_EMOJI[m]).join('')
  const shareText = `#travle ${slot.label} ${won ? `+${extra}` : '❌'}${hints ? ` (${hints} indice${hints > 1 ? 's' : ''})` : ''}\n${name(start)} ➡️ ${name(end)}\n${emojis}\n${shareUrl}`

  async function copy(text: string, ok: string) {
    setToast((await copyText(text)) ? ok : 'Copie impossible')
    setTimeout(() => setToast(''), 1800)
  }

  const stats = computeStats()
  const hintLabels = ['Montrer les contours du (des) pays suivant(s)', 'Montrer les contours de tous les pays', 'Montrer les initiales des pays']
  const guessLabel = Number.isFinite(maxGuesses) ? `${Math.min(guesses.length + 1, maxGuesses)}/${maxGuesses}` : `${guesses.length + 1}`

  return (
    <>
      <p className="itin-title">
        {slot.intro}, j'aimerais <b>travle</b> de <span className="c-start">{name(start)}</span> à{' '}
        <span className="c-end">{name(end)}</span>
      </p>
      <div className="itin-actions">
        <button className="itin-help" onClick={onHelp}>
          <span className="q">?</span> Aide
        </button>
        <button className="itin-send" onClick={() => copy(shareUrl, 'Lien copié !')}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
            <path d="M2 11.5 21.5 3l-5 18-5.2-6.3-4.8 4.1.9-6.4L2 11.5Zm7.4 1.4-.4 3 2-1.7 7.4-9.5-9 8.2Z" />
          </svg>
          Envoyer cet itinéraire à un ami
        </button>
      </div>

      {/* En fin de partie, la carte se retourne : les résultats sont au dos. */}
      <div className={results ? 'itin-flip flipped' : 'itin-flip'}>
        <div className="itin-flip-inner">
          <div className="itin-face front" aria-hidden={results}>
            {settings.hideMap && !over ? (
              <div className="rm-hidden">Carte masquée — désactivez « Masquer la carte » dans les réglages.</div>
            ) : (
              <RouteMap
                atlas={atlas}
                layers={layers}
                focus={focus}
                outlines={next}
                showAll={hints >= 2 || over}
                initials={(hints >= 3 && !hard) || false}
                projection={settings.projection}
                named={named}
                minHeight={backHeight}
              />
            )}
          </div>
          {over && (
            <article className="itin-face back" aria-hidden={!results}>
              <div ref={backRef}>
                <h2>{won ? 'Bravo !' : 'Dommage !'}</h2>
                <p>
                  {name(start)} → {name(end)}
                </p>
                <p>
                  {won ? `Trajet trouvé en ${guesses.length} essai${guesses.length > 1 ? 's' : ''}` : 'Trajet non trouvé'} (minimum : {shortest}
                  {hints ? `, ${hints} indice${hints > 1 ? 's' : ''}` : ''})
                </p>
                <p className="emoji-line">{emojis}</p>
                <p>Un plus court chemin : {[start, ...solution, end].map(name).join(' → ')}</p>
                <div className="stat-row">
                  <div>
                    <b>{stats.played}</b>Parties
                  </div>
                  <div>
                    <b>{stats.winRate}%</b>Victoires
                  </div>
                  <div>
                    <b>{stats.streak}</b>Série
                  </div>
                  <div>
                    <b>{stats.perfectRate}%</b>Parfaites
                  </div>
                </div>
                <div className="itin-back-actions">
                  <button className="pink" onClick={() => copy(shareText, 'Résultat copié !')}>
                    Partager 📋
                  </button>
                  <button className="itin-turn" onClick={() => setResults(false)}>
                    Revoir la carte <span className="ico">⇄</span>
                  </button>
                </div>
                <a className="itin-link-stats" href="#/itineraire/stats">
                  Toutes les statistiques →
                </a>
              
              </div>
            </article>
          )}
        </div>
      </div>

      {over ? (
        <>
          <div className="itin-over">
            <button className="big-teal" onClick={onAnother}>
              Jouer une autre <span className="ico">⟳</span>
            </button>
            <div className="itin-over-side">
              <button className="pink" onClick={() => setResults(!results)}>
                {results ? 'Revoir la carte' : 'Voir les résultats'} <span className="ico">⇄</span>
              </button>
              <button className="pink" onClick={() => copy(shareText, 'Résultat copié !')}>
                Partager avec des amis <span className="ico">📋</span>
              </button>
            </div>
          </div>
          <p className="itin-more">
            <a href="#/classement">Jouez à GeoHunter !</a> · <a href="#/echelle/geo">Essayez Size It Up : Géographie</a> ·{' '}
            <a href="#/cartographe">Seterra</a> · <a href="#/itineraire/stats">Statistiques</a>
          </p>
        </>
      ) : (
        <div className="itin-input-row">
          {open && suggestions.length > 0 && (
            <ul className="itin-suggest" ref={listRef}>
              {suggestions.map(({ s, at }, i) => (
                <li
                  key={s.code}
                  className={i === active ? 'active' : ''}
                  onMouseMove={() => i !== active && setActive(i)}
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
            className={shake ? 'shake' : ''}
            value={query}
            placeholder={atlas.id === 'usa' ? 'Entrez un État...' : 'Entrez un pays, un territoire...'}
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
            Essais ({guessLabel})
          </button>
        </div>
      )}
      {message && <p className="itin-msg">{message}</p>}
      {lost && <p className="itin-msg">Le chemin le plus court : {[start, ...solution, end].map(name).join(' → ')}</p>}

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
            <span className="n">{i + 1}.</span> {name(c)} <span className="e">{MARK_EMOJI[marks[i]]}</span>
          </button>
        ))}
      </div>

      {!over && !hard && (
        <>
          <h3 className="itin-h">Avoir un indice ({hints}/3) :</h3>
          <div className="itin-hints">
            {hintLabels.map((text, i) => (
              <button key={text} disabled={i !== hints} className={i === hints ? 'hint on' : 'hint'} onClick={() => setHints(hints + 1)}>
                {atlas.id === 'usa' ? text.replace(/pays/g, 'États') : text}
              </button>
            ))}
          </div>
        </>
      )}
      {!over && hard && <p className="itin-hard">Mode difficile : pas d’indices ni de noms sur la carte.</p>}

      {toast && <div className="toast-copy">{toast}</div>}
    </>
  )
}
