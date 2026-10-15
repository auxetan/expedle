import { geoAzimuthalEqualArea, geoNaturalEarth1, geoPath, type GeoProjection } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import type { MultiPoint } from 'geojson'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { COUNTRY_BY_CODE, countryName, flagEmoji } from '../../geo/countries'
import { getWorld } from '../../geo/world'
import { go } from '../../lib/router'
import { bestScore, recordPlay, submitBest } from '../../lib/stats'
import { formatTime, normalize, shuffle } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import { ASK_LABEL, parseQuizId, quizId, quizMembers, REGIONS, type Ask, type Region } from './quizzes'
import './cartographe.css'

type PlayMode = 'epingler' | 'saisir' | 'apprendre'

export default function Cartographe({ quizId: id, params }: { quizId?: string; params: URLSearchParams }) {
  const parsed = id ? parseQuizId(id) : null
  if (!parsed) return <QuizList />
  const m = params.get('mode')
  const mode: PlayMode = m === 'saisir' || m === 'apprendre' ? m : 'epingler'
  return <Quiz region={parsed.region} ask={parsed.ask} mode={mode} />
}

function Brand() {
  const current = window.location.hash.split('?')[0]
  return (
    <AppBar title="Seterra">
      <SubLink href="#/cartographe" active={current === '#/cartographe'}>
        Tous les quiz
      </SubLink>
      {REGIONS.map((r) => (
        <SubLink key={r.id} href={`#/cartographe/${r.id}`} active={current === `#/cartographe/${r.id}`}>
          {r.name}
        </SubLink>
      ))}
    </AppBar>
  )
}

