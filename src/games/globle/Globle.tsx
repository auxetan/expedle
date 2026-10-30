import { useMemo, useState } from 'react'
import { worldAtlas } from '../../geo/atlas'
import { borderDistanceKm } from '../../geo/measure'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { newSeed, readChallenge } from '../../lib/challenge'
import { go } from '../../lib/router'
import { copyText, load, save, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import CountryInput from '../../ui/CountryInput'
import { cssColor, useTheme } from '../../ui/theme'
import GlobeView from './GlobeView'
import { dailyTarget, heat } from './game'
import './globle.css'
import { locale, plural, t } from '../../lib/i18n'
import { stamp } from '../../lib/passport'
import { record } from '../../lib/savoir'
import { feedback } from '../../lib/feedback'

interface Saved {
  guesses: string[]
  gaveUp?: boolean
  ms?: number
}

const fmtKm = (km: number) => `${Math.round(km).toLocaleString(locale())} km`
const points = (win: boolean, n: number) => (win ? Math.max(10, 100 - 5 * (n - 1)) : 0)

export default function Globle({ mode }: { mode?: string }) {
  const [challenge] = useState(readChallenge)
  const practice = mode === 'libre' || !!challenge
  const atlas = worldAtlas()
  const day = todayKey()
  const storageKey = practice ? null : `globle:${day}`
  const [seed, setSeed] = useState(() => challenge?.seed ?? (practice ? newSeed() : day))
  const target = useMemo(() => dailyTarget(atlas, seed), [atlas, seed])
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, { guesses: [] }) : { guesses: [] }))
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(target)
  // s'abonne au thème : les couleurs lues ci-dessous changent avec lui
  useTheme()
  const good = cssColor('--good')

  const guesses = useMemo(
    () => state.guesses.map((code) => ({ code, km: borderDistanceKm(atlas, code, target) })),
    [state.guesses, atlas, target],
  )
  const won = state.guesses.includes(target)
  const over = won || !!state.gaveUp
  const fills = useMemo(() => {
    const m = new Map(guesses.map((g) => [g.code, g.code === target ? good : heat(g.km)]))
    if (state.gaveUp) m.set(target, good)
    return m
  }, [guesses, target, good, state.gaveUp])
  const sorted = [...guesses].sort((a, b) => a.km - b.km)
  const closest = sorted.find((g) => g.code !== target)
  const last = state.guesses.at(-1) ?? null

  function update(next: Saved) {
    setState(next)
    if (storageKey) save(storageKey, next)
  }

  function guess(code: string) {
    const guesses = [...state.guesses, code]
    if (code !== target) {
      const km = borderDistanceKm(atlas, code, target)
      // plus c'est chaud, plus la note monte
      feedback('tap', km < 500 ? 5 : km < 2000 ? 3 : km < 6000 ? 1 : 0)
      return update({ ...state, guesses })
    }
    const ms = elapsed()
    update({ ...state, guesses, ms })
    stamp(target, 'globle')
    finish(guesses.length, true, ms)
  }

  function finish(n: number, win: boolean, ms: number) {
    // sans limite d'essais, Globle ne se perd qu'en abandonnant
    record(target, 'position', win)
    if (!practice && !dailyResult('globle', day)) saveDailyResult('globle', { won: win, guesses: n }, day)
    recordPlay('globle', { pts: points(win, n), s: n, win, ms, sub: challenge ? 'defi' : practice ? 'libre' : undefined })
  }

  function giveUp() {
    const ms = elapsed()
    update({ ...state, gaveUp: true, ms })
    finish(state.guesses.length, false, ms)
  }

  function another() {
    if (challenge) return go('/globle/libre')
    setSeed(newSeed())
    setState({ guesses: [] })
  }

  async function share() {
    const text = `Globle Expedle ${practice ? t('(partie libre)') : day}\n${won ? `🌍 ${plural(state.guesses.length, 'Trouvé en {n} essai', 'Trouvé en {n} essais')}` : `🏳️ ${t('Abandon')}`}\n${guesses
      .slice(0, 12)
      .map((g) => (g.code === target ? '🟩' : g.km < 500 ? '🟥' : g.km < 2000 ? '🟧' : g.km < 6000 ? '🟨' : '⬜'))
      .join('')}`
    setToast((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  return (
    <div className="gl">
      <AppBar title="Globle">
        <SubLink href="#/globle" active={!practice}>
          {t('Pays du jour')}
        </SubLink>
        <SubLink href="#/globle/libre" active={practice && !challenge}>
          {t('Partie libre')}
        </SubLink>
      </AppBar>
      <main className="gl-main">
        <section className="gl-globe">
          <GlobeView fills={fills} focus={over ? target : last} highlight={over ? target : last} />
          <p className="gl-hint muted">{t('Fais tourner le globe du doigt ou à la souris, zoome à la molette.')}</p>
        </section>
        <section className="gl-side">
          <header>
            <h1>{challenge ? t('Défi') : practice ? t('Partie libre') : t('Le pays mystère du jour')}</h1>
            <p className="muted">{t('Propose des pays : plus tu chauffes, plus ils rougissent. La couleur dit la distance entre les frontières.')}</p>
          </header>

          {over ? (
            <div className="gl-end">
              <b>{won ? t('Bravo ! Réponse : {name}', { name: atlas.name(target) }) : t('Réponse : {name}', { name: atlas.name(target) })}</b>
              <span className="muted">
                {won ? plural(state.guesses.length, 'Trouvé en {n} essai.', 'Trouvé en {n} essais.') : t('Tu feras mieux demain.')}
              </span>
              <div className="gl-actions">
                <button className="ui-btn" onClick={share}>
                  {t('Partager')}
                </button>
                {practice ? (
                  <button className="ui-btn line" onClick={another}>
                    {t('Un autre pays ↻')}
                  </button>
                ) : (
                  <a className="ui-btn line" href="#/globle/libre">
                    {t('Partie libre')}
                  </a>
                )}
              </div>
              <ChallengeBox
                game="globle"
                path="/globle"
                seed={seed}
                result={{ pts: points(won, state.guesses.length), s: state.guesses.length, win: won, ms: state.ms }}
              />
            </div>
          ) : (
            <>
              <CountryInput atlas={atlas} used={new Set(state.guesses)} onPick={guess} placeholder={t('Propose un pays…')} />
              <div className="gl-meta">
                <span>{plural(state.guesses.length, '{n} essai', '{n} essais')}</span>
                {closest && <span>{t('Le plus proche : {km}', { km: fmtKm(closest.km) })}</span>}
                {state.guesses.length >= 3 && (
                  <button className="gl-giveup" onClick={giveUp}>
                    {t('Révéler la réponse')}
                  </button>
                )}
              </div>
            </>
          )}

          {sorted.length > 0 && (
            <ol className="gl-list">
              {sorted.map((g) => (
                <li key={g.code} className={g.code === last ? 'new' : ''}>
                  <i style={{ background: g.code === target ? good : heat(g.km) }} />
                  <span>{atlas.name(g.code)}</span>
                  <b>{g.code === target ? t('trouvé') : g.km === 0 ? t('voisin') : fmtKm(g.km)}</b>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
