import { useEffect, useMemo, useRef, useState } from 'react'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { seededRng, shuffle, todayKey } from '../../lib/util'
import { WEIGHTS, type WeightItem } from './estimates'
import MgShell, { HelpStep, MgHelp } from './MgShell'
import MgSummary, { recordTotal } from './MgSummary'
import NumberInput, { formatNumber, parseNumber } from './NumberInput'
import { emojiSilhouette } from './silhouette'
import { cssColor, useTheme } from '../../ui/theme'
import './mg.css'

const ROUNDS = 3

function makeRounds(rng: () => number): [WeightItem, WeightItem][] {
  const pool = shuffle(WEIGHTS, rng)
  const out: [WeightItem, WeightItem][] = []
  const used = new Set<WeightItem>()
  for (const ref of pool) {
    if (out.length === ROUNDS) break
    if (used.has(ref)) continue
    const tgt = pool.find((t) => !used.has(t) && t !== ref && ref.kg / t.kg >= 4 && ref.kg / t.kg <= 5e8)
    if (!tgt) continue
    used.add(ref)
    used.add(tgt)
    out.push([ref, tgt])
  }
  return out
}

export function balanceScore(q: number, truth: number): number {
  return Math.max(0, Math.round(100 * (1 - Math.abs(Math.log10(q / truth)))))
}

function Pan({ x, y, item, color, size }: { x: number; y: number; item: WeightItem; color: string; size: number }) {
  const s = emojiSilhouette(item.emoji, color)
  const h = s.aspect > 1 ? size / s.aspect : size
  const w = h * s.aspect
  return (
    <g>
      <line x1={x - 60} x2={x + 60} y1={y} y2={y} style={{ stroke: 'var(--muted)' }} strokeWidth={3} />
      <image href={s.href} x={x - w / 2} y={y - h - 2} width={w} height={h} />
    </g>
  )
}

