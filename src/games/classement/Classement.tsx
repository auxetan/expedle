import { useEffect, useMemo, useRef, useState } from 'react'
import { readChallenge } from '../../lib/challenge'
import { go } from '../../lib/router'
import { dailyResult, recordPlay, saveDailyResult, submitBest, useStopwatch } from '../../lib/stats'
import { copyText, todayKey, weekKey } from '../../lib/util'
import ChallengeBox from '../../ui/ChallengeBox'
import CountUp from '../../ui/CountUp'
import GhBar from './GhBar'
import ClassementHome from './ClassementHome'
import { averageTotal, MISSING_RANK, optimalAssignment } from './ranking'
import { MODE_LABEL, rankMatrix, setupFor, setupFromSeed, setupSeed, type Mode } from './setup'
import './classement.css'
import { ordinal, t } from '../../lib/i18n'
import { feedback } from '../../lib/feedback'

function rankColor(r: number): string {
  if (r <= 5) return 'var(--good)'
  if (r <= 20) return 'color-mix(in srgb, var(--good) 55%, var(--warn))'
  if (r <= 40) return 'var(--warn)'
  if (r <= 70) return 'var(--orange)'
  return 'var(--bad)'
}

const rankText = (r: number) => (r >= MISSING_RANK ? '100+' : String(r))
// 1er, 1st, 1.º… selon la langue du site
interface Toast {
  title: string
  text: string
  good: boolean
}

const MODES: Mode[] = ['classique', 'facile', 'monde', 'special', 'villes', 'jour', 'hebdo']

export default function Classement({ mode: raw, params }: { mode?: string; params: URLSearchParams }) {
  if (!MODES.includes(raw as Mode)) return <ClassementHome />
  return <ClassementGame mode={raw as Mode} easy={params.get('facile') === '1'} />
}

