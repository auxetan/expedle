import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { dailyResult, recordPlay, saveDailyResult } from '../../lib/stats'
import { hashString, load, save, seededRng, shuffle, todayKey, weekKey } from '../../lib/util'
import { loadGeoShapes, type GeoShape } from './geoItems'
import { OBJECTS, POP_ITEMS, WEEKLY_THEMES, type Dim, type ObjectItem } from './items'
import MgShell, { HelpStep, MgHelp } from './MgShell'
import MgSummary, { recordTotal } from './MgSummary'
import { emojiSilhouette } from './silhouette'
import { cssColor, useTheme } from '../../ui/theme'
import './mg.css'

export type Variant = 'objets' | 'geo' | '1000' | 'pop'

interface Thing {
  name: string
  detail: string
  dim: Dim
  value: number
  heightUnits: number
  aspect: number
  emoji?: string
  shape?: GeoShape
}

interface Camera {
  ppu: number
  camX: number
}


export function formatLength(v: number, variant: Variant): string {
  const nf = (n: number, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d })
  if (variant === 'geo') return v < 1 ? `${nf(v * 1000)} m` : `${nf(v, v < 10 ? 1 : 0)} km`
  if (v < 1) return `${nf(v * 10, 1)} mm`
  if (v < 1000) return `${nf(v, v < 10 ? 1 : 0)} cm`
  if (v < 100000) return `${nf(v / 100, v < 10000 ? 1 : 0)} m`
  return `${nf(v / 100000, 1)} km`
}

// La silhouette est étirée à ses vraies proportions : la dimension non mesurée reste réaliste.
function objectThing(i: ObjectItem): Thing {
  return {
    name: i.name,
    detail: i.detail,
    dim: i.dim,
    value: i.cm,
    heightUnits: i.dim === 'h' ? i.cm : i.cm / i.aspect,
    aspect: i.aspect,
    emoji: i.emoji,
  }
}

// Les territoires plus larges que hauts se mesurent en longueur, comme dans le jeu d'origine.
function geoThing(s: GeoShape): Thing {
  const wide = s.w > s.h * 1.25
  return { name: s.name, detail: s.detail, dim: wide ? 'l' : 'h', value: wide ? s.w : s.h, heightUnits: s.h, aspect: s.w / s.h, shape: s }
}

function makeRounds(things: Thing[], rng: () => number, count: number, seen = new Set<string>()): [Thing, Thing][] {
  const out: [Thing, Thing][] = []
  let used = new Set<string>()
  for (let pass = 0; pass < 4 && out.length < count; pass++) {
    // les objets déjà vus récemment passent en dernier
    const pool = [...shuffle(things.filter((t) => !seen.has(t.name)), rng), ...shuffle(things.filter((t) => seen.has(t.name)), rng)]
    for (const ref of pool) {
      if (out.length === count) break
      if (used.has(ref.name)) continue
      const tgt = pool.find((t) => {
        if (t === ref || used.has(t.name)) return false
        const r = Math.abs(Math.log10(t.heightUnits / ref.heightUnits))
        return r > 0.12 && r < 1.1
      })
      if (!tgt) continue
      used.add(ref.name)
      used.add(tgt.name)
      out.push([ref, tgt])
    }
    // petits thèmes : on réutilise les objets pour atteindre dix manches
    used = new Set()
  }
  return out
}

function Figure({ t, x, y, h, color, opacity = 1 }: { t: Thing; x: number; y: number; h: number; color: string; opacity?: number }) {
  const w = h * t.aspect
  if (t.shape) {
    const k = h / t.shape.h
    return <path d={t.shape.d} transform={`translate(${x},${y - h}) scale(${k})`} fill={color} opacity={opacity} />
  }
  return (
    <image
      href={emojiSilhouette(t.emoji!, color).href}
      x={x}
      y={y - h}
      width={w}
      height={h}
      preserveAspectRatio="none"
      opacity={opacity}
    />
  )
}

export const TITLES: Record<Variant, string> = {
  objets: 'Size It Up',
  geo: 'Size It Up : Géographie',
  '1000': 'The Weekly 1K',
  pop: 'Size It Up : Pop Culture',
}

export function weeklyTheme(week = weekKey()) {
  return WEEKLY_THEMES[hashString(week) % WEEKLY_THEMES.length]
}

