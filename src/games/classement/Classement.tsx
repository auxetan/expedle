import { useEffect, useMemo, useRef, useState } from 'react'
import { go } from '../../lib/router'
import { dailyResult, recordPlay, saveDailyResult, submitBest } from '../../lib/stats'
import { copyText, todayKey, weekKey } from '../../lib/util'
import GhBar from './GhBar'
import ClassementHome from './ClassementHome'
import { averageTotal, MISSING_RANK, optimalAssignment } from './ranking'
import { MODE_LABEL, rankMatrix, setupFor, type Mode } from './setup'
import './classement.css'

function rankColor(r: number): string {
  if (r <= 5) return 'var(--good)'
  if (r <= 20) return 'color-mix(in srgb, var(--good) 55%, var(--warn))'
  if (r <= 40) return 'var(--warn)'
  if (r <= 70) return 'var(--orange)'
  return 'var(--bad)'
}

const rankText = (r: number) => (r >= MISSING_RANK ? '100+' : String(r))
const ordinal = (r: number) => (r === 1 ? '1er' : `${r}e`)

interface Toast {
  title: string
  text: string
  good: boolean
}

const MODES: Mode[] = ['classique', 'facile', 'villes', 'jour', 'hebdo']

export default function Classement({ mode: raw }: { mode?: string }) {
  if (!MODES.includes(raw as Mode)) return <ClassementHome />
  return <ClassementGame mode={raw as Mode} />
}

