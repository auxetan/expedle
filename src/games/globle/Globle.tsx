import { useMemo, useState } from 'react'
import { worldAtlas } from '../../geo/atlas'
import { borderDistanceKm } from '../../geo/measure'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import CountryInput from '../../ui/CountryInput'
import { cssColor, useTheme } from '../../ui/theme'
import { targets } from '../worldle/game'
import GlobeView from './GlobeView'
import { dailyTarget, heat } from './game'
import './globle.css'

interface Saved {
  guesses: string[]
  gaveUp?: boolean
}

const fmtKm = (km: number) => `${Math.round(km).toLocaleString('fr-FR')} km`

export default function Globle({ mode }: { mode?: string }) {
  const practice = mode === 'libre'
  const atlas = worldAtlas()
  const day = todayKey()
  const storageKey = practice ? null : `globle:${day}`
  const [target, setTarget] = useState(() =>
    practice ? targets(atlas)[Math.floor(Math.random() * targets(atlas).length)] : dailyTarget(atlas, day),
  )
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
    const next = { guesses: [...state.guesses, code] }
    update(next)
    if (code === target) finish(next.guesses.length, true)
  }

  function finish(n: number, win: boolean) {
    if (!practice && !dailyResult('globle', day)) saveDailyResult('globle', { won: win, guesses: n }, day)
    recordPlay('globle', { pts: win ? Math.max(10, 100 - 5 * (n - 1)) : 0, s: n, win, ms: elapsed(), sub: practice ? 'libre' : undefined })
  }

  function giveUp() {
    update({ ...state, gaveUp: true })
    finish(state.guesses.length, false)
  }

  function another() {
    const list = targets(atlas)
    setTarget(list[Math.floor(Math.random() * list.length)])
    setState({ guesses: [] })
  }

  async function share() {
    const text = `Globle Méridien ${practice ? '(partie libre)' : day}\n${won ? `🌍 Trouvé en ${state.guesses.length} essai${state.guesses.length > 1 ? 's' : ''}` : '🏳️ Abandon'}\n${guesses
      .slice(0, 12)
      .map((g) => (g.code === target ? '🟩' : g.km < 500 ? '🟥' : g.km < 2000 ? '🟧' : g.km < 6000 ? '🟨' : '⬜'))
      .join('')}`
    setToast((await copyText(text)) ? 'Résultat copié !' : 'Copie impossible')
    setTimeout(() => setToast(''), 1800)
  }

  return (
    <div className="gl">
      <AppBar title="Globle">
        <SubLink href="#/globle" active={!practice}>
          Pays du jour
        </SubLink>
        <SubLink href="#/globle/libre" active={practice}>
          Partie libre
        </SubLink>
      </AppBar>
      <main className="gl-main">
        <section className="gl-globe">
          <GlobeView fills={fills} focus={over ? target : last} highlight={over ? target : last} />
          <p className="gl-hint muted">Fais tourner le globe du doigt ou à la souris, zoome à la molette.</p>
        </section>
        <section className="gl-side">
          <header>
            <h1>{practice ? 'Partie libre' : 'Le pays mystère du jour'}</h1>
            <p className="muted">Propose des pays : plus tu chauffes, plus ils rougissent. La couleur dit la distance entre les frontières.</p>
          </header>

          {over ? (
            <div className="gl-end">
              <b>{won ? `Bravo ! Réponse : ${atlas.name(target)}` : `Réponse : ${atlas.name(target)}`}</b>
              <span className="muted">
                {won ? `Trouvé en ${state.guesses.length} essai${state.guesses.length > 1 ? 's' : ''}.` : 'Tu feras mieux demain.'}
              </span>
              <div className="gl-actions">
                <button className="ui-btn" onClick={share}>
                  Partager
                </button>
                {practice ? (
                  <button className="ui-btn line" onClick={another}>
                    Un autre pays ↻
                  </button>
                ) : (
                  <a className="ui-btn line" href="#/globle/libre">
                    Partie libre
                  </a>
                )}
              </div>
            </div>
          ) : (
            <>
              <CountryInput atlas={atlas} used={new Set(state.guesses)} onPick={guess} placeholder="Propose un pays…" />
              <div className="gl-meta">
                <span>
                  {state.guesses.length} essai{state.guesses.length > 1 ? 's' : ''}
                </span>
                {closest && <span>Le plus proche : {fmtKm(closest.km)}</span>}
                {state.guesses.length >= 3 && (
                  <button className="gl-giveup" onClick={giveUp}>
                    Révéler la réponse
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
                  <b>{g.code === target ? 'trouvé' : g.km === 0 ? 'voisin' : fmtKm(g.km)}</b>
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
