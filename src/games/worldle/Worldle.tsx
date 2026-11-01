import { geoAzimuthalEqualArea, geoPath } from 'd3-geo'
import { useEffect, useMemo, useState } from 'react'
import { loadAtlas, type Atlas, type AtlasId } from '../../geo/atlas'
import { flagEmoji } from '../../geo/countries'
import { countryCenter } from '../../geo/measure'
import { newSeed, readChallenge } from '../../lib/challenge'
import { go } from '../../lib/router'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, seededRng, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import CountryInput from '../../ui/CountryInput'
import Joker from '../../ui/Joker'
import { cssColor, useTheme } from '../../ui/theme'
import GlobeView from '../globle/GlobeView'
import { evaluate, MAX_GUESSES, pickTarget, squares, stateBonus, targets, worldBonus, type BonusRound } from './game'
import './worldle.css'
import { locale, msg, t } from '../../lib/i18n'
import { stamp } from '../../lib/passport'
import { record } from '../../lib/savoir'
import { feedback } from '../../lib/feedback'

interface Saved {
  guesses: string[]
  ms?: number
  // réponses aux manches bonus ; flag et capital seuls dans les parties enregistrées avant leur liste
  bonus?: Record<string, string>
  flag?: string
  capital?: string
  // essais ajoutés par des jokers
  extra?: number
}

// Worldle sur la carte du monde, Statele sur celle des États-Unis : même jeu, autre atlas.
const VARIANTS = {
  worldle: {
    title: 'Worldle',
    map: 'monde' as AtlasId,
    maxKm: 20000,
    daily: msg('Pays du jour'),
    ask: msg('Quel est ce pays ?'),
    another: msg('Un autre pays ↻'),
    shape: msg('Silhouette du pays à trouver'),
  },
  statele: {
    title: 'Statele',
    map: 'usa' as AtlasId,
    maxKm: 5000,
    daily: msg('État du jour'),
    ask: msg('Quel est cet État ?'),
    another: msg('Un autre État ↻'),
    shape: msg('Silhouette de l’État à trouver'),
  },
}
type Variant = keyof typeof VARIANTS

const SIZE = 300

// une victoire sur l'essai bonus d'un joker compte comme sur le dernier essai
const points = (win: boolean, n: number) => (win ? Math.round((100 * (MAX_GUESSES + 1 - Math.min(n, MAX_GUESSES))) / MAX_GUESSES) : 0)

function Silhouette({ atlas, code, color, label }: { atlas: Atlas; code: string; color: string; label: string }) {
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
    <svg className="wd-shape" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-label={label}>
      <path d={d} fill={color} />
    </svg>
  )
}

export default function Worldle({ mode, variant = 'worldle' }: { mode?: string; variant?: Variant }) {
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  useEffect(() => {
    let alive = true
    loadAtlas(VARIANTS[variant].map).then((a) => alive && setAtlas(a))
    return () => {
      alive = false
    }
  }, [variant])
  if (!atlas) return <div className="page-loading">{t('Chargement de la carte…')}</div>
  return <Game atlas={atlas} mode={mode} variant={variant} />
}