function ClassementGame({ mode, easy }: { mode: Mode; easy: boolean }) {
  const [challenge] = useState(readChallenge)
  const [seed, setSeed] = useState(0)
  // seed : chaque « Recommencer » relance un tirage
  const setup = useMemo(() => (challenge && !seed ? setupFromSeed(mode, challenge.seed) : null) ?? setupFor(mode, easy), [mode, easy, seed, challenge])
  const { entities, categories } = setup
  const matrix = useMemo(() => rankMatrix(setup), [setup])
  const perfect = useMemo(() => optimalAssignment(matrix), [matrix])
  const average = useMemo(() => averageTotal(matrix), [matrix])

  const dailyId = mode === 'jour' ? 'classement-jour' : mode === 'hebdo' ? 'classement-hebdo' : null
  const dayKey = mode === 'hebdo' ? weekKey() : todayKey()
  const done = dailyId && !challenge ? dailyResult<{ picks: number[] }>(dailyId, dayKey) : null
  const [picks, setPicks] = useState<number[]>(done?.picks ?? [])
  const [between, setBetween] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [float, setFloat] = useState<number | null>(null)
  const [help, setHelp] = useState(false)
  const [showPerfect, setShowPerfect] = useState(false)
  const [copied, setCopied] = useState(false)
  const toastTimer = useRef(0)
  // les meilleurs choix d'affilée, qui font monter la note
  const run = useRef(0)
  const elapsed = useStopwatch()
  const [ms, setMs] = useState<number>()

  const current = picks.length
  const finished = current >= entities.length
  const total = picks.reduce((s, cat, i) => s + matrix[i][cat], 0)
  const usedCats = new Set(picks)

  useEffect(() => {
    if (!finished || done) return
    const time = elapsed()
    setMs(time)
    recordPlay('classement-' + mode, { pts: (100 * perfect.total) / Math.max(total, 1), s: total, ms: time, sub: challenge && !seed ? 'defi' : easy ? 'facile' : undefined })
    submitBest(`classement-${mode}${easy ? '-facile' : ''}`, total, true)
    if (dailyId && !challenge) saveDailyResult(dailyId, { picks, total }, dayKey)
  }, [finished, done, mode, easy, picks, total, dailyId, dayKey, perfect.total, elapsed, challenge, seed])

  function choose(ci: number) {
    if (finished || between || usedCats.has(ci)) return
    const r = matrix[current][ci]
    const best = Math.min(...categories.map((_, c) => (usedCats.has(c) ? Infinity : matrix[current][c])))
    const bestCat = categories.findIndex((_, c) => !usedCats.has(c) && matrix[current][c] === best)
    const good = r === best
    feedback(good ? 'good' : 'bad', run.current)
    run.current = good ? run.current + 1 : 0
    window.clearTimeout(toastTimer.current)
    setToast(
      good
        ? {
            title: r <= 10 ? t('Excellent !') : t('Bon choix !'),
            text: r >= MISSING_RANK ? t('Aucune meilleure option restante.') : t('Ce pays est classé {rank} dans cette catégorie.', { rank: ordinal(r) }),
            good,
          }
        : { title: t('Meilleur choix : {cat} {rank}', { cat: t(categories[bestCat].label), rank: rankText(best) }), text: '', good },
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
    if (challenge && !seed && dailyId) return go('/classement/classique')
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

  const shareText = `GeoHunter ${t(MODE_LABEL[mode])}${dailyId ? ' ' + dayKey : ''}\n${t('Total : {total} (parfait : {best})', { total, best: perfect.total })}\n${picks
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
              <span className="gh-total-label">
                {t(MODE_LABEL[mode])}
                {easy ? ` ${t('facile')}` : ''} · {t('total')}
              </span>
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
              {dailyId && <span className="gh-goal">{t('Objectif : {n}', { n: perfect.total })}</span>}
            </div>
            <div className="gh-side">
              <button className="ui-tool" onClick={() => setHelp(true)} aria-label={t('Aide')}>
                ?
              </button>
              <button className="ui-tool" onClick={restart} aria-label={t('Recommencer')}>
                ↻
              </button>
            </div>
          </header>

          <main className="gh-card">
            <div className={between ? 'gh-entity between' : 'gh-entity'} key={entity.id}>
              {between ? (
                <span className="gh-ready">🎯 {t('Prêt à jouer !')}</span>
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
                      <span className="gh-cat-label">{t(c.label)}</span>
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
            ↻ {t('Recommencer')}
          </button>
        </div>
      ) : (
        <div className="gh-wrap">
          <section className="gh-end">
            <div className="gh-end-head">
              <div className="gh-end-title">
                <span className="gh-end-icon">◎</span> {t(MODE_LABEL[mode]).toUpperCase()}
              </div>
              <div className="gh-end-score">
                <CountUp value={total} />
              </div>
              <div className="gh-bar">
                <div className="gh-bar-fill" style={{ width: `${(total / scale) * 100}%` }} />
                <span className="gh-bar-mark you" style={{ left: `${(total / scale) * 100}%` }}>
                  {total}
                </span>
                <span className="gh-bar-mark avg" style={{ left: `${(average / scale) * 100}%` }}>
                  {Math.round(average)}
                  <small>{t('moyenne')}</small>
                </span>
                <span className="gh-bar-mark best" style={{ left: `${(perfect.total / scale) * 100}%` }}>
                  {perfect.total}
                  <small>{t('parfait')}</small>
                </span>
              </div>
            </div>
            <ul className="gh-end-list stagger">
              {entities.map((e, i) => {
                const c = showPerfect ? perfect.perm[i] : picks[i]
                const r = matrix[i][c]
                const ok = matrix[i][picks[i]] === matrix[i][perfect.perm[i]] || picks[i] === perfect.perm[i]
                return (
                  <li key={e.id} style={{ borderLeftColor: showPerfect || ok ? 'var(--good)' : 'var(--bad)' }}>
                    <span className="gh-flag-s">{e.flag}</span>
                    <b>{e.name}</b>
                    <span className="gh-end-cat">
                      {categories[c].icon} {t(categories[c].label)}
                    </span>
                    <span className="gh-end-rank" style={{ color: rankColor(r) }}>
                      {rankText(r)}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="gh-end-note">
              {t('{n} sur 8 correctes ({pct} %)', { n: correct, pct: Math.round((correct / 8) * 100) })} ·{' '}
              <button onClick={() => setShowPerfect(!showPerfect)}>{showPerfect ? t('Voir mes choix') : t('Voir parfait')}</button>
            </p>
            <ChallengeBox
              game={'classement-' + mode}
              path={`/classement/${mode}${easy ? '?facile=1' : ''}`}
              seed={setupSeed(mode, setup)}
              result={{ pts: (100 * perfect.total) / Math.max(total, 1), s: total, ms }}
            />
          </section>
          <nav className="gh-bottom">
            <a href="#/classement" className="gh-b">
              ←<small>{t('Modes')}</small>
            </a>
            <button className="gh-b" onClick={async () => setCopied(await copyText(shareText))}>
              {copied ? '✓' : '⇪'}
              <small>{copied ? t('Copié') : t('Partager')}</small>
            </button>
            <button className="gh-replay ui-btn" onClick={restart}>
              ↗ {t('Rejouer')}
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
            <h2>{t('Comment jouer')}</h2>
            <h3>{t('Obtiens le score total le plus bas')}</h3>
            <p>
              {mode === 'villes' ? t('Associe chaque ville à la catégorie où elle est le mieux classée.') : t('Associe chaque pays à la catégorie où il est le mieux classé.')}
            </p>
            <h3>{t('Vise les rangs n°1 et le top 5')}</h3>
            <p>{t('Un n°1 ajoute seulement 1 point. Les moins bons rangs en ajoutent davantage.')}</p>
            <h3>{t('Chaque catégorie ne sert qu’une fois')}</h3>
            <p>{t('Sans donnée, on compte le rang 100 : évite-les !')}</p>
            <button className="gh-replay ui-btn" onClick={() => setHelp(false)}>
              {t('C’est parti')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
