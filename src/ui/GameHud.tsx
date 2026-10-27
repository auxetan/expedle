// Le bandeau d'une partie en plusieurs questions ou manches : les cases qui se remplissent, le combo en direct, le score
// dont chaque gain jaillit, le chrono qui se tend, les vies (ou une jauge de vie), et Pépite qui réagit à chaque réponse.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { feedback } from '../lib/feedback'
import { hudState, type Step } from '../lib/hud'
import { fmt, t } from '../lib/i18n'
import Mascot, { Flame, type Mood } from './Mascot'
import './hud.css'

interface Props {
  steps: Step[]
  label?: ReactNode
  score?: number
  time?: { left: number; total: number }
  lives?: { left: number; total: number }
  // une vie continue (Survival) : une jauge, dont chaque perte ou gain s'affiche un instant
  gauge?: { value: number; max: number }
  // une partie sans fin : seules les `trail` dernières cases restent à l'écran
  trail?: number
}

const tenth = (n: number) => fmt(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Heart({ full }: { full: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={full ? 'full' : ''} aria-hidden>
      <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" />
    </svg>
  )
}

export default function GameHud({ steps, label, score, time, lives, gauge, trail }: Props) {
  const { combo, mood, word } = hudState(steps)
  const answered = steps.filter((s) => s !== null).length
  const current = steps.indexOf(null)

  // Pépite réagit à la réponse, puis se calme
  const [shown, setShown] = useState<Mood>('calme')
  useEffect(() => {
    if (!answered) return
    setShown(mood)
    const id = window.setTimeout(() => setShown('calme'), 1300)
    return () => clearTimeout(id)
    // une fois par réponse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered])

  // le gain d'une réponse jaillit au-dessus du score
  const before = useRef(score ?? 0)
  const [gain, setGain] = useState<{ n: number; at: number } | null>(null)
  useEffect(() => {
    if (score === undefined) return
    const diff = score - before.current
    before.current = score
    if (diff > 0) setGain({ n: diff, at: answered })
  }, [score, answered])

  // chaque perte ou gain de vie s'affiche un instant à côté de la jauge
  const life = gauge?.value
  const lastLife = useRef(life)
  const [delta, setDelta] = useState<{ n: number; id: number } | null>(null)
  useEffect(() => {
    if (life === undefined) return
    const diff = Math.round((life - (lastLife.current ?? life)) * 10) / 10
    lastLife.current = life
    if (diff) setDelta((d) => ({ n: diff, id: (d?.id ?? 0) + 1 }))
  }, [life])
  const ratio = gauge ? gauge.value / gauge.max : 1

  // les trois dernières secondes battent, à l'oreille aussi
  const secs = time ? Math.ceil(time.left / 1000) : 0
  const phase = !time ? '' : time.left <= 3000 ? 'danger' : time.left <= 5000 ? 'warn' : ''
  useEffect(() => {
    if (secs > 0 && secs <= 3) feedback('tap', 3 - secs)
  }, [secs])

  return (
    <div className="hud">
      <div className="hud-top">
        {label && <span className="hud-label">{label}</span>}
        {lives && (
          <span className="hud-lives" role="img" aria-label={t('{n} vies', { n: lives.left })}>
            {Array.from({ length: lives.total }, (_, i) => (
              <Heart key={i} full={i < lives.left} />
            ))}
          </span>
        )}
        {gauge && (
          <span className={`hud-gauge ${ratio <= 0.25 ? 'low' : ratio <= 0.5 ? 'warn' : ''}`} role="img" aria-label={t('Vie : {n}', { n: tenth(gauge.value) })}>
            <Heart full />
            <span className="hud-gauge-bar">
              <i style={{ width: `${Math.min(1, ratio) * 100}%` }} />
            </span>
            <b>{tenth(gauge.value)}</b>
            {delta && (
              <i key={delta.id} className={delta.n < 0 ? 'hud-delta loss' : 'hud-delta'} aria-hidden>
                {delta.n < 0 ? '−' : '+'}
                {tenth(Math.abs(delta.n))}
              </i>
            )}
          </span>
        )}
        {combo >= 2 && (
          <span className="hud-combo" key={combo} aria-label={t('Combo ×{n}', { n: combo })}>
            <Flame size={18} />×{combo}
          </span>
        )}
        {score !== undefined && (
          <span className="hud-score">
            <b key={score}>{t('{n} pts', { n: fmt(score) })}</b>
            {gain && (
              <i key={gain.at} className="hud-gain" aria-hidden>
                +{fmt(gain.n)}
              </i>
            )}
          </span>
        )}
        <span className="hud-pepite">
          {word && (
            <span key={answered} className="hud-word">
              {t(word)}
            </span>
          )}
          <Mascot mood={shown} size={34} />
        </span>
      </div>
      <div className={trail ? 'hud-steps trail' : 'hud-steps'} role="img" aria-label={trail ? undefined : `${answered}/${steps.length}`}>
        {steps.map((s, i) =>
          trail && i < steps.length - trail ? null : (
            <i key={i} className={s === true ? 'ok' : s === false ? 'ko' : s === 'presque' ? 'mid' : i === current ? 'now' : ''} />
          ),
        )}
      </div>
      {time && (
        <div className={`hud-time ${phase}`}>
          <i style={{ width: `${(time.left / time.total) * 100}%` }} />
        </div>
      )}
    </div>
  )
}
