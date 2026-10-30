import { useEffect, useMemo, useState } from 'react'
import { worldAtlas } from '../../geo/atlas'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { newSeed, readChallenge } from '../../lib/challenge'
import { go } from '../../lib/router'
import { copyText, load, save, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import CountryInput from '../../ui/CountryInput'
import Joker from '../../ui/Joker'
import { evaluate, squares } from '../worldle/game'
import '../worldle/worldle.css'
import { dailyTarget, flagUrl, MAX_GUESSES, revealOrder, score, TILES, visibleTiles } from './game'
import './flagle.css'
import { locale, plural, t } from '../../lib/i18n'
import { stamp } from '../../lib/passport'
import { record } from '../../lib/savoir'
import { feedback } from '../../lib/feedback'

const tilesLabel = (n: number) => plural(n, '{n} tuile', '{n} tuiles')

interface Saved {
  guesses: string[]
  ms?: number
  // essais ajoutés par des jokers
  extra?: number
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
    <div className="fg-flag" aria-label={t('Drapeau à deviner, {shown} tuiles sur {total} dévoilées', { shown, total: TILES })}>
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
  const [challenge] = useState(readChallenge)
  const practice = mode === 'libre' || !!challenge
  const jokers = practice && !challenge
  const atlas = worldAtlas()
  const day = todayKey()
  const storageKey = practice ? null : `flagle:${day}`
  const [seed, setSeed] = useState(() => challenge?.seed ?? (practice ? newSeed() : day))
  const target = useMemo(() => dailyTarget(atlas, seed), [atlas, seed])
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, { guesses: [] }) : { guesses: [] }))
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(target)

  const order = useMemo(() => revealOrder(seed), [seed])
  const rows = useMemo(() => state.guesses.map((c) => evaluate(atlas, target, c)), [state.guesses, atlas, target])
  const max = MAX_GUESSES + (state.extra ?? 0)
  const won = state.guesses.includes(target)
  const over = won || state.guesses.length >= max
  const wrong = state.guesses.filter((c) => c !== target).length
  const shown = visibleTiles(wrong, over)

  function guess(code: string) {
    const win = code === target
    const n = state.guesses.length + 1
    const over = win || n >= max
    const ms = elapsed()
    const next = { ...state, guesses: [...state.guesses, code], ...(over ? { ms } : {}) }
    setState(next)
    if (storageKey) save(storageKey, next)
    if (!over) return feedback('tap')
    if (win) stamp(target, 'flagle')
    record(target, 'drapeau', win)
    if (!practice && !dailyResult('flagle', day)) saveDailyResult('flagle', { won: win, guesses: n }, day)
    recordPlay('flagle', { pts: score(win, n), s: n, win, ms, sub: challenge ? 'defi' : practice ? 'libre' : undefined })
  }

  async function share() {
    const tiles = t('{n}/{total} tuiles vues', { n: visibleTiles(won ? state.guesses.length - 1 : MAX_GUESSES, false), total: TILES })
    const text = `Flagle Expedle ${practice ? t('(partie libre)') : day} ${won ? state.guesses.length : 'X'}/${max} · ${tiles}\n${rows
      .map((r) => `${squares(r.proximity)}${r.arrow}`)
      .join('\n')}`
    setToast((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  return (
    <div className="wd">
      <AppBar title="Flagle">
        <SubLink href="#/flagle" active={!practice}>
          {t('Drapeau du jour')}
        </SubLink>
        <SubLink href="#/flagle/libre" active={practice && !challenge}>
          {t('Partie libre')}
        </SubLink>
      </AppBar>
      <main className="wd-main">
        <div className={over ? 'wd-stage over' : 'wd-stage'}>
          <Flag code={target} shown={shown} order={order} />
        </div>

        <ol className="wd-rows">
          {Array.from({ length: max }, (_, i) => {
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

        {!over && <CountryInput atlas={atlas} used={new Set(state.guesses)} onPick={guess} placeholder={t('À quel pays est ce drapeau ?')} button={t('Deviner')} />}
        {!over && jokers && max - state.guesses.length === 1 && <Joker id="joker:essai" onUse={() => setState({ ...state, extra: (state.extra ?? 0) + 1 })} />}

        {over && (
          <section className="wd-end">
            <b>{won ? t('Bravo ! C’est {name}.', { name: atlas.name(target) }) : t('Perdu : c’était {name}.', { name: atlas.name(target) })}</b>
            <span className="muted">
              {won
                ? t('Trouvé en {n}/{max}, avec {tiles} sur {total}.', { n: state.guesses.length, max, tiles: tilesLabel(visibleTiles(state.guesses.length - 1, false)), total: TILES })
                : state.extra
                  ? t('{n} essais, pas un de plus.', { n: max })
                  : t('Six essais, pas un de plus.')}
            </span>
            <div className="wd-actions">
              <button className="ui-btn" onClick={share}>
                {t('Partager')}
              </button>
              {practice ? (
                <button
                  className="ui-btn line"
                  onClick={() => {
                    if (challenge) return go('/flagle/libre')
                    setSeed(newSeed())
                    setState({ guesses: [] })
                  }}
                >
                  {t('Un autre drapeau ↻')}
                </button>
              ) : (
                <a className="ui-btn line" href="#/flagle/libre">
                  {t('Partie libre')}
                </a>
              )}
            </div>
            {!state.extra && (
              <ChallengeBox
                game="flagle"
                path="/flagle"
                seed={seed}
                result={{ pts: score(won, state.guesses.length), s: state.guesses.length, win: won, ms: state.ms }}
              />
            )}
          </section>
        )}
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