export default function Balance({ date }: { date?: string | null }) {
  const day = date ?? todayKey()
  const [daily, setDaily] = useState(() => dailyResult('balance', day) === null)
  const [seed, setSeed] = useState(0)
  const rounds = useMemo(() => makeRounds(daily ? seededRng('balance-' + day) : Math.random), [daily, day, seed])
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [scores, setScores] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)
  const [summary, setSummary] = useState(false)
  const [answers, setAnswers] = useState<number[]>([])
  const elapsed = useStopwatch(rounds)

  const theme = useTheme()
  const colors = useMemo(() => [cssColor('--ref'), cssColor('--target')], [theme])
  const [ref, tgt] = rounds[index]
  const truth = ref.kg / tgt.kg
  const q = parseNumber(value)
  const valid = Number.isFinite(q) && q > 0
  const shownQ = revealed ? truth : valid ? q : 0
  const ratio = shownQ > 0 ? (shownQ * tgt.kg) / ref.kg : 1e-6
  const angle = Math.max(-16, Math.min(16, Math.log10(ratio) * 6))
  const score = valid ? balanceScore(q, truth) : 0
  const [tilt, setTilt] = useState(angle)
  const tiltRef = useRef(tilt)
  tiltRef.current = tilt
  useEffect(() => {
    const from = tiltRef.current
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 450)
      const e = 1 - Math.pow(1 - t, 3)
      setTilt(from + (angle - from) * e)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [angle])
  const total = scores.reduce((a, b) => a + b, 0)

  function lock() {
    if (!valid) return
    setRevealed(true)
    setScores([...scores, score])
    setAnswers([...answers, q])
  }

  function next() {
    if (index + 1 >= ROUNDS) {
      setSummary(true)
      const total = scores.reduce((a, b) => a + b, 0)
      recordPlay('balance', { pts: total / ROUNDS, s: total, ms: elapsed(), sub: !daily ? 'libre' : day !== todayKey() ? 'archive' : undefined })
      recordTotal('balance', total)
      if (daily) saveDailyResult('balance', { scores }, day)
      return
    }
    setIndex(index + 1)
    setValue('')
    setRevealed(false)
  }

  const PX = 450
  const PY = 150
  const ARM = 250
  const rad = (tilt * Math.PI) / 180
  const lx = PX - ARM * Math.cos(rad)
  const ly = PY - ARM * Math.sin(rad)
  const rx = PX + ARM * Math.cos(rad)
  const ry = PY + ARM * Math.sin(rad)

  return (
    <MgShell
      title="Weigh It Up"
      help={
        <MgHelp title="Comment jouer à Weigh It Up" intro="Équilibre la référence avec le bon nombre d’objets identiques.">
          <HelpStep n="01" title="Observer">
            À gauche, une référence (×1). À droite, l’objet à empiler.
          </HelpStep>
          <HelpStep n="02" title="Estimer la quantité">
            Indique combien d’objets rouges il faut pour égaler le poids de la référence. La balance penche en direct.
          </HelpStep>
          <HelpStep n="03" title="Valider">
            Plus tu es proche en ordre de grandeur, plus tu marques (jusqu’à 100 points par manche).
          </HelpStep>
        </MgHelp>
      }
    >
      <p className="mg-sub">Équilibre la référence avec le bon nombre d’objets.</p>
      <div className="mg-counter">
        <span>
          MANCHE <b>{index + 1}</b> / {ROUNDS}
        </span>
        <span>
          SCORE <b>{total}</b>
        </span>
      </div>
      <div className="mg-board bal-board">
        <svg viewBox="0 0 900 400" width="100%" style={{ display: 'block' }}>
          <line x1={0} x2={900} y1={330} y2={330} style={{ stroke: 'var(--line)' }} strokeWidth={2} />
          <line x1={PX} x2={PX} y1={PY} y2={330} style={{ stroke: 'var(--muted)' }} strokeWidth={4} />
          <line x1={PX - 40} x2={PX + 40} y1={330} y2={330} style={{ stroke: 'var(--muted)' }} strokeWidth={6} />
          <g className="bal-beam">
            <line x1={lx} y1={ly} x2={rx} y2={ry} style={{ stroke: 'var(--muted)' }} strokeWidth={4} />
            <line x1={lx} y1={ly} x2={lx} y2={ly + 80} style={{ stroke: 'var(--muted)' }} strokeWidth={2} />
            <line x1={rx} y1={ry} x2={rx} y2={ry + 60} style={{ stroke: 'var(--muted)' }} strokeWidth={2} />
            <Pan x={lx} y={ly + 80} item={ref} color={colors[0]} size={110} />
            <Pan x={rx} y={ry + 60} item={tgt} color={colors[1]} size={70} />
            <text x={lx + 70} y={ly + 70} style={{ fill: 'var(--ref)' }} fontFamily="Ubuntu" fontSize={20}>
              × 1
            </text>
          </g>
          <circle cx={PX} cy={PY} r={11} style={{ fill: 'var(--bg)', stroke: 'var(--muted)' }} strokeWidth={3} />
        </svg>
        {revealed && (
          <div className="mg-result bal-result">
            <div className="mg-result-score">
              <span>{score}</span>/ 100
            </div>
            <p>
              Ta réponse : <b>{formatNumber(q)}</b>
            </p>
            <p>
              Réel : <b>{formatNumber(Math.round(truth * 10) / 10)}</b>
            </p>
          </div>
        )}
      </div>

      <div className="bal-input">
        <span className="red">× </span>
        <NumberInput value={value} onChange={setValue} onSubmit={revealed ? next : lock} unit={tgt.name} disabled={revealed} placeholder="Quantité..." />
      </div>

      <div className="mg-footer">
        <div className="mg-legend">
          <p>
            Référence : 1 × <span className="blue">{ref.name}</span> <span className="dim">({ref.detail}) (poids à l’échelle)</span>
          </p>
          <p>
            <span className="red">{tgt.name}</span> <span className="dim">({tgt.detail}) (ajuste la quantité)</span>
          </p>
        </div>
        {revealed ? (
          <button className="mg-cta" onClick={next}>
            {index + 1 >= ROUNDS ? 'Voir le bilan' : 'Manche suivante →'}
          </button>
        ) : (
          <button className="mg-cta" disabled={!valid} onClick={lock}>
            Valider
          </button>
        )}
      </div>

      {summary && (
        <div className="mg-modal-bg">
          <div className="mg-modal mg-help">
            <MgSummary
              title=""
              rounds={rounds.map(([r, t], i) => ({
                score: scores[i],
                title: (
                  <>
                    1 <span className="blue">{r.name}</span> = {formatNumber(Math.round((r.kg / t.kg) * 10) / 10)}{' '}
                    <span className="red">{t.name}</span>
                  </>
                ),
                detail: `Ta réponse : ${formatNumber(answers[i] ?? 0)}`,
              }))}
              max={ROUNDS * 100}
              historyKey="balance"
              shareText={`Weigh It Up ${daily ? day : ''}\n${total}/${ROUNDS * 100}`}
              archiveHref="#/estimation/archive"
              onReplay={() => {
                setDaily(false)
                setSeed(seed + 1)
                setIndex(0)
                setScores([])
                setAnswers([])
                setValue('')
                setRevealed(false)
                setSummary(false)
              }}
            />
          </div>
        </div>
      )}
    </MgShell>
  )
}
