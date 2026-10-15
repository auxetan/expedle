import { useEffect, useMemo, useRef, useState } from 'react'
import { go } from '../../lib/router'
import { dailyResult, recordPlay, saveDailyResult } from '../../lib/stats'
import { copyText, seededRng, shuffle, todayKey } from '../../lib/util'
import { cityCategories, cityEntities, countryCategories, countryEntities, type Category, type Entity } from './categories'
import { averageTotal, MISSING_RANK, optimalAssignment } from './ranking'
import './classement.css'

type Mode = 'classique' | 'villes' | 'jour'

const MODE_LABEL: Record<Mode, string> = { classique: 'Classique', villes: 'Villes', jour: 'Défi du jour' }

function rankColor(r: number): string {
  if (r <= 5) return '#5fd38d'
  if (r <= 20) return '#b6e36b'
  if (r <= 40) return '#ffc94d'
  if (r <= 70) return '#ff9a4d'
  return '#ff5d6c'
}

const rankText = (r: number) => (r >= MISSING_RANK ? '100+' : String(r))
const ordinal = (r: number) => (r === 1 ? '1er' : `${r}e`)

interface Toast {
  title: string
  text: string
  good: boolean
}

function setup(mode: Mode) {
  const rng = mode === 'jour' ? seededRng('classement-' + todayKey()) : Math.random
  if (mode === 'villes') {
    return { entities: shuffle(cityEntities(), rng).slice(0, 8), categories: cityCategories() }
  }
  return { entities: shuffle(countryEntities(), rng).slice(0, 8), categories: shuffle(countryCategories(), rng).slice(0, 8) }
}

export default function Classement({ mode: raw }: { mode?: string }) {
  const mode: Mode = raw === 'villes' ? 'villes' : raw === 'jour' ? 'jour' : 'classique'
  const [seed, setSeed] = useState(0)
  // seed : chaque « Recommencer » relance un tirage
  const { entities, categories } = useMemo(() => setup(mode), [mode, seed])
  const rank = (e: Entity, c: Category) => Math.min(MISSING_RANK, c.ranks.get(e.id) ?? MISSING_RANK)
  const matrix = useMemo(() => entities.map((e) => categories.map((c) => rank(e, c))), [entities, categories])
  const perfect = useMemo(() => optimalAssignment(matrix), [matrix])
  const average = useMemo(() => averageTotal(matrix), [matrix])

  const done = mode === 'jour' ? dailyResult<{ picks: number[] }>('classement-jour') : null
  const [picks, setPicks] = useState<number[]>(done?.picks ?? [])
  const [between, setBetween] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [float, setFloat] = useState<number | null>(null)
  const [help, setHelp] = useState(false)
  const [menu, setMenu] = useState(false)
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
    if (mode === 'jour') saveDailyResult('classement-jour', { picks, total })
  }, [finished, done, mode, picks, total])

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
    if (mode === 'jour') {
      go('/classement')
      return
    }
    setPicks([])
    setToast(null)
    setShowPerfect(false)
    setSeed((s) => s + 1)
  }

  const entity = entities[Math.min(current, entities.length - 1)]
  const correct = picks.filter((c, i) => perfect.perm[i] === c || matrix[i][c] === matrix[i][perfect.perm[i]]).length

  const shareText = `Classement ${MODE_LABEL[mode]}${mode === 'jour' ? ' ' + todayKey() : ''}\nTotal : ${total} (parfait : ${perfect.total})\n${picks
    .map((c, i) => {
      const r = matrix[i][c]
      return r <= 5 ? '🟩' : r <= 20 ? '🟨' : r <= 40 ? '🟧' : '🟥'
    })
    .join('')}`

  const scale = Math.max(total, average) * 1.15 || 1

  return (
    <div className={`gh gh-${mode}`}>
      <div className="gh-sky" aria-hidden />
      {!finished ? (
        <div className="gh-wrap">
          <header className="gh-head">
            <a href="#/" className="gh-logo glass">
              <span className="gh-globe">🌍</span>
              <span className="gh-logo-text">Classement</span>
              <span className="gh-mode">{MODE_LABEL[mode]}</span>
            </a>
            <div className="gh-total glass">
              <span className="gh-total-label">TOTAL</span>
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
              {mode === 'jour' && <span className="gh-goal">OBJECTIF : {perfect.total}</span>}
            </div>
            <div className="gh-side glass">
              <button onClick={() => setHelp(true)} aria-label="Aide">
                ?
              </button>
              <button onClick={restart} aria-label="Recommencer">
                ↻
              </button>
              <button onClick={() => setMenu(!menu)} aria-label="Modes">
                ⚙
              </button>
              {menu && (
                <nav className="gh-menu" onClick={() => setMenu(false)}>
                  <a href="#/classement">Classique (pays)</a>
                  <a href="#/classement/villes">Villes</a>
                  <a href="#/classement/jour">Défi du jour</a>
                  <a href="#/">Hub Culture G</a>
                </nav>
              )}
            </div>
          </header>

          <main className="gh-card">
            <button className="gh-q" onClick={() => setHelp(true)} aria-label="Aide">
              ?
            </button>
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
          <button className="gh-restart glass" onClick={restart}>
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
                  <li key={e.id} style={{ borderLeftColor: showPerfect || ok ? '#5fd38d' : '#ff6b6b' }}>
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
            <a href="#/" className="gh-b">
              ←<small>Accueil</small>
            </a>
            <button className="gh-b" onClick={async () => setCopied(await copyText(shareText))}>
              {copied ? '✓' : '⇪'}
              <small>{copied ? 'Copié' : 'Partager'}</small>
            </button>
            <button className="gh-replay" onClick={restart}>
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
            <button className="gh-replay" onClick={() => setHelp(false)}>
              C’est parti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