export default function Echelle({ variant, date }: { variant: Variant; date?: string | null }) {
  const dailyId = `echelle-${variant}`
  const dayKey = variant === '1000' ? weekKey() : (date ?? todayKey())
  const count = variant === '1000' ? 10 : 5
  const [things, setThings] = useState<Thing[] | null>(null)
  const [daily, setDaily] = useState(() => dailyResult(dailyId, dayKey) === null)

  useEffect(() => {
    if (variant === 'geo') loadGeoShapes().then((s) => setThings(s.filter((x) => x.h > 0).map(geoThing)))
    else setThings((variant === '1000' ? weeklyTheme().items : variant === 'pop' ? POP_ITEMS : OBJECTS).map(objectThing))
  }, [variant])

  const [seed, setSeed] = useState(0)
  const rounds = useMemo(
    () =>
      things
        ? daily
          ? makeRounds(things, seededRng(`${dailyId}-${dayKey}`), count)
          : makeRounds(things, Math.random, count, new Set(load<string[]>(`mg-seen:${variant}`, [])))
        : [],
    // seed : « Rejouer » relance un tirage aléatoire
    [things, daily, seed, dailyId, dayKey, count, variant],
  )

  const title = TITLES[variant]
  const subtitle =
    variant === '1000'
      ? `Thème de la semaine : ${weeklyTheme().name}`
      : date && date !== todayKey()
        ? `Archive du ${new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
        : variant === 'pop'
          ? 'Fais correspondre le personnage à sa taille officielle.'
          : null
  if (!rounds.length)
    return (
      <MgShell title={title} help={<EchelleHelp />}>
        <div className="mg-loading">
          <span className="spinner" />
          <b>Préparation de l’échelle</b>
          <small>Chargement des silhouettes…</small>
        </div>
      </MgShell>
    )

  return (
    <Game
      key={`${daily}-${seed}`}
      title={title}
      subtitle={subtitle}
      variant={variant}
      rounds={rounds}
      daily={daily}
      dayKey={dayKey}
      onFinish={(scores) => {
        if (things) {
          const names = rounds.flatMap(([a, b]) => [a.name, b.name])
          const seen = [...load<string[]>(`mg-seen:${variant}`, []).filter((n) => !names.includes(n)), ...names]
          save(`mg-seen:${variant}`, seen.slice(-Math.floor(things.length * 0.7)))
        }
        recordPlay(dailyId)
        recordTotal(dailyId, scores.reduce((a, b) => a + b, 0))
        if (daily) saveDailyResult(dailyId, { scores }, dayKey)
      }}
      onReplay={() => {
        setDaily(false)
        setSeed((s) => s + 1)
      }}
    />
  )
}

function EchelleHelp() {
  return (
    <MgHelp title="Comment jouer à Size It Up" intro="Retrouve l’échelle réelle en t’aidant uniquement de la référence visuelle.">
      <HelpStep n="01" title="Comparer">
        Utilise l’objet bleu comme référence fixe : sa taille ne change pas.
      </HelpStep>
      <HelpStep n="02" title="Déplacer et redimensionner">
        Fais glisser la silhouette rouge pour la déplacer. Tire la poignée ↗ (ou pince à deux doigts) pour la redimensionner.
        Dézoome si tu as besoin de place.
      </HelpStep>
      <HelpStep n="03" title="Valider">
        Valide pour révéler la vraie taille et gagne jusqu’à 100 points par manche (100 − l’écart en %).
      </HelpStep>
      <p className="mg-tip">
        <b>Astuce :</b> commence par la dimension marquée par le guide en pointillés, puis compare les proportions.
      </p>
    </MgHelp>
  )
}

interface GameProps {
  title: string
  subtitle: string | null
  variant: Variant
  rounds: [Thing, Thing][]
  daily: boolean
  dayKey: string
  onFinish: (scores: number[]) => void
  onReplay: () => void
}

function Game({ title, subtitle, variant, rounds, daily, dayKey, onFinish, onReplay }: GameProps) {
  const theme = useTheme()
  const [BLUE, RED, GHOST] = useMemo(() => [cssColor('--ref'), cssColor('--target'), cssColor('--muted')], [theme])
  const ROUNDS = rounds.length
  const [index, setIndex] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)
  const [summary, setSummary] = useState(false)
  const [ref, tgt] = rounds[index]

  const boxRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(900)
  const H = Math.round(Math.min(560, Math.max(320, W * 0.6)))
  const ground = Math.round(H * 0.8)
  const X0 = 32

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(boxRef.current!)
    return () => ro.disconnect()
  }, [])

  const initial = useMemo(() => {
    const ppu = (H * 0.3) / ref.heightUnits
    const truthPx = tgt.heightUnits * ppu
    let guessPx = H * 0.3
    for (let i = 0; i < 20; i++) {
      guessPx = H * (0.18 + Math.random() * 0.42)
      if (Math.abs(Math.log(guessPx / truthPx)) > 0.3) break
    }
    return {
      cam: { ppu, camX: 0 },
      targetH: guessPx / ppu,
      targetX: ref.heightUnits * ref.aspect + 70 / ppu,
    }
  }, [index, H, ref, tgt])

  const [cam, setCam] = useState<Camera>(initial.cam)
  const [targetH, setTargetH] = useState(initial.targetH)
  const [targetX, setTargetX] = useState(initial.targetX)
  useEffect(() => {
    setCam(initial.cam)
    setTargetH(initial.targetH)
    setTargetX(initial.targetX)
  }, [initial])

  const camRef = useRef(cam)
  camRef.current = cam
  const animRef = useRef(0)
  function animateTo(to: Camera) {
    cancelAnimationFrame(animRef.current)
    const from = camRef.current
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 650)
      const e = 1 - Math.pow(1 - t, 3)
      setCam({
        ppu: Math.exp(Math.log(from.ppu) + (Math.log(to.ppu) - Math.log(from.ppu)) * e),
        camX: from.camX + (to.camX - from.camX) * e,
      })
      if (t < 1) animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
  }

  const sx = (u: number) => X0 + (u - cam.camX) * cam.ppu
  const refH = ref.heightUnits * cam.ppu
  const tH = targetH * cam.ppu
  const tLeft = sx(targetX)

  const drag = useRef<{ mode: 'move' | 'resize'; startX: number; startTargetX: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; h: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  function local(e: React.PointerEvent) {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onDown(e: React.PointerEvent, mode: 'move' | 'resize') {
    if (revealed) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), h: targetH }
      drag.current = null
      return
    }
    drag.current = { mode, startX: p.x, startTargetX: targetX }
  }

  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      setTargetH(Math.max(2 / cam.ppu, pinch.current.h * (dist / pinch.current.dist)))
      return
    }
    const d = drag.current
    if (!d) return
    if (d.mode === 'move') setTargetX(Math.max(0, d.startTargetX + (p.x - d.startX) / cam.ppu))
    else {
      const hPx = Math.max(ground - p.y, (p.x - tLeft) / tgt.aspect, 3)
      setTargetH(hPx / cam.ppu)
    }
  }

  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  function zoomBy(k: number) {
    cancelAnimationFrame(animRef.current)
    setCam((c) => ({ ...c, ppu: c.ppu * k }))
  }

  function onWheel(e: React.WheelEvent) {
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)
  }

  const answer = tgt.dim === 'h' ? targetH : targetH * tgt.aspect
  const off = Math.abs(answer - tgt.value) / tgt.value
  const score = Math.max(0, Math.round(100 * (1 - off)))
  const total = scores.reduce((a, b) => a + b, 0)

  function fitBoth() {
    const maxH = Math.max(ref.heightUnits, targetH, tgt.heightUnits)
    const right = targetX + Math.max(targetH, tgt.heightUnits) * tgt.aspect
    const ppu = Math.min((ground - 30) / maxH, (W - X0 - 30) / right)
    animateTo({ ppu, camX: 0 })
  }

  function lockIn() {
    setRevealed(true)
    setScores([...scores, score])
    setAnswers([...answers, answer])
    const maxH = Math.max(targetH, tgt.heightUnits)
    const wUnits = maxH * tgt.aspect
    const ppu = Math.min((ground - 40) / maxH, (W * 0.6) / wUnits)
    animateTo({ ppu, camX: targetX + wUnits / 2 - (W * 0.62 - X0) / ppu })
  }

  function nextRound() {
    if (index + 1 >= rounds.length) {
      setSummary(true)
      onFinish(scores)
      return
    }
    setRevealed(false)
    setIndex(index + 1)
  }

  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!revealed) return setShown(0)
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 900)
      setShown(Math.round(score * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [revealed, score])

  const shareText = `${title} ${daily ? dayKey : ''}\n${scores.map((s) => (s >= 90 ? '🟩' : s >= 60 ? '🟨' : s >= 30 ? '🟧' : '🟥')).join('')} ${total}/${ROUNDS * 100}`
  const dimLabel = (d: Dim) => (d === 'h' ? 'la hauteur' : 'la longueur')

  return (
    <MgShell title={title} help={<EchelleHelp />}>
      <p className="mg-sub">{subtitle ?? 'Fais correspondre la silhouette à sa taille réelle.'}</p>
      {summary ? (
        <MgSummary
          title=""
          rounds={rounds.map(([r, t], i) => ({
            score: scores[i],
            title: (
              <>
                <span className="blue">{r.name}</span> → <span className="red">{t.name}</span>
              </>
            ),
            detail: `Ta réponse : ${formatLength(answers[i], variant)} · Réel : ${formatLength(t.value, variant)} (${t.dim === 'h' ? 'hauteur' : 'longueur'})`,
          }))}
          max={ROUNDS * 100}
          historyKey={`echelle-${variant}`}
          shareText={shareText}
          archiveHref="#/estimation/archive"
          onReplay={onReplay}
        />
      ) : (
        <>
      <div className="mg-counter">
        <span>
          MANCHE <b>{index + 1}</b> / {ROUNDS}
        </span>
        <span>
          SCORE <b>{total}</b>
        </span>
      </div>

      <div className="mg-board" ref={boxRef} onWheel={onWheel}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ touchAction: 'none' }}
        >
          <defs>
            <linearGradient id="mg-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--hover)' }} />
              <stop offset="1" style={{ stopColor: 'var(--card)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <rect x={0} y={ground} width={W} height={H - ground} fill="url(#mg-ground)" />
          <line x1={0} x2={W} y1={ground} y2={ground} style={{ stroke: 'var(--muted)' }} strokeWidth={1.5} />

          <line
            x1={sx(0) - 12}
            x2={sx(0) + refH * ref.aspect + 12}
            y1={ground - refH - 14}
            y2={ground - refH - 14}
            style={{ stroke: 'var(--muted)' }}
            strokeWidth={1.5}
            strokeDasharray="3 4"
          />
          <Figure t={ref} x={sx(0)} y={ground} h={refH} color={BLUE} />

          <g
            className={revealed ? 'mg-target' : 'mg-target live'}
            onPointerDown={(e) => onDown(e, 'move')}
          >
            {revealed && tgt.heightUnits > targetH && (
              <g className="mg-ghost">
                <Figure t={tgt} x={tLeft} y={ground} h={tgt.heightUnits * cam.ppu} color={GHOST} />
              </g>
            )}
            <Figure t={tgt} x={tLeft} y={ground} h={tH} color={RED} />
            <rect x={tLeft} y={ground - tH} width={Math.max(tH * tgt.aspect, 8)} height={Math.max(tH, 8)} fill="transparent" />
          </g>
          {revealed && tgt.heightUnits <= targetH && (
            <g className="mg-ghost">
              <Figure t={tgt} x={tLeft} y={ground} h={tgt.heightUnits * cam.ppu} color={GHOST} opacity={0.75} />
            </g>
          )}
          {!revealed && (
            <g
              className="mg-handle"
              transform={`translate(${tLeft + tH * tgt.aspect + 6},${ground - tH - 22})`}
              onPointerDown={(e) => onDown(e, 'resize')}
            >
              <rect x={-4} y={-4} width={30} height={30} rx={8} style={{ fill: 'var(--card)', stroke: 'var(--line)' }} />
              <path d="M5 17L17 5M10 5h7v7M5 10v7h7" style={{ stroke: 'var(--fg)' }} strokeWidth={1.8} fill="none" strokeLinecap="round" />
            </g>
          )}
        </svg>

        {!revealed ? (
          <div className="mg-zoom">
            <button onClick={() => zoomBy(1.35)} aria-label="Zoomer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
              </svg>
            </button>
            <button onClick={() => zoomBy(1 / 1.35)} aria-label="Dézoomer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3M8 11h6" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div className="mg-result">
              <div className="mg-result-score">
                <span>{shown}</span>/ 100
              </div>
              <p>
                Ta réponse : <b>{formatLength(answer, variant)}</b>
              </p>
              <p>
                Réel : <b>{formatLength(tgt.value, variant)}</b> ({tgt.dim === 'h' ? 'hauteur' : 'longueur'})
              </p>
              <small>Écart de {Math.round(off * 100)} %</small>
            </div>
            <button className="mg-fit" onClick={fitBoth}>
              ⛶ Ajuster les deux
            </button>
          </>
        )}
      </div>

      <div className="mg-footer">
        <div className="mg-legend">
          <p>
            Référence : <span className="blue">{ref.name} ({ref.detail})</span> <span className="dim">(échelle réelle)</span>
          </p>
          <p>
            <span className="red">
              {tgt.name} ({tgt.detail})
            </span>{' '}
            <span className="dim">(ajuste {dimLabel(tgt.dim)})</span>
          </p>
        </div>
        {revealed ? (
          <button className="mg-cta" onClick={nextRound}>
            {index + 1 >= rounds.length ? 'Voir le score final 🏆' : 'Manche suivante →'}
          </button>
        ) : (
          <button className="mg-cta" onClick={lockIn}>
            Valider
          </button>
        )}
      </div>

        </>
      )}
    </MgShell>
  )
}