function ClassementGame({ mode }: { mode: Mode }) {
  const [seed, setSeed] = useState(0)
  // seed : chaque « Recommencer » relance un tirage
  const setup = useMemo(() => setupFor(mode), [mode, seed])
  const { entities, categories } = setup
  const matrix = useMemo(() => rankMatrix(setup), [setup])
  const perfect = useMemo(() => optimalAssignment(matrix), [matrix])
  const average = useMemo(() => averageTotal(matrix), [matrix])

  const dailyId = mode === 'jour' ? 'classement-jour' : mode === 'hebdo' ? 'classement-hebdo' : null
  const dayKey = mode === 'hebdo' ? weekKey() : todayKey()
  const done = dailyId ? dailyResult<{ picks: number[] }>(dailyId, dayKey) : null
  const [picks, setPicks] = useState<number[]>(done?.picks ?? [])
  const [between, setBetween] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [float, setFloat] = useState<number | null>(null)
  const [help, setHelp] = useState(false)
  const [showPerfect, setShowPerfect] = useState(false)
  const [copied, setCopied] = useState(false)
  const toastTimer = useRef(0)

  const current = picks.length
  const finished = current >= entities.length
  const total = picks.reduce((s, cat, i) => s + matrix[i][cat], 0)
  const usedCats = new Set(picks)

  useEffect(() => {
    if (!finished || done) return
    recordPlay('classement-' + mode)
    submitBest('classement-' + mode, total, true)
    if (dailyId) saveDailyResult(dailyId, { picks, total }, dayKey)
  }, [finished, done, mode, picks, total, dailyId, dayKey])

  function choose(ci: number) {
    if (finished || between || usedCats.has(ci)) return
    const r = matrix[current][ci]
    const best = Math.min(...categories.map((_, c) => (usedCats.has(c) ? Infinity : matrix[current][c])))
    const bestCat = categories.findIndex((_, c) => !usedCats.has(c) && matrix[current][c] === best)
    const good = r === best
    window.clearTimeout(toastTimer.current)
    setToast(
      good
        ? {
            title: r <= 10 ? 'Excellent !' : 'Bon choix !',
            text: r >= MISSING_RANK ? 'Aucune meilleure option restante.' : `Ce pays est classé ${ordinal(r)} dans cette catégorie.`,
            good,
          }
        : { title: `Meilleur choix : ${categories[bestCat].label} ${rankText(best)}`, text: '', good },
    )
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
    setFloat(r)
    setTimeout(() => setFloat(null), 900)
    setPicks([...picks, ci])
    if (current + 1 < entities.length) {
      setBetween(true)
      setTimeout(() => setBetween(false), 650)
    }
  }

  function restart() {
    if (dailyId) {
      go('/classement/classique')
      return
    }
    setPicks([])
    setToast(null)
    setShowPerfect(false)
    setSeed((s) => s + 1)
  }

  const entity = entities[Math.min(current, entities.length - 1)]
  const correct = picks.filter((c, i) => perfect.perm[i] === c || matrix[i][c] === matrix[i][perfect.perm[i]]).length

  const shareText = `GeoHunter ${MODE_LABEL[mode]}${dailyId ? ' ' + dayKey : ''}\nTotal : ${total} (parfait : ${perfect.total})\n${picks
    .map((c, i) => {
      const r = matrix[i][c]
      return r <= 5 ? '🟩' : r <= 20 ? '🟨' : r <= 40 ? '🟧' : '🟥'
    })
    .join('')}`

  const scale = Math.max(total, average) * 1.15 || 1

  return (
    <div className={`gh gh-${mode}`}>
      <GhBar />
      {!finished ? (
        <div className="gh-wrap">
          <header className="gh-head">
            <div className="gh-total">
              <span className="gh-total-label">{MODE_LABEL[mode]} · total</span>
              <span className="gh-total-value">
                {current ? total : '–'}
                {float !== null && <span className="gh-float">+{rankText(float)}</span>}
              </span>
              <div className="gh-dots">
                {entities.map((_, i) => (
                  <span key={i} style={i < current ? { background: rankColor(matrix[i][picks[i]]) } : undefined} />
                ))}
                <b>
                  {Math.min(current + 1, 8)}/{entities.length}
                </b>
              </div>
              {dailyId && <span className="gh-goal">Objectif : {perfect.total}</span>}
            </div>
            <div className="gh-side">
              <button className="ui-tool" onClick={() => setHelp(true)} aria-label="Aide">
                ?
              </button>
              <button className="ui-tool" onClick={restart} aria-label="Recommencer">
                ↻
              </button>
            </div>
          </header>

          <main className="gh-card">
            <div className={between ? 'gh-entity between' : 'gh-entity'} key={entity.id}>
              {between ? (
                <span className="gh-ready">🎯 Prêt à jouer !</span>
              ) : (
                <>
                  <span className="gh-flag">{entity.flag}</span>
                  <span className="gh-name">{entity.name}</span>
                </>
              )}
            </div>
            <ul className="gh-cats">
              {categories.map((c, ci) => {
                const owner = picks.indexOf(ci)
                const r = owner >= 0 ? matrix[owner][ci] : 0
                return (
                  <li key={c.id}>
                    <button className={owner >= 0 ? 'gh-cat taken' : 'gh-cat'} onClick={() => choose(ci)} disabled={owner >= 0}>
                      <span className="gh-cat-icon">{c.icon}</span>
                      <span className="gh-cat-label">{c.label}</span>
                      {owner >= 0 && (
                        <span className="gh-cat-result">
                          <span>{entities[owner].flag}</span>
                          <span className="gh-rank" style={{ borderRightColor: rankColor(r) }}>
                            {rankText(r)}
                          </span>
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </main>
          <button className="gh-restart ui-btn line" onClick={restart}>
            ↻ Recommencer
          </button>
        </div>
      ) : (
        <div className="gh-wrap">
          <section className="gh-end">
            <div className="gh-end-head">
              <div className="gh-end-title">
                <span className="gh-end-icon">◎</span> {MODE_LABEL[mode].toUpperCase()}
              </div>
              <div className="gh-end-score">{total}</div>
              <div className="gh-bar">
                <div className="gh-bar-fill" style={{ width: `${(total / scale) * 100}%` }} />
                <span className="gh-bar-mark you" style={{ left: `${(total / scale) * 100}%` }}>
                  {total}
                </span>
                <span className="gh-bar-mark avg" style={{ left: `${(average / scale) * 100}%` }}>
                  {Math.round(average)}
                  <small>moyenne</small>
                </span>
                <span className="gh-bar-mark best" style={{ left: `${(perfect.total / scale) * 100}%` }}>
                  {perfect.total}
                  <small>parfait</small>
                </span>
              </div>
            </div>
            <ul className="gh-end-list">
              {entities.map((e, i) => {
                const c = showPerfect ? perfect.perm[i] : picks[i]
                const r = matrix[i][c]
                const ok = matrix[i][picks[i]] === matrix[i][perfect.perm[i]] || picks[i] === perfect.perm[i]
                return (
                  <li key={e.id} style={{ borderLeftColor: showPerfect || ok ? 'var(--good)' : 'var(--bad)' }}>
                    <span className="gh-flag-s">{e.flag}</span>
                    <b>{e.name}</b>
                    <span className="gh-end-cat">
                      {categories[c].icon} {categories[c].label}
                    </span>
                    <span className="gh-end-rank" style={{ color: rankColor(r) }}>
                      {rankText(r)}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="gh-end-note">
              {correct} sur 8 correctes ({Math.round((correct / 8) * 100)} %) ·{' '}
              <button onClick={() => setShowPerfect(!showPerfect)}>{showPerfect ? 'Voir mes choix' : 'Voir parfait'}</button>
            </p>
          </section>
          <nav className="gh-bottom">
            <a href="#/classement" className="gh-b">
              ←<small>Modes</small>
            </a>
            <button className="gh-b" onClick={async () => setCopied(await copyText(shareText))}>
              {copied ? '✓' : '⇪'}
              <small>{copied ? 'Copié' : 'Partager'}</small>
            </button>
            <button className="gh-replay ui-btn" onClick={restart}>
              ↗ Rejouer
            </button>
          </nav>
        </div>
      )}

      {toast && (
        <div className={toast.good ? 'gh-toast good' : 'gh-toast'}>
          <span>{toast.good ? '🏆' : '💡'}</span>
          <div>
            <b>{toast.title}</b>
            {toast.text && <p>{toast.text}</p>}
          </div>
        </div>
      )}

      {help && (
        <div className="gh-modal-bg" onClick={() => setHelp(false)}>
          <div className="gh-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Comment jouer</h2>
            <h3>Obtiens le score total le plus bas</h3>
            <p>
              Associe {mode === 'villes' ? 'chaque ville' : 'chaque pays'} à la catégorie où {mode === 'villes' ? 'elle' : 'il'} est le
              mieux classé·e.
            </p>
            <h3>Vise les rangs n°1 et le top 5</h3>
            <p>Un n°1 ajoute seulement 1 point. Les moins bons rangs en ajoutent davantage.</p>
            <h3>Chaque catégorie ne sert qu’une fois</h3>
            <p>Sans donnée, on compte le rang 100 : évite-les !</p>
            <button className="gh-replay ui-btn" onClick={() => setHelp(false)}>
              C’est parti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