function QuizList() {
  const asks: Ask[] = ['pays', 'capitales', 'drapeaux']
  return (
    <div className="st">
      <Brand />
      <main className="st-list">
        <h1>Quiz de géographie</h1>
        <p className="st-lead">Clique sur la carte, ou tape le nom : apprends à situer chaque pays du monde.</p>
        {asks.map((ask) => (
          <section key={ask}>
            <h2>Jeux {ask === 'pays' ? 'de carte' : ask === 'capitales' ? 'de capitales' : 'de drapeaux'}</h2>
            <div className="st-grid">
              {REGIONS.map((r) => {
                const id = quizId(r.id, ask)
                const best = bestScore('carto-' + id)
                return (
                  <a key={id} href={`#/cartographe/${id}`} className="st-tile">
                    <b>
                      {r.name} : {ASK_LABEL[ask]}
                    </b>
                    <span>{quizMembers(r).length} questions</span>
                    {best !== null && <em>Record : {best} %</em>}
                  </a>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

function boxPoints(r: Region): MultiPoint {
  const [[x0, y0], [x1, y1]] = r.box
  const pts: [number, number][] = []
  for (let x = x0; x <= x1; x += 2) pts.push([x, y0], [x, y1])
  for (let y = y0; y <= y1; y += 2) pts.push([x0, y], [x1, y])
  return { type: 'MultiPoint', coordinates: pts }
}

function projectionFor(r: Region, w: number, h: number): GeoProjection {
  const base = r.world ? geoNaturalEarth1().rotate([r.rotate[0], 0]) : geoAzimuthalEqualArea().rotate(r.rotate)
  return base.fitExtent(
    [
      [8, 8],
      [w - 8, h - 8],
    ],
    r.world ? { type: 'Sphere' } : boxPoints(r),
  )
}

interface Target {
  code: string
  tries: number
  status: 'pending' | 'ok1' | 'ok2' | 'ok3' | 'fail'
}

const FILL: Record<Target['status'], string> = {
  pending: 'var(--land)',
  ok1: 'var(--ok1)',
  ok2: 'var(--warn)',
  ok3: 'var(--orange)',
  fail: 'var(--bad)',
}

function prompt(code: string, ask: Ask): string {
  if (ask === 'capitales') return COUNTRY_BY_CODE.get(code)!.capital
  if (ask === 'drapeaux') return flagEmoji(code)
  return countryName(code)
}

function Quiz({ region, ask, mode }: { region: Region; ask: Ask; mode: PlayMode }) {
  const world = getWorld()
  const members = useMemo(() => quizMembers(region), [region])
  const memberSet = useMemo(() => new Set(members), [members])
  const [order, setOrder] = useState(() => shuffle(members))
  const [targets, setTargets] = useState<Map<string, Target>>(() => new Map(members.map((c) => [c, { code: c, tries: 0, status: 'pending' }])))
  const [index, setIndex] = useState(0)
  const [clicks, setClicks] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [flash, setFlash] = useState<{ code: string; kind: 'wrong' | 'right' } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [pinned, setPinned] = useState<Set<string>>(new Set())
  const learning = mode === 'apprendre'
  const [started, setStarted] = useState(false)
  const [startAt, setStartAt] = useState(0)
  const [now, setNow] = useState(0)
  const [typed, setTyped] = useState('')
  const [shake, setShake] = useState(false)
  const [record, setRecord] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [width, setWidth] = useState(900)
  const height = Math.round(width * (region.world ? 0.52 : 0.72))
  const [zt, setZt] = useState<ZoomTransform>(zoomIdentity)

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(wrapRef.current!)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const svg = svgRef.current!
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 24])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on('zoom', (e) => setZt(e.transform))
    zoomRef.current = z
    select(svg).call(z)
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [width, height])

  const projection = useMemo(() => projectionFor(region, width, height), [region, width, height])
  const path = useMemo(() => geoPath(projection), [projection])
  const shapes = useMemo(
    () =>
      world.codes
        .filter((c) => c !== 'AQ' || region.world)
        .map((c) => ({ code: c, d: path(world.features.get(c)!) ?? '' }))
        .filter((s) => s.d),
    [world, path, region],
  )
  const centers = useMemo(() => {
    const out = new Map<string, { x: number; y: number; small: boolean }>()
    for (const code of members) {
      const parts = world.parts.filter((p) => p.code === code)
      const main = parts.reduce((a, b) => (b.area > a.area ? b : a))
      const p = projection(main.centroid)
      if (!p) continue
      const area = path.area(world.features.get(code)!)
      out.set(code, { x: p[0], y: p[1], small: area < 60 })
    }
    return out
  }, [members, world, projection, path])

  const finished = index >= order.length
  const current = order[index]

  useEffect(() => {
    if (!started || finished) return
    const id = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(id)
  }, [started, finished])

  useEffect(() => {
    if (!finished || !started) return
    const pct = Math.round((correct / Math.max(clicks, 1)) * 100)
    recordPlay('cartographe')
    setRecord(submitBest('carto-' + quizId(region.id, ask), pct))
  }, [finished, started, correct, clicks, region, ask])

  const elapsed = started ? (finished ? now : performance.now()) - startAt : 0

  function start() {
    setStarted(true)
    setStartAt(performance.now())
    setNow(performance.now())
  }

  function resolve(status: Target['status']) {
    const t = targets.get(current)!
    const next = new Map(targets)
    next.set(current, { ...t, status })
    setTargets(next)
    setFlash({ code: current, kind: 'right' })
    setTimeout(() => setFlash((f) => (f?.code === current ? null : f)), 1400)
    setIndex((i) => i + 1)
    setNow(performance.now())
  }

  function miss(code?: string) {
    const t = targets.get(current)!
    const tries = t.tries + 1
    const next = new Map(targets)
    next.set(current, { ...t, tries })
    setTargets(next)
    setClicks((c) => c + 1)
    if (code) {
      setFlash({ code, kind: 'wrong' })
      setTimeout(() => setFlash((f) => (f?.code === code ? null : f)), 1100)
    }
  }

  function onCountry(code: string) {
    if (learning) {
      if (!memberSet.has(code)) return
      const next = new Set(pinned)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      setPinned(next)
      return
    }
    if (!started || finished || mode !== 'epingler' || !memberSet.has(code)) return
    const t = targets.get(code)!
    if (t.status !== 'pending') return
    if (code === current) {
      const tries = targets.get(current)!.tries
      setClicks((c) => c + 1)
      if (tries < 3) setCorrect((c) => c + 1)
      resolve(tries === 0 ? 'ok1' : tries === 1 ? 'ok2' : tries === 2 ? 'ok3' : 'fail')
    } else miss(code)
  }

  function onType() {
    if (!started || finished) return
    const meta = COUNTRY_BY_CODE.get(current)!
    const ok = [meta.name, ...meta.aliases].some((n) => normalize(n) === normalize(typed))
    if (ok) {
      const tries = targets.get(current)!.tries
      setClicks((c) => c + 1)
      setCorrect((c) => c + 1)
      setTyped('')
      resolve(tries === 0 ? 'ok1' : tries === 1 ? 'ok2' : 'ok3')
      return
    }
    setShake(true)
    setTimeout(() => setShake(false), 400)
    const tries = targets.get(current)!.tries
    if (tries >= 2) {
      setClicks((c) => c + 1)
      setTyped('')
      resolve('fail')
    } else miss()
  }

  function restart() {
    setOrder(shuffle(members))
    setTargets(new Map(members.map((c) => [c, { code: c, tries: 0, status: 'pending' }])))
    setIndex(0)
    setClicks(0)
    setCorrect(0)
    setFlash(null)
    setStarted(false)
    setRecord(false)
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity)
  }

  const pct = clicks ? Math.round((correct / clicks) * 100) : 0
  const blink = started && !finished && (targets.get(current)?.tries ?? 0) >= 3
  const k = zt.k
  const title = `${region.name} : ${ASK_LABEL[ask]}`

  return (
    <div className="st">
      <Brand />
      <main className="st-play">
        <div className="st-frame" ref={wrapRef}>
          {started && learning && (
            <div className="st-bar">
              <span className="st-score">
                <b>Apprendre</b>
              </span>
              <span className="st-target">{hover ? countryName(hover) : 'Survole ou clique un pays'}</span>
              <span className="st-right">
                <button className="st-pill ui-btn line" onClick={() => setPinned(pinned.size ? new Set() : new Set(members))}>
                  {pinned.size ? 'Masquer les noms' : 'Tous les noms'}
                </button>
                <button className="st-x" onClick={() => go('/cartographe')} aria-label="Quitter">
                  ✕
                </button>
              </span>
            </div>
          )}
          {started && !learning && (
            <div className="st-bar">
              <span className="st-score">
                <b>
                  {index} / {order.length}
                </b>
                <i />
                <b>{pct}%</b>
              </span>
              {!finished && mode === 'epingler' && (
                <span className={ask === 'drapeaux' ? 'st-target flag' : 'st-target'}>{prompt(current, ask)}</span>
              )}
              <span className="st-right">
                <span className="st-time">{formatTime(elapsed)}</span>
                <button className="st-x" onClick={() => go('/cartographe')} aria-label="Quitter">
                  ✕
                </button>
              </span>
            </div>
          )}

          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="st-map"
            onPointerMove={(e) => learning && setHover((e.target as Element).closest('[data-code]')?.getAttribute('data-code') ?? null)}
            onPointerLeave={() => setHover(null)}
          >
            <rect width={width} height={height} className="st-sea" />
            <g transform={zt.toString()}>
              {region.world && <path d={path({ type: 'Sphere' }) ?? ''} className="st-sphere" />}
              {shapes.map(({ code, d }) => {
                const inQuiz = memberSet.has(code)
                const t = targets.get(code)
                let fill = inQuiz ? FILL[t!.status] : 'var(--land-off)'
                if (flash?.code === code && flash.kind === 'wrong') fill = 'var(--flash)'
                if (learning && inQuiz && (hover === code || pinned.has(code))) fill = 'var(--warn)'
                const cls = [
                  'st-land',
                  inQuiz ? 'q' : '',
                  blink && code === current ? 'blink' : '',
                  mode === 'saisir' && ask === 'pays' && started && !finished && code === current ? 'ask' : '',
                ].join(' ')
                return <path key={code} data-code={code} d={d} style={{ fill }} className={cls} onClick={() => onCountry(code)} />
              })}
              {members.map((code) => {
                const c = centers.get(code)
                if (!c?.small) return null
                const t = targets.get(code)!
                const isAsk = mode === 'saisir' && ask === 'pays' && started && !finished && code === current
                return (
                  <circle
                    key={'c' + code}
                    data-code={code}
                    cx={c.x}
                    cy={c.y}
                    r={7 / Math.sqrt(k)}
                    className={['st-dot', blink && code === current ? 'blink' : '', isAsk ? 'ask' : ''].join(' ')}
                    style={{ fill: flash?.code === code && flash.kind === 'wrong' ? 'var(--flash)' : FILL[t.status] }}
                    onClick={() => onCountry(code)}
                  />
                )
              })}
            </g>
            {learning &&
              [...new Set([...pinned, ...(hover && memberSet.has(hover) ? [hover] : [])])].map((code) => {
                const c = centers.get(code)
                if (!c) return null
                return (
                  <g key={'l' + code} transform={`translate(${c.x * k + zt.x},${c.y * k + zt.y})`} className="st-label">
                    <text y={4} textAnchor="middle">
                      {ask === 'capitales' ? `${countryName(code)} · ${COUNTRY_BY_CODE.get(code)!.capital}` : ask === 'drapeaux' ? `${flagEmoji(code)} ${countryName(code)}` : countryName(code)}
                    </text>
                  </g>
                )
              })}
            {flash &&
              centers.get(flash.code) &&
              (() => {
                const c = centers.get(flash.code)!
                return (
                  <g transform={`translate(${c.x * k + zt.x},${c.y * k + zt.y})`} className="st-label">
                    {flash.kind === 'right' && <circle r={22} className="st-ring" />}
                    <text y={flash.kind === 'right' ? 34 : 4} textAnchor="middle">
                      {countryName(flash.code)}
                    </text>
                  </g>
                )
              })()}
          </svg>

          <div className="st-zoom">
            <button onClick={() => svgRef.current && zoomRef.current && select(svgRef.current).call(zoomRef.current.scaleBy, 1.6)}>+</button>
            <button onClick={() => svgRef.current && zoomRef.current && select(svgRef.current).call(zoomRef.current.scaleBy, 1 / 1.6)}>
              −
            </button>
          </div>

          {!started && (
            <div className="st-start">
              <div className="st-start-top">
                <button className="st-pill ui-btn line" onClick={() => go('/cartographe')}>
                  Retour
                </button>
              </div>
              <h1>{title}</h1>
              <span className="st-kicker">MODE DE JEU</span>
              <div className="st-modes">
                <a href={`#/cartographe/${quizId(region.id, ask)}`} className={mode === 'epingler' ? 'on' : ''}>
                  <span>⌖</span>
                  Épingler
                </a>
                <a href={`#/cartographe/${quizId(region.id, ask)}?mode=saisir`} className={mode === 'saisir' ? 'on' : ''}>
                  <span>⌨</span>
                  Saisir
                </a>
                <a href={`#/cartographe/${quizId(region.id, ask)}?mode=apprendre`} className={mode === 'apprendre' ? 'on' : ''}>
                  <span>📖</span>
                  Apprendre
                </a>
              </div>
              <button className="st-go ui-btn" onClick={start}>
                {learning ? 'Explorer la carte' : 'Commencer le quiz'}
              </button>
            </div>
          )}

          {finished && started && (
            <div className="st-start st-end">
              <h1>{pct >= 90 ? 'Bravo !' : pct >= 60 ? 'Bien joué !' : 'Continue !'}</h1>
              <p>
                Score : <b>{pct} %</b> en <b>{formatTime(elapsed)}</b>
              </p>
              {record && <p className="st-record">Nouveau record !</p>}
              <div className="st-modes">
                <button className="st-go ui-btn" onClick={restart}>
                  Rejouer
                </button>
                <button className="st-pill ui-btn line" onClick={() => go('/cartographe')}>
                  Autres quiz
                </button>
              </div>
            </div>
          )}
        </div>

        {mode === 'saisir' && started && !finished && (
          <div className="st-type">
            {ask !== 'pays' && <span className={ask === 'drapeaux' ? 'st-target flag' : 'st-target'}>{prompt(current, ask)}</span>}
            <input
              autoFocus
              className={shake ? 'shake' : ''}
              value={typed}
              placeholder="Quel est ce pays ?"
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onType()}
            />
            <button className="st-go ui-btn" onClick={onType}>
              Valider
            </button>
          </div>
        )}

        <section className="st-info">
          <h2>{title}</h2>
          <p>
            {members.length} pays à trouver. Premier essai : blanc · deuxième : jaune · troisième : orange · après trois erreurs,
            le pays clignote en rouge. Molette ou pincement pour zoomer, glisser pour déplacer la carte.
          </p>
          <p className="st-list-names">{members.map(countryName).sort((a, b) => a.localeCompare(b, 'fr')).join(' · ')}</p>
        </section>
      </main>
    </div>
  )
}
