import { useMemo, useState } from 'react'
import { worldAtlas } from '../../geo/atlas'
import { flagEmoji } from '../../geo/countries'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { newSeed, readChallenge } from '../../lib/challenge'
import { go } from '../../lib/router'
import { copyText, load, save, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import CountryInput from '../../ui/CountryInput'
import { check, makeGrid, MAX_GUESSES, score } from './game'
import './geogrid.css'
import { plural, t } from '../../lib/i18n'
import { stamp } from '../../lib/passport'
import { feedback } from '../../lib/feedback'

interface Saved {
  cells: (string | null)[]
  guesses: number
  ms?: number
}

const EMPTY: Saved = { cells: Array(9).fill(null), guesses: 0 }
const MESSAGES = { wrong: () => t('Ce pays ne remplit pas les deux critères.'), used: () => t('Ce pays est déjà dans la grille.') }

export default function GeoGrid({ mode }: { mode?: string }) {
  const [challenge] = useState(readChallenge)
  const practice = mode === 'libre' || !!challenge
  const atlas = worldAtlas()
  const day = todayKey()
  const storageKey = practice ? null : `geogrid:${day}`
  const [seed, setSeed] = useState(() => challenge?.seed ?? (practice ? newSeed() : day))
  const grid = useMemo(() => makeGrid(atlas, seed), [atlas, seed])
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, EMPTY) : EMPTY))
  const [active, setActive] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(seed)

  const filled = state.cells.filter(Boolean).length
  const over = filled === 9 || state.guesses >= MAX_GUESSES

  function update(next: Saved) {
    const done = next.cells.filter(Boolean).length === 9 || next.guesses >= MAX_GUESSES
    const ms = elapsed()
    if (done) next = { ...next, ms }
    setState(next)
    if (storageKey) save(storageKey, next)
    if (!done) return
    if (!practice && !dailyResult('geogrid', day)) saveDailyResult('geogrid', { score: next.cells.filter(Boolean).length }, day)
    recordPlay('geogrid', { pts: score(next.cells), s: next.cells.filter(Boolean).length, ms, sub: challenge ? 'defi' : practice ? 'libre' : undefined })
  }

  function guess(code: string) {
    if (active === null) return
    const result = check(grid, state.cells, active, code)
    // un pays déjà placé n'use pas d'essai : c'est une étourderie, pas une erreur
    if (result === 'used') return setMessage(MESSAGES.used())
    const cells = [...state.cells]
    feedback(result === 'ok' ? 'good' : 'bad')
    if (result === 'ok') {
      stamp(code, 'geogrid')
      cells[active] = code
      setActive(null)
      setMessage('')
    } else {
      setMessage(MESSAGES.wrong())
      setShake(active)
      setTimeout(() => setShake(null), 450)
    }
    update({ cells, guesses: state.guesses + 1 })
  }

  async function share() {
    const lines = [0, 1, 2].map((r) => [0, 1, 2].map((c) => (state.cells[r * 3 + c] ? '🟩' : '⬛')).join(''))
    const text = `GeoGrid Méridien ${practice ? t('(partie libre)') : day} ${filled}/9\n${lines.join('\n')}`
    setToast((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  const cellLabel = (i: number) => `${t(grid.rows[Math.floor(i / 3)].label)} · ${t(grid.cols[i % 3].label)}`

  return (
    <div className="gr">
      <AppBar title="GeoGrid">
        <SubLink href="#/geogrid" active={!practice}>
          {t('Grille du jour')}
        </SubLink>
        <SubLink href="#/geogrid/libre" active={practice && !challenge}>
          {t('Partie libre')}
        </SubLink>
      </AppBar>
      <main className="gr-main">
        <p className="gr-intro muted">
          {t('Trouve pour chaque case un pays qui remplit le critère de sa ligne et celui de sa colonne. {n} essais, chaque pays une seule fois.', { n: MAX_GUESSES })}
        </p>

        <div className="gr-board" role="grid" aria-label={t('Grille de GeoGrid')}>
          <span className="gr-corner">
            <b>{Math.max(0, MAX_GUESSES - state.guesses)}</b>
            {plural(Math.max(0, MAX_GUESSES - state.guesses), 'essai', 'essais')}
          </span>
          {grid.cols.map((c) => (
            <span key={c.id} className="gr-head col" role="columnheader">
              {t(c.label)}
            </span>
          ))}
          {grid.rows.map((r, ri) => (
            <div key={r.id} className="gr-line" role="row">
              <span className="gr-head row" role="rowheader">
                {t(r.label)}
              </span>
              {grid.cols.map((_, ci) => {
                const i = ri * 3 + ci
                const code = state.cells[i]
                const cls = ['gr-cell', code ? 'done' : '', active === i ? 'active' : '', shake === i ? 'shake' : ''].join(' ')
                return (
                  <button
                    key={i}
                    role="gridcell"
                    className={cls}
                    disabled={!!code || over}
                    aria-label={code ? `${cellLabel(i)} : ${atlas.name(code)}` : cellLabel(i)}
                    onClick={() => {
                      setActive(i)
                      setMessage('')
                    }}
                  >
                    {code ? (
                      <>
                        <span className="gr-flag">{flagEmoji(code)}</span>
                        <small>{atlas.name(code)}</small>
                      </>
                    ) : over ? (
                      <small className="muted">{t('{n} possibles', { n: grid.answers[i].length })}</small>
                    ) : (
                      <span className="gr-plus">+</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {!over && active !== null && (
          <section className="gr-ask" ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}>
            <p>
              <b>{t(grid.rows[Math.floor(active / 3)].label)}</b> + <b>{t(grid.cols[active % 3].label)}</b>
            </p>
            <CountryInput key={active} atlas={atlas} used={new Set()} onPick={guess} placeholder={t('Un pays qui convient…')} button={t('Placer')} autoFocus />
            {message && <p className="gr-message">{message}</p>}
          </section>
        )}
        {!over && active === null && <p className="gr-hint muted">{t('Choisis une case pour commencer.')}</p>}

        {over && (
          <section className="gr-end">
            <b>{filled === 9 ? t('Grille complète, bravo !') : plural(filled, '{n} case sur 9.', '{n} cases sur 9.')}</b>
            <div className="gr-actions">
              <button className="ui-btn" onClick={share}>
                {t('Partager')}
              </button>
              {practice ? (
                <button
                  className="ui-btn line"
                  onClick={() => {
                    if (challenge) return go('/geogrid/libre')
                    setSeed(newSeed())
                    setState(EMPTY)
                    setActive(null)
                  }}
                >
                  {t('Une autre grille ↻')}
                </button>
              ) : (
                <a className="ui-btn line" href="#/geogrid/libre">
                  {t('Partie libre')}
                </a>
              )}
            </div>
            <ChallengeBox game="geogrid" path="/geogrid" seed={seed} result={{ pts: score(state.cells), s: filled, ms: state.ms }} />
            <details className="gr-solutions">
              <summary>{t('Voir toutes les réponses possibles')}</summary>
              {grid.answers.map((list, i) => (
                <p key={i}>
                  <b>{cellLabel(i)}</b> ({list.length}) : {list.map((c) => atlas.name(c)).join(', ')}
                </p>
              ))}
            </details>
          </section>
        )}
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
