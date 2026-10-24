import { useMemo, useState } from 'react'
import { worldAtlas } from '../../geo/atlas'
import { COUNTRY_BY_CODE, flagEmoji } from '../../geo/countries'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { newSeed, readChallenge } from '../../lib/challenge'
import { go } from '../../lib/router'
import { copyText, load, save, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import CountryInput from '../../ui/CountryInput'
import Joker from '../../ui/Joker'
import { COUNTRY_STATS } from '../classement/data'
import { dailyTarget, evaluate, formatArea, formatGdp, formatPop, MAX_GUESSES, score, shareLine, type Clue, type Row } from './game'
import './countryle.css'
import { locale, plural, t } from '../../lib/i18n'
import { stamp } from '../../lib/passport'

interface Saved {
  guesses: string[]
  ms?: number
  // essais ajoutés par des jokers
  extra?: number
}

const STATS = new Map(COUNTRY_STATS.map((s) => [s.code, s]))

function Chip({ label, value, hit, trend }: { label: string; value: string; hit: 'hit' | 'near' | 'far'; trend?: Clue['trend'] }) {
  return (
    <span className={`cy-chip cy-${hit}`}>
      <small>{label}</small>
      <b>
        {value}
        {trend && <i aria-label={trend === 'up' ? t('plus') : t('moins')}>{trend === 'up' ? '↑' : '↓'}</i>}
      </b>
    </span>
  )
}

function Guess({ row, name }: { row: Row; name: string }) {
  const num = (c: Clue, f: (n: number) => string) => (c.value === null ? '—' : f(c.value))
  return (
    <li className="cy-guess">
      <div className="cy-head">
        <span className="cy-flag">{flagEmoji(row.code)}</span>
        <b>{name}</b>
        <span className="cy-dist">
          {row.km ? `${row.km.toLocaleString(locale())} km` : ''} {row.arrow}
        </span>
      </div>
      <div className="cy-chips">
        <Chip label={t('Continent')} value={t(row.continent.label)} hit={row.continent.hit ? 'hit' : 'far'} />
        <Chip label={t('Hémisphère')} value={t(row.hemisphere.label)} hit={row.hemisphere.hit ? 'hit' : 'far'} />
        <Chip label={t('Population')} value={num(row.pop, formatPop)} hit={row.pop.heat} trend={row.pop.trend} />
        <Chip label={t('Superficie')} value={num(row.area, formatArea)} hit={row.area.heat} trend={row.area.trend} />
        <Chip label={t('PIB')} value={num(row.gdp, formatGdp)} hit={row.gdp.heat} trend={row.gdp.trend} />
      </div>
    </li>
  )
}

export default function Countryle({ mode }: { mode?: string }) {
  const [challenge] = useState(readChallenge)
  const practice = mode === 'libre' || !!challenge
  const jokers = practice && !challenge
  const atlas = worldAtlas()
  const day = todayKey()
  const storageKey = practice ? null : `countryle:${day}`
  const [seed, setSeed] = useState(() => challenge?.seed ?? (practice ? newSeed() : day))
  const target = useMemo(() => dailyTarget(atlas, seed), [atlas, seed])
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, { guesses: [] }) : { guesses: [] }))
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(target)

  const rows = useMemo(() => state.guesses.map((c) => evaluate(atlas, target, c)), [state.guesses, atlas, target])
  const max = MAX_GUESSES + (state.extra ?? 0)
  const won = state.guesses.includes(target)
  const over = won || state.guesses.length >= max
  const facts = STATS.get(target)!

  function guess(code: string) {
    const win = code === target
    const n = state.guesses.length + 1
    const over = win || n >= max
    const ms = elapsed()
    const next = { ...state, guesses: [...state.guesses, code], ...(over ? { ms } : {}) }
    setState(next)
    if (storageKey) save(storageKey, next)
    if (!over) return
    if (win) stamp(target, 'countryle')
    if (!practice && !dailyResult('countryle', day)) saveDailyResult('countryle', { won: win, guesses: n }, day)
    recordPlay('countryle', { pts: score(win, n), s: n, win, ms, sub: challenge ? 'defi' : practice ? 'libre' : undefined })
  }

  async function share() {
    const text = `Countryle Expedle ${practice ? t('(partie libre)') : day} ${won ? state.guesses.length : 'X'}/${max}\n${rows.map(shareLine).join('\n')}`
    setToast((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  return (
    <div className="cy">
      <AppBar title="Countryle">
        <SubLink href="#/countryle" active={!practice}>
          {t('Pays du jour')}
        </SubLink>
        <SubLink href="#/countryle/libre" active={practice && !challenge}>
          {t('Partie libre')}
        </SubLink>
      </AppBar>
      <main className="cy-main">
        {!rows.length && (
          <p className="cy-intro">
            {t('Un pays mystère, {n} essais. Chaque proposition dit si tu as le bon continent et le bon hémisphère, si le pays mystère est plus ou moins peuplé, grand et riche, et dans quelle direction il se trouve.', { n: MAX_GUESSES })}{' '}
            <b className="cy-legend cy-hit">{t('à 10 %')}</b> <b className="cy-legend cy-near">{t('à moins d’un facteur 2')}</b>
          </p>
        )}

        {!over && (
          <>
            <p className="cy-count muted">
              {t('Essai {n} sur {max}', { n: state.guesses.length + 1, max })}
            </p>
            <CountryInput atlas={atlas} used={new Set(state.guesses)} onPick={guess} placeholder={t('Propose un pays…')} button={t('Deviner')} />
            {jokers && max - state.guesses.length === 1 && <Joker id="joker:essai" onUse={() => setState({ ...state, extra: (state.extra ?? 0) + 1 })} />}
          </>
        )}

        {over && (
          <section className="cy-end">
            <span className="cy-end-flag">{flagEmoji(target)}</span>
            <b>{won ? t('Bravo, c’était {name} !', { name: atlas.name(target) }) : t('Perdu : c’était {name}.', { name: atlas.name(target) })}</b>
            <span className="muted">
              {COUNTRY_BY_CODE.get(target)!.capital} · {t('{pop} d’habitants', { pop: formatPop(facts.pop) })} · {formatArea(facts.area)} · {formatGdp(facts.gdp)}
            </span>
            <span className="muted">{won ? plural(state.guesses.length, 'Trouvé en {n} essai.', 'Trouvé en {n} essais.') : t('{n} essais, pas un de plus.', { n: max })}</span>
            <div className="cy-actions">
              <button className="ui-btn" onClick={share}>
                {t('Partager')}
              </button>
              {practice ? (
                <button
                  className="ui-btn line"
                  onClick={() => {
                    if (challenge) return go('/countryle/libre')
                    setSeed(newSeed())
                    setState({ guesses: [] })
                  }}
                >
                  {t('Un autre pays ↻')}
                </button>
              ) : (
                <a className="ui-btn line" href="#/countryle/libre">
                  {t('Partie libre')}
                </a>
              )}
            </div>
            {!state.extra && (
              <ChallengeBox
                game="countryle"
                path="/countryle"
                seed={seed}
                result={{ pts: score(won, state.guesses.length), s: state.guesses.length, win: won, ms: state.ms }}
              />
            )}
          </section>
        )}

        <ol className="cy-guesses">
          {[...rows].reverse().map((r) => (
            <Guess key={r.code} row={r} name={atlas.name(r.code)} />
          ))}
        </ol>
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
