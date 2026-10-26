import { useMemo, useState } from 'react'
import { newSeed, readChallenge } from '../../lib/challenge'
import { t } from '../../lib/i18n'
import { go } from '../../lib/router'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, seededRng, shuffle, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import { pickQuestions } from '../quiz/bank'
import './tightrope.css'
import { feedback, runOf } from '../../lib/feedback'

// Neuf questions sur la corde ; trois faux pas et c'est la chute.
const STEPS = 9
const LIVES = 3

interface Saved {
  answers: string[]
  ms?: number
}

const score = (good: number) => Math.round((100 * good) / STEPS)

export default function Tightrope({ mode }: { mode?: string }) {
  const [challenge] = useState(readChallenge)
  const practice = mode === 'libre' || !!challenge
  const day = todayKey()
  const storageKey = practice ? null : `tightrope:${day}`
  const [seed, setSeed] = useState(() => challenge?.seed ?? (practice ? newSeed() : day))
  const items = useMemo(() => {
    const rng = seededRng('tightrope-' + seed)
    return pickQuestions(rng, STEPS).map((q) => ({ ...q, options: shuffle([q.a, ...q.w], rng) }))
  }, [seed])
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, { answers: [] }) : { answers: [] }))
  // la question affichée : elle reste à l'écran, corrigée, jusqu'au clic sur « suivante »
  const [shown, setShown] = useState(state.answers.length)
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(seed)

  const good = state.answers.filter((a, i) => a === items[i].a).length
  const lives = LIVES - (state.answers.length - good)
  const over = lives <= 0 || state.answers.length >= STEPS
  const item = items[Math.min(shown, STEPS - 1)]
  const picked = state.answers[shown]

  function answer(option: string) {
    if (picked !== undefined || over) return
    const answers = [...state.answers, option]
    feedback(option === items[state.answers.length].a ? 'good' : 'bad', runOf(state.answers.map((a, i) => a === items[i].a)))
    const right = answers.filter((a, i) => a === items[i].a).length
    const done = answers.length - right >= LIVES || answers.length >= STEPS
    const ms = elapsed()
    const next = { answers, ...(done ? { ms } : {}) }
    setState(next)
    if (storageKey) save(storageKey, next)
    if (!done) return
    if (!practice && !dailyResult('tightrope', day)) saveDailyResult('tightrope', { good: right }, day)
    recordPlay('tightrope', { pts: score(right), s: right, win: answers.length - right < LIVES, ms, sub: challenge ? 'defi' : practice ? 'libre' : undefined })
  }

  function another() {
    if (challenge) return go('/tightrope/libre')
    setSeed(newSeed())
    setState({ answers: [] })
    setShown(0)
  }

  async function share() {
    const text = `Tightrope Expedle ${practice ? t('(partie libre)') : day} · ${good}/${STEPS}\n${state.answers.map((a, i) => (a === items[i].a ? '🟩' : '🟥')).join('')}${lives <= 0 ? ' 💥' : ' 🏁'}`
    setToast((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  // le bilan vient après la dernière réponse corrigée, une fois passée
  const ended = over && shown >= state.answers.length
  const fell = lives <= 0

  return (
    <div className="tr">
      <AppBar title="Tightrope">
        <SubLink href="#/tightrope" active={!practice}>
          {t('Corde du jour')}
        </SubLink>
        <SubLink href="#/tightrope/libre" active={practice && !challenge}>
          {t('Partie libre')}
        </SubLink>
      </AppBar>
      <main className="tr-main">
        <div className="tr-rope" aria-label={t('{n} questions réussies sur {total}', { n: good, total: STEPS })}>
          {items.map((it, i) => {
            const a = state.answers[i]
            return <span key={it.id} className={a === undefined ? '' : a === it.a ? 'ok' : 'ko'} />
          })}
          <i className={fell ? 'tr-walker fell' : 'tr-walker'} style={{ left: `${(Math.min(state.answers.length, STEPS) / STEPS) * 100}%` }}>
            {fell ? '💥' : over ? '🏁' : '🤸'}
          </i>
        </div>
        <div className="tr-hud">
          <span>{t('Question {n} / {total}', { n: Math.min(shown + 1, STEPS), total: STEPS })}</span>
          <span aria-label={t('{n} vies', { n: lives })}>{Array.from({ length: LIVES }, (_, i) => (i < lives ? '❤️' : '🤍')).join('')}</span>
        </div>

        {!ended && (
          <section className="tr-card" key={item.id}>
            <span className="tr-cat">{t(item.cat)}</span>
            <h2>{item.q}</h2>
            {item.big && <div className="tr-big">{item.big}</div>}
            <div className="tr-options">
              {item.options.map((o) => {
                const cls = picked === undefined ? '' : o === item.a ? 'right' : o === picked ? 'wrong' : 'dim'
                return (
                  <button key={o} className={cls} disabled={picked !== undefined} onClick={() => answer(o)}>
                    {o}
                  </button>
                )
              })}
            </div>
            {picked !== undefined && (
              <button className="ui-btn tr-next" onClick={() => setShown(shown + 1)} autoFocus>
                {over ? t('Voir le bilan') : picked === item.a ? t('Un pas de plus →') : t('Je me rattrape →')}
              </button>
            )}
          </section>
        )}

        {ended && (
          <section className="tr-end">
            <span className="tr-end-icon">{fell ? '💥' : '🏆'}</span>
            <b>{fell ? t('Chute après {n} bonnes réponses.', { n: good }) : t('Traversée réussie : {n} / {total} !', { n: good, total: STEPS })}</b>
            <div className="tr-actions">
              <button className="ui-btn" onClick={share}>
                {t('Partager')}
              </button>
              {practice ? (
                <button className="ui-btn line" onClick={another}>
                  {t('Une autre traversée ↻')}
                </button>
              ) : (
                <a className="ui-btn line" href="#/tightrope/libre">
                  {t('Partie libre')}
                </a>
              )}
            </div>
            <ChallengeBox game="tightrope" path="/tightrope" seed={seed} result={{ pts: score(good), s: good, win: !fell, ms: state.ms }} />
          </section>
        )}
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
