import { geoAzimuthalEqualArea, geoPath } from 'd3-geo'
import { useMemo, useState } from 'react'
import { worldAtlas } from '../../geo/atlas'
import { COUNTRY_BY_CODE, flagEmoji } from '../../geo/countries'
import { countryCenter } from '../../geo/measure'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, seededRng, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import CountryInput from '../../ui/CountryInput'
import { cssColor, useTheme } from '../../ui/theme'
import GlobeView from '../globle/GlobeView'
import { bonusChoices, dailyTarget, evaluate, MAX_GUESSES, squares, targets } from './game'
import './worldle.css'

interface Saved {
  guesses: string[]
  flag?: string
  capital?: string
}

const SIZE = 300

function Silhouette({ code, color }: { code: string; color: string }) {
  const atlas = worldAtlas()
  const d = useMemo(() => {
    const [lon, lat] = countryCenter(atlas, code)
    const feature = atlas.features.get(code)!
    const projection = geoAzimuthalEqualArea()
      .rotate([-lon, -lat])
      .fitExtent(
        [
          [12, 12],
          [SIZE - 12, SIZE - 12],
        ],
        feature,
      )
    return geoPath(projection)(feature) ?? ''
  }, [atlas, code])
  return (
    <svg className="wd-shape" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-label="Silhouette du pays à trouver">
      <path d={d} fill={color} />
    </svg>
  )
}

