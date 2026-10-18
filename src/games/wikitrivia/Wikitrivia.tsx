import { Fragment, useMemo, useState } from 'react'
import { newSeed, readChallenge } from '../../lib/challenge'
import { fmt, plural, t } from '../../lib/i18n'
import { go } from '../../lib/router'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, seededRng, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import { deck as makeDeck, DECK, fits, LIVES, score, sorted } from './game'
import './wikitrivia.css'

interface Saved {
  // pour chaque carte jouée, dans l'ordre du paquet : bien placée ou non
  results: boolean[]
  ms?: number
}

const yearLabel = (y: number) => (y < 0 ? t('{n} av. J.-C.', { n: fmt(-y, { useGrouping: false }) }) : fmt(y, { useGrouping: false }))

export default function Wikitrivia({ mode }: { mode?: string }) {
  const [challenge] = useState(readChallenge)
  const practice = mode === 'libre' || !!challenge
  const day = todayKey()
  const storageKey = practice ? null : `wikitrivia:${day}`
  const [seed, setSeed] = useState(() => challenge?.seed ?? (practice ? newSeed() : day))
  const cards = useMemo(() => makeDeck(seededRng('wikitrivia-' + seed)), [seed])
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, { results: [] }) : { results: [] }))
  const [flash, setFlash] = useState<{ name: string; ok: boolean } | null>(null)
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(seed)

  const played = state.results.length
  const good = state.results.filter(Boolean).length
  const lives = LIVES - (played - good)
  const over = lives <= 0 || played >= DECK - 1
  const current = over ? null : cards[played + 1]
  const timeline = useMemo(() => sorted(cards.slice(0, played + 1)), [cards, played])
  const verdict = new Map(cards.slice(1, played + 1).map((c, i) => [c.name, state.results[i]]))

  function place(index: number) {
    if (!current) return
    const ok = fits(timeline, index, current)
    const results = [...state.results, ok]
    const done = results.filter((r) => !r).length >= LIVES || results.length >= DECK - 1
    const ms = elapsed()
    const next = { results, ...(done ? { ms } : {}) }
    setState(next)
    if (storageKey) save(storageKey, next)
    setFlash({ name: current.name, ok })
    setTimeout(() => setFlash(null), 1200)
    if (!done) return
    const placed = results.filter(Boolean).length
    if (!practice && !dailyResult('wikitrivia', day)) saveDailyResult('wikitrivia', { placed }, day)
    recordPlay('wikitrivia', { pts: score(placed), s: placed, ms, sub: challenge ? 'defi' : practice ? 'libre' : undefined })
  }

  function another() {
    if (challenge) return go('/wikitrivia/libre')
    setSeed(newSeed())
    setState({ results: [] })
  }

  async function share() {
    const text = `Wikitrivia Méridien ${practice ? t('(partie libre)') : day} · ${good}/${DECK - 1}\n${state.results.map((r) => (r ? '🟩' : '🟥')).join('')}`
    setToast((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  return (
    <div className="wt">
      <AppBar title="Wikitrivia">
        <SubLink href="#/wikitrivia" active={!practice}>
          {t('Frise du jour')}
        </SubLink>
        <SubLink href="#/wikitrivia/libre" active={practice && !challenge}>
          {t('Partie libre')}
        </SubLink>
      </AppBar>
      <main className="wt-main">
        <div className="wt-hud">
          <span>{t('Carte {n} / {total}', { n: Math.min(played + 1, DECK - 1), total: DECK - 1 })}</span>
          <span className="wt-lives" aria-label={t('{n} vies', { n: lives })}>
            {Array.from({ length: LIVES }, (_, i) => (i < lives ? '❤️' : '🤍')).join('')}
          </span>
        </div>

        {current ? (
          <section className="wt-current" key={current.name}>
            <small>{t('Où placer cet événement ?')}</small>
            <b>{current.name}</b>
          </section>
        ) : (
          <section className="wt-end">
            <b>{plural(good, '{n} carte bien placée sur {total}', '{n} cartes bien placées sur {total}', { total: DECK - 1 })}</b>
            <span className="muted">{lives <= 0 ? t('Trois erreurs : la frise s’arrête là.') : t('Toute la frise est en place !')}</span>
            <div className="wt-actions">
              <button className="ui-btn" onClick={share}>
                {t('Partager')}
              </button>
              {practice ? (
                <button className="ui-btn line" onClick={another}>
                  {t('Une autre frise ↻')}
                </button>
              ) : (
                <a className="ui-btn line" href="#/wikitrivia/libre">
                  {t('Partie libre')}
                </a>
              )}
            </div>
            <ChallengeBox game="wikitrivia" path="/wikitrivia" seed={seed} result={{ pts: score(good), s: good, ms: state.ms }} />
          </section>
        )}

        {flash && <p className={flash.ok ? 'wt-flash ok' : 'wt-flash ko'}>{flash.ok ? t('Bien placé !') : t('Raté : la voici à sa vraie place.')}</p>}

        <ol className="wt-line">
          {timeline.map((c, i) => (
            <Fragment key={c.name}>
              {current && (
                <li className="wt-gap">
                  <button onClick={() => place(i)}>{i === 0 ? t('▲ Placer avant') : t('◆ Placer ici')}</button>
                </li>
              )}
              <li className={`wt-card ${verdict.get(c.name) === false ? 'ko' : ''} ${flash?.name === c.name ? 'new' : ''}`}>
                <span className="wt-year">{yearLabel(c.year)}</span>
                <span>{c.name}</span>
              </li>
            </Fragment>
          ))}
          {current && (
            <li className="wt-gap">
              <button onClick={() => place(timeline.length)}>{t('▼ Placer après')}</button>
            </li>
          )}
        </ol>
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
