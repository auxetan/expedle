import { useMemo, useState } from 'react'
import { worldAtlas } from '../../geo/atlas'
import { COUNTRY_BY_CODE } from '../../geo/countries'
import { newSeed, readChallenge } from '../../lib/challenge'
import { locale, t } from '../../lib/i18n'
import { go } from '../../lib/router'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import CountryInput from '../../ui/CountryInput'
import { evaluate, squares } from '../worldle/game'
import '../worldle/worldle.css'
import { capitalChoices, clues, MAX_GUESSES, score, target as pickTarget } from './game'
import './dailygeo.css'
import { stamp } from '../../lib/passport'
import { record } from '../../lib/savoir'
import { feedback } from '../../lib/feedback'

interface Saved {
  guesses: string[]
  capital?: string
  ms?: number
}

export default function DailyGeo({ mode }: { mode?: string }) {
  const [challenge] = useState(readChallenge)
  const practice = mode === 'libre' || !!challenge
  const atlas = worldAtlas()
  const day = todayKey()
  const storageKey = practice ? null : `dailygeo:${day}`
  const [seed, setSeed] = useState(() => challenge?.seed ?? (practice ? newSeed() : day))
  const target = useMemo(() => pickTarget(atlas, seed), [atlas, seed])
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, { guesses: [] }) : { guesses: [] }))
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(target)

  const meta = COUNTRY_BY_CODE.get(target)!
  const hints = useMemo(() => clues(target), [target])
  const options = useMemo(() => capitalChoices(target, seed), [target, seed])
  const rows = useMemo(() => state.guesses.map((c) => evaluate(atlas, target, c)), [state.guesses, atlas, target])
  const found = state.guesses.includes(target)
  const located = found || state.guesses.length >= MAX_GUESSES
  const over = located && state.capital !== undefined
  const shown = located ? hints.length : Math.min(hints.length, 1 + state.guesses.length)
  const capitalOk = state.capital === meta.capital
  const pts = score(found, state.guesses.length, capitalOk)

  function update(next: Saved) {
    setState(next)
    if (storageKey) save(storageKey, next)
  }

  function guess(code: string) {
    update({ ...state, guesses: [...state.guesses, code] })
    feedback(code === target ? 'good' : 'tap')
    if (code === target) stamp(target, 'dailygeo')
  }

  function answer(capital: string) {
    const ms = elapsed()
    update({ ...state, capital, ms })
    record(target, 'capitale', capital === meta.capital)
    const total = score(found, state.guesses.length, capital === meta.capital)
    if (!practice && !dailyResult('dailygeo', day)) saveDailyResult('dailygeo', { score: total }, day)
    recordPlay('dailygeo', { pts: total, s: total, win: found, ms, sub: challenge ? 'defi' : practice ? 'libre' : undefined })
  }

  function another() {
    if (challenge) return go('/dailygeo/libre')
    setSeed(newSeed())
    setState({ guesses: [] })
  }

  async function share() {
    const text = `DailyGeo Expedle ${practice ? t('(partie libre)') : day} ${found ? state.guesses.length : 'X'}/${MAX_GUESSES} ${capitalOk ? '🏛️' : '✖️'} · ${pts}/100\n${rows
      .map((r) => `${squares(r.proximity)}${r.arrow}`)
      .join('\n')}`
    setToast((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  return (
    <div className="wd">
      <AppBar title="DailyGeo">
        <SubLink href="#/dailygeo" active={!practice}>
          {t('Pays du jour')}
        </SubLink>
        <SubLink href="#/dailygeo/libre" active={practice && !challenge}>
          {t('Partie libre')}
        </SubLink>
      </AppBar>
      <main className="wd-main">
        {!state.guesses.length && <p className="dg-intro muted">{t('Un pays mystère, puis sa capitale. Chaque essai manqué dévoile un nouvel indice.')}</p>}

        <ol className="dg-clues">
          {hints.map((c, i) => (
            <li key={c.label} className={i < shown ? 'open' : ''}>
              <small>{t(c.label)}</small>
              <b>{i < shown ? c.value : '?'}</b>
            </li>
          ))}
        </ol>

        <ol className="wd-rows">
          {Array.from({ length: MAX_GUESSES }, (_, i) => {
            const r = rows[i]
            return r ? (
              <li key={i} className="wd-row filled">
                <span className="wd-name">{atlas.name(r.code)}</span>
                <span className="wd-km">{r.km.toLocaleString(locale())} km</span>
                <span className="wd-arrow">{r.arrow}</span>
                <span className="wd-prox">{r.proximity} %</span>
              </li>
            ) : (
              <li key={i} className="wd-row" />
            )
          })}
        </ol>

        {!located && <CountryInput atlas={atlas} used={new Set(state.guesses)} onPick={guess} placeholder={t('Quel est ce pays ?')} button={t('Deviner')} />}

        {located && (
          <section className="wd-bonus">
            <b className="dg-verdict">
              {found ? t('Bravo ! Réponse : {name}', { name: atlas.name(target) }) : t('Perdu. Réponse : {name}', { name: atlas.name(target) })}
            </b>
            <h2>{t('Et sa capitale ?')}</h2>
            <div className="wd-caps">
              {options.map((c) => {
                const picked = state.capital
                const cls = !picked ? '' : c === meta.capital ? 'right' : c === picked ? 'wrong' : 'dim'
                return (
                  <button key={c} className={cls} disabled={!!picked} onClick={() => answer(c)}>
                    {c}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {over && (
          <section className="wd-end">
            <b>{t('{n} / 100 points', { n: pts })}</b>
            <div className="wd-actions">
              <button className="ui-btn" onClick={share}>
                {t('Partager')}
              </button>
              {practice ? (
                <button className="ui-btn line" onClick={another}>
                  {t('Un autre pays ↻')}
                </button>
              ) : (
                <a className="ui-btn line" href="#/dailygeo/libre">
                  {t('Partie libre')}
                </a>
              )}
            </div>
            <ChallengeBox game="dailygeo" path="/dailygeo" seed={seed} result={{ pts, s: pts, win: found, ms: state.ms }} />
          </section>
        )}
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