export default function Worldle({ mode }: { mode?: string }) {
  const practice = mode === 'libre'
  const atlas = worldAtlas()
  const day = todayKey()
  const storageKey = practice ? null : `worldle:${day}`
  const [target, setTarget] = useState(() => (practice ? targets(atlas)[Math.floor(Math.random() * targets(atlas).length)] : dailyTarget(atlas, day)))
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, { guesses: [] }) : { guesses: [] }))
  const [bonus, setBonus] = useState(false)
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(target)
  // s'abonne au thème : les couleurs lues ci-dessous changent avec lui
  useTheme()
  const colors = { fg: cssColor('--fg'), good: cssColor('--good'), bad: cssColor('--bad') }

  const rows = useMemo(() => state.guesses.map((c) => evaluate(atlas, target, c)), [state.guesses, atlas, target])
  const won = state.guesses.includes(target)
  const lost = !won && state.guesses.length >= MAX_GUESSES
  const over = won || lost
  const meta = COUNTRY_BY_CODE.get(target)!
  const choices = useMemo(() => bonusChoices(target, practice ? Math.random : seededRng('worldle-bonus-' + day)), [target, practice, day])

  function update(next: Saved) {
    setState(next)
    if (storageKey) save(storageKey, next)
  }

  function guess(code: string) {
    const next = { ...state, guesses: [...state.guesses, code] }
    update(next)
    const n = next.guesses.length
    const win = code === target
    if (!win && n < MAX_GUESSES) return
    if (!practice && !dailyResult('worldle', day)) saveDailyResult('worldle', { won: win, guesses: n }, day)
    recordPlay('worldle', { pts: win ? Math.round((100 * (MAX_GUESSES + 1 - n)) / MAX_GUESSES) : 0, s: n, win, ms: elapsed() })
  }

  function another() {
    const list = targets(atlas)
    setTarget(list[Math.floor(Math.random() * list.length)])
    setState({ guesses: [] })
    setBonus(false)
  }

  async function share() {
    const stars = (state.flag === target ? '⭐' : '') + (state.capital === meta.capital ? '⭐' : '')
    const text = `Worldle Méridien ${practice ? '(partie libre)' : day} ${won ? state.guesses.length : 'X'}/${MAX_GUESSES}${stars ? ' ' + stars : ''}\n${rows
      .map((r) => `${squares(r.proximity)}${r.arrow}`)
      .join('\n')}`
    setToast((await copyText(text)) ? 'Résultat copié !' : 'Copie impossible')
    setTimeout(() => setToast(''), 1800)
  }

  const answerColor = won ? colors.good : colors.bad
  const fills = useMemo(() => new Map([[target, answerColor]]), [target, answerColor])

  return (
    <div className="wd">
      <AppBar title="Worldle">
        <SubLink href="#/worldle" active={!practice}>
          Pays du jour
        </SubLink>
        <SubLink href="#/worldle/libre" active={practice}>
          Partie libre
        </SubLink>
      </AppBar>
      <main className="wd-main">
        <div className={over ? 'wd-stage over' : 'wd-stage'}>
          <Silhouette code={target} color={over ? (won ? colors.good : colors.bad) : colors.fg} />
        </div>

        <ol className="wd-rows">
          {Array.from({ length: MAX_GUESSES }, (_, i) => {
            const r = rows[i]
            return r ? (
              <li key={i} className="wd-row filled">
                <span className="wd-name">{atlas.name(r.code)}</span>
                <span className="wd-km">{r.km.toLocaleString('fr-FR')} km</span>
                <span className="wd-arrow">{r.arrow}</span>
                <span className="wd-prox">{r.proximity} %</span>
              </li>
            ) : (
              <li key={i} className="wd-row" />
            )
          })}
        </ol>

        {!over && <CountryInput atlas={atlas} used={new Set(state.guesses)} onPick={guess} placeholder="Quel est ce pays ?" button="🌍 Deviner" />}

        {over && !bonus && (
          <section className="wd-end">
            <b>{won ? `Bravo ! Réponse : ${atlas.name(target)}` : `Perdu. Réponse : ${atlas.name(target)}`}</b>
            <span className="muted">{won ? `Trouvé en ${state.guesses.length}/${MAX_GUESSES}.` : 'Six essais, pas un de plus.'}</span>
            <div className="wd-actions">
              <button className="ui-btn" onClick={() => setBonus(true)}>
                Manches bonus ★
              </button>
              <button className="ui-btn line" onClick={share}>
                Partager
              </button>
              {practice ? (
                <button className="ui-btn line" onClick={another}>
                  Un autre pays ↻
                </button>
              ) : (
                <a className="ui-btn line" href="#/worldle/libre">
                  Partie libre
                </a>
              )}
            </div>
            <GlobeView fills={fills} focus={target} highlight={target} maxSize={300} initialZoom={2.2} />
          </section>
        )}

        {over && bonus && (
          <section className="wd-bonus">
            <h2>Bonus 1 · Quel est le drapeau de ce pays ?</h2>
            <div className="wd-flags">
              {choices.flags.map((c) => {
                const picked = state.flag
                const cls = !picked ? '' : c === target ? 'right' : c === picked ? 'wrong' : 'dim'
                return (
                  <button key={c} className={cls} disabled={!!picked} onClick={() => update({ ...state, flag: c })} aria-label={picked ? atlas.name(c) : 'Drapeau'}>
                    <span>{flagEmoji(c)}</span>
                    {picked && <small>{atlas.name(c)}</small>}
                  </button>
                )
              })}
            </div>
            {state.flag && (
              <>
                <h2>Bonus 2 · Quelle est sa capitale ?</h2>
                <div className="wd-caps">
                  {choices.capitals.map((cap) => {
                    const picked = state.capital
                    const cls = !picked ? '' : cap === meta.capital ? 'right' : cap === picked ? 'wrong' : 'dim'
                    return (
                      <button key={cap} className={cls} disabled={!!picked} onClick={() => update({ ...state, capital: cap })}>
                        {cap}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {state.capital && (
              <div className="wd-actions">
                <b className="wd-stars">
                  {(state.flag === target ? 1 : 0) + (state.capital === meta.capital ? 1 : 0)} / 2 bonus
                </b>
                <button className="ui-btn" onClick={share}>
                  Partager
                </button>
                <button className="ui-btn line" onClick={() => setBonus(false)}>
                  Retour au résultat
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