function Game({ atlas, mode, variant }: { atlas: Atlas; mode?: string; variant: Variant }) {
  const v = VARIANTS[variant]
  const [challenge] = useState(readChallenge)
  const practice = mode === 'libre' || !!challenge
  const jokers = practice && !challenge
  const day = todayKey()
  const storageKey = practice ? null : `${variant}:${day}`
  // le lieu du jour vient de la date, la partie libre et le défi d'une graine : un lien de défi rejoue le même lieu
  const [seed, setSeed] = useState(() => challenge?.seed ?? (practice ? newSeed() : day))
  const pool = useMemo(() => (variant === 'worldle' ? targets(atlas) : atlas.codes.filter((c) => c !== '11')), [atlas, variant])
  const target = useMemo(() => pickTarget(pool, `${variant}-${seed}`), [pool, variant, seed])
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, { guesses: [] }) : { guesses: [] }))
  const [bonus, setBonus] = useState(false)
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(target)
  // s'abonne au thème : les couleurs lues ci-dessous changent avec lui
  useTheme()
  const colors = { fg: cssColor('--fg'), good: cssColor('--good'), bad: cssColor('--bad') }

  const rows = useMemo(() => state.guesses.map((c) => evaluate(atlas, target, c, v.maxKm)), [state.guesses, atlas, target, v.maxKm])
  const max = MAX_GUESSES + (state.extra ?? 0)
  const won = state.guesses.includes(target)
  const lost = !won && state.guesses.length >= max
  const over = won || lost
  const rounds = useMemo<BonusRound[]>(() => {
    const rng = seededRng(`${variant}-bonus-${seed}`)
    return variant === 'worldle' ? worldBonus(atlas, target, rng) : stateBonus(atlas, target, atlas.aliases(target)[0] ?? '', rng)
  }, [atlas, target, variant, seed])
  const picks: Record<string, string | undefined> = { flag: state.flag, capital: state.capital, ...state.bonus }
  const answered = rounds.filter((r) => picks[r.id] !== undefined)
  const good = answered.filter((r) => picks[r.id] === r.answer).length

  function update(next: Saved) {
    setState(next)
    if (storageKey) save(storageKey, next)
  }

  function guess(code: string) {
    const win = code === target
    const n = state.guesses.length + 1
    const done = win || n >= max
    const ms = elapsed()
    update({ ...state, guesses: [...state.guesses, code], ...(done ? { ms } : {}) })
    // plus le pays proposé est proche, plus la note monte
    if (!done) return feedback('tap', Math.round(evaluate(atlas, target, code, v.maxKm).proximity / 20))
    if (win && variant === 'worldle') stamp(target, 'worldle')
    if (variant === 'worldle') record(target, 'forme', win)
    if (!practice && !dailyResult(variant, day)) saveDailyResult(variant, { won: win, guesses: n }, day)
    recordPlay(variant, { pts: points(win, n), s: n, win, ms, sub: challenge ? 'defi' : practice ? 'libre' : undefined })
  }

  function another() {
    if (challenge) return go(`/${variant}/libre`)
    setSeed(newSeed())
    setState({ guesses: [] })
    setBonus(false)
  }

  async function share() {
    const stars = '⭐'.repeat(good)
    const text = `${v.title} Expedle ${practice ? t('(partie libre)') : day} ${won ? state.guesses.length : 'X'}/${max}${stars ? ' ' + stars : ''}\n${rows
      .map((r) => `${squares(r.proximity)}${r.arrow}`)
      .join('\n')}`
    setToast((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  const answerColor = won ? colors.good : colors.bad
  const fills = useMemo(() => new Map([[target, answerColor]]), [target, answerColor])
  const label = (r: BonusRound, option: string) => (r.id === 'flag' || r.id === 'neighbor' ? atlas.name(option) : option)

  return (
    <div className="wd">
      <AppBar title={v.title}>
        <SubLink href={`#/${variant}`} active={!practice}>
          {t(v.daily)}
        </SubLink>
        <SubLink href={`#/${variant}/libre`} active={practice && !challenge}>
          {t('Partie libre')}
        </SubLink>
      </AppBar>
      <main className="wd-main">
        <div className={over ? 'wd-stage over' : 'wd-stage'}>
          <Silhouette atlas={atlas} code={target} color={over ? (won ? colors.good : colors.bad) : colors.fg} label={t(v.shape)} />
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

        {!over && <CountryInput atlas={atlas} used={new Set(state.guesses)} onPick={guess} placeholder={t(v.ask)} button={`🌍 ${t('Deviner')}`} />}
        {!over && jokers && max - state.guesses.length === 1 && <Joker id="joker:essai" onUse={() => update({ ...state, extra: (state.extra ?? 0) + 1 })} />}

        {over && !bonus && (
          <section className="wd-end">
            <b>{won ? t('Bravo ! Réponse : {name}', { name: atlas.name(target) }) : t('Perdu. Réponse : {name}', { name: atlas.name(target) })}</b>
            <span className="muted">
              {won ? t('Trouvé en {n}/{max}.', { n: state.guesses.length, max }) : state.extra ? t('{n} essais, pas un de plus.', { n: max }) : t('Six essais, pas un de plus.')}
            </span>
            <div className="wd-actions">
              {rounds.length > 0 && (
                <button className="ui-btn" onClick={() => setBonus(true)}>
                  {t('Manches bonus ★')}
                </button>
              )}
              <button className="ui-btn line" onClick={share}>
                {t('Partager')}
              </button>
              {practice ? (
                <button className="ui-btn line" onClick={another}>
                  {t(v.another)}
                </button>
              ) : (
                <a className="ui-btn line" href={`#/${variant}/libre`}>
                  {t('Partie libre')}
                </a>
              )}
            </div>
            {variant === 'worldle' && <GlobeView fills={fills} focus={target} highlight={target} maxSize={300} initialZoom={2.2} />}
            {!state.extra && (
              <ChallengeBox
                game={variant}
                path={`/${variant}`}
                seed={seed}
                result={{ pts: points(won, state.guesses.length), s: state.guesses.length, win: won, ms: state.ms }}
              />
            )}
          </section>
        )}

        {over && bonus && (
          <section className="wd-bonus">
            {rounds.slice(0, answered.length + 1).map((r, i) => {
              const picked = picks[r.id]
              return (
                <div key={r.id} className="wd-bonus-round">
                  <h2>{t('Bonus {n} · {question}', { n: i + 1, question: t(r.question) })}</h2>
                  <div className={r.id === 'flag' ? 'wd-flags' : 'wd-caps'}>
                    {r.options.map((o) => {
                      const cls = !picked ? '' : o === r.answer ? 'right' : o === picked ? 'wrong' : 'dim'
                      return (
                        <button
                          key={o}
                          className={cls}
                          disabled={!!picked}
                          onClick={() => update({ ...state, bonus: { ...state.bonus, [r.id]: o } })}
                          aria-label={r.id === 'flag' && !picked ? t('Drapeau') : undefined}
                        >
                          {r.id === 'flag' ? (
                            <>
                              <span>{flagEmoji(o)}</span>
                              {picked && <small>{label(r, o)}</small>}
                            </>
                          ) : (
                            label(r, o)
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {answered.length === rounds.length && (
              <div className="wd-actions">
                <b className="wd-stars">{t('{n} / {total} bonus', { n: good, total: rounds.length })}</b>
                <button className="ui-btn" onClick={share}>
                  {t('Partager')}
                </button>
                <button className="ui-btn line" onClick={() => setBonus(false)}>
                  {t('Retour au résultat')}
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
