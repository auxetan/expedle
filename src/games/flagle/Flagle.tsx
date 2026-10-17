import { useEffect, useMemo, useState } from 'react'
import { worldAtlas } from '../../geo/atlas'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import CountryInput from '../../ui/CountryInput'
import { evaluate, squares } from '../worldle/game'
import '../worldle/worldle.css'
import { dailyTarget, flagUrl, MAX_GUESSES, revealOrder, score, targets, TILES, visibleTiles } from './game'
import './flagle.css'

const tilesLabel = (n: number) => `${n} tuile${n > 1 ? 's' : ''}`

interface Saved {
  guesses: string[]
}

function Flag({ code, shown, order }: { code: string; shown: number; order: number[] }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    flagUrl(code).then((url) => alive && setSrc(url))
    return () => {
      alive = false
    }
  }, [code])
  const open = new Set(order.slice(0, shown))
  return (
    <div className="fg-flag" aria-label={`Drapeau à deviner, ${shown} tuile${shown > 1 ? 's' : ''} sur ${TILES} dévoilée${shown > 1 ? 's' : ''}`}>
      {src && <img src={src} alt="" draggable={false} />}
      <div className="fg-tiles">
        {Array.from({ length: TILES }, (_, i) => (
          <span key={i} className={open.has(i) ? 'open' : ''} />
        ))}
      </div>
    </div>
  )
}

export default function Flagle({ mode }: { mode?: string }) {
  const practice = mode === 'libre'
  const atlas = worldAtlas()
  const day = todayKey()
  const storageKey = practice ? null : `flagle:${day}`
  const random = () => targets(atlas)[Math.floor(Math.random() * targets(atlas).length)]
  const [target, setTarget] = useState(() => (practice ? random() : dailyTarget(atlas, day)))
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, { guesses: [] }) : { guesses: [] }))
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(target)

  const order = useMemo(() => revealOrder(practice ? target : day), [practice, target, day])
  const rows = useMemo(() => state.guesses.map((c) => evaluate(atlas, target, c)), [state.guesses, atlas, target])
  const won = state.guesses.includes(target)
  const over = won || state.guesses.length >= MAX_GUESSES
  const wrong = state.guesses.filter((c) => c !== target).length
  const shown = visibleTiles(wrong, over)

  function guess(code: string) {
    const next = { guesses: [...state.guesses, code] }
    setState(next)
    if (storageKey) save(storageKey, next)
    const n = next.guesses.length
    const win = code === target
    if (!win && n < MAX_GUESSES) return
    if (!practice && !dailyResult('flagle', day)) saveDailyResult('flagle', { won: win, guesses: n }, day)
    recordPlay('flagle', { pts: score(win, n), s: n, win, ms: elapsed(), sub: practice ? 'libre' : undefined })
  }

  async function share() {
    const tiles = `${visibleTiles(won ? state.guesses.length - 1 : MAX_GUESSES, false)}/${TILES} tuiles vues`
    const text = `Flagle Méridien ${practice ? '(partie libre)' : day} ${won ? state.guesses.length : 'X'}/${MAX_GUESSES} · ${tiles}\n${rows
      .map((r) => `${squares(r.proximity)}${r.arrow}`)
      .join('\n')}`
    setToast((await copyText(text)) ? 'Résultat copié !' : 'Copie impossible')
    setTimeout(() => setToast(''), 1800)
  }

  return (
    <div className="wd">
      <AppBar title="Flagle">
        <SubLink href="#/flagle" active={!practice}>
          Drapeau du jour
        </SubLink>
        <SubLink href="#/flagle/libre" active={practice}>
          Partie libre
        </SubLink>
      </AppBar>
      <main className="wd-main">
        <div className={over ? 'wd-stage over' : 'wd-stage'}>
          <Flag code={target} shown={shown} order={order} />
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

        {!over && <CountryInput atlas={atlas} used={new Set(state.guesses)} onPick={guess} placeholder="À quel pays est ce drapeau ?" button="Deviner" />}

        {over && (
          <section className="wd-end">
            <b>{won ? `Bravo ! C’est ${atlas.name(target)}.` : `Perdu : c’était ${atlas.name(target)}.`}</b>
            <span className="muted">
              {won ? `Trouvé en ${state.guesses.length}/${MAX_GUESSES}, avec ${tilesLabel(visibleTiles(state.guesses.length - 1, false))} sur ${TILES}.` : 'Six essais, pas un de plus.'}
            </span>
            <div className="wd-actions">
              <button className="ui-btn" onClick={share}>
                Partager
              </button>
              {practice ? (
                <button
                  className="ui-btn line"
                  onClick={() => {
                    setTarget(random())
                    setState({ guesses: [] })
                  }}
                >
                  Un autre drapeau ↻
                </button>
              ) : (
                <a className="ui-btn line" href="#/flagle/libre">
                  Partie libre
                </a>
              )}
            </div>
          </section>
        )}
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
