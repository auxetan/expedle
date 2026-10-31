import { geoAzimuthalEqualArea, geoConicConformal, geoNaturalEarth1, geoPath, type GeoProjection } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import type { Feature, MultiPoint, Polygon } from 'geojson'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FR_REGIONS, loadFrance, type France } from '../../geo/atlas'
import { COUNTRIES, COUNTRY_BY_CODE, countryName, flagEmoji, foreignNames } from '../../geo/countries'
import { getWorld, type World } from '../../geo/world'
import { go } from '../../lib/router'
import { bestScore, recordPlay, submitBest } from '../../lib/stats'
import { newSeed, readChallenge } from '../../lib/challenge'
import { formatTime, normalize, seededRng, shuffle } from '../../lib/util'
import ChallengeBox from '../../ui/ChallengeBox'
import AppBar, { SubLink } from '../../ui/AppBar'
import CountUp from '../../ui/CountUp'
import { Icon } from '../../ui/Panels'
import { DEPARTEMENTS } from '../quiz/facts'
import { FRANCE_ASKS, parseFranceId, parseQuizId, quizId, quizTitle, REGIONS, type Ask, type FranceAsk, type Region } from './quizzes'
import './cartographe.css'
import { locale, msg, plural, t, tx } from '../../lib/i18n'
import { stamp } from '../../lib/passport'
import { feedback } from '../../lib/feedback'

type PlayMode = 'epingler' | 'saisir' | 'placer' | 'apprendre'

const MODES: [PlayMode, string, string][] = [
  ['epingler', msg('Épingler'), 'M12 2v5M12 17v5M2 12h5M17 12h5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  ['saisir', msg('Saisir'), 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10'],
  ['placer', msg('Placer'), 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3'],
  ['apprendre', msg('Apprendre'), 'M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20'],
]

export default function Cartographe({ quizId: id, params }: { quizId?: string; params: URLSearchParams }) {
  const m = params.get('mode')
  const mode: PlayMode = m === 'saisir' || m === 'placer' || m === 'apprendre' ? m : 'epingler'
  const france = id ? parseFranceId(id) : null
  if (france) return <FranceQuiz ask={france} mode={mode} />
  const parsed = id ? parseQuizId(id) : null
  if (!parsed) return <QuizList />
  return <Quiz spec={worldSpec(parsed.region, parsed.ask)} mode={mode} />
}

// Hors de quizzes.ts, qui reste léger : les pages qui n'affichent que des titres de quiz ne chargent pas la carte du monde.
function quizMembers(region: Region): string[] {
  const present = new Set(getWorld().codes)
  return COUNTRIES.filter(
    (c) => !c.territory && present.has(c.code) && region.continents.includes(c.continent) && c.capital !== '—',
  ).map((c) => c.code)
}

function franceMembers(ask: FranceAsk): string[] {
  return ask === 'regions' ? Object.keys(FR_REGIONS) : Object.values(FR_REGIONS).flat()
}

function Brand() {
  const current = window.location.hash.split('?')[0]
  return (
    <AppBar title="Seterra">
      <SubLink href="#/cartographe" active={current === '#/cartographe'}>
        {t('Tous les quiz')}
      </SubLink>
      {REGIONS.map((r) => (
        <SubLink key={r.id} href={`#/cartographe/${r.id}`} active={current === `#/cartographe/${r.id}`}>
          {t(r.name)}
        </SubLink>
      ))}
      <SubLink href="#/cartographe/france-departements" active={current.startsWith('#/cartographe/france-')}>
        {t('France')}
      </SubLink>
    </AppBar>
  )
}

function Tile({ id, count }: { id: string; count: number }) {
  const best = bestScore('carto-' + id)
  return (
    <a href={`#/cartographe/${id}`} className="st-tile">
      <b>{quizTitle(id)}</b>
      <span>{plural(count, '{n} question', '{n} questions')}</span>
      {best !== null && <em>{t('Record : {n} %', { n: best })}</em>}
    </a>
  )
}

function QuizList() {
  const asks: Ask[] = ['pays', 'capitales', 'drapeaux']
  return (
    <div className="st">
      <Brand />
      <main className="st-list">
        <h1>{t('Quiz de géographie')}</h1>
        <p className="st-lead">{t('Clique sur la carte, ou tape le nom : apprends à situer chaque pays du monde.')}</p>
        {asks.map((ask) => (
          <section key={ask}>
            <h2>{ask === 'pays' ? t('Jeux de carte') : ask === 'capitales' ? t('Jeux de capitales') : t('Jeux de drapeaux')}</h2>
            <div className="st-grid">
              {REGIONS.map((r) => (
                <Tile key={r.id} id={quizId(r.id, ask)} count={quizMembers(r).length} />
              ))}
            </div>
          </section>
        ))}
        <section>
          <h2>{t('France')}</h2>
          <div className="st-grid">
            {FRANCE_ASKS.map((ask) => (
              <Tile key={ask} id={`france-${ask}`} count={franceMembers(ask).length} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

// Ce que demande un quiz : la carte, les zones à trouver et comment les nommer.
interface Spec {
  id: string
  title: string
  map: World
  // les zones dessinées, du quiz ou non
  drawn: string[]
  members: string[]
  name: (code: string) => string
  prompt: (code: string) => string
  answers: (code: string) => string[]
  // ce que montre le mode Apprendre
  label: (code: string) => string
  flag: boolean
  // la question est le nom de la zone : en mode Saisir, la carte la montre
  asksName: boolean
  // le passeport ne compte que des pays
  countries: boolean
  // le globe en fond, pour la carte du monde entier
  sphere: boolean
  placeholder: string
  // ce qu'affiche le mode Apprendre tant que rien n'est survolé
  hint: string
  info: string
  projection: (w: number, h: number) => GeoProjection
  // hauteur de la carte pour une largeur de 1, sur grand écran puis sur téléphone
  ratio: [number, number]
  frames: Feature<Polygon>[]
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

function worldSpec(region: Region, ask: Ask): Spec {
  const world = getWorld()
  const members = quizMembers(region)
  const capital = (code: string) => COUNTRY_BY_CODE.get(code)!.capital
  return {
    id: quizId(region.id, ask),
    title: quizTitle(quizId(region.id, ask))!,
    map: world,
    drawn: world.codes.filter((c) => c !== 'AQ' || region.world),
    members,
    name: countryName,
    prompt: (c) => (ask === 'capitales' ? capital(c) : ask === 'drapeaux' ? flagEmoji(c) : countryName(c)),
    answers: (c) => {
      const meta = COUNTRY_BY_CODE.get(c)!
      return [meta.name, ...meta.aliases, ...foreignNames(c)]
    },
    label: (c) => (ask === 'capitales' ? `${countryName(c)} · ${capital(c)}` : ask === 'drapeaux' ? `${flagEmoji(c)} ${countryName(c)}` : countryName(c)),
    flag: ask === 'drapeaux',
    asksName: ask === 'pays',
    countries: true,
    sphere: !!region.world,
    placeholder: t('Quel est ce pays ?'),
    hint: t('Survole ou clique un pays'),
    info: t('{n} pays à trouver. Premier essai : blanc · deuxième : jaune · troisième : orange · après trois erreurs, le pays clignote en rouge. Molette ou pincement pour zoomer, glisser pour déplacer la carte.', { n: members.length }),
    projection: (w, h) => projectionFor(region, w, h),
    ratio: region.world ? [0.52, 0.8] : [0.72, 1.15],
    frames: [],
  }
}

const DEPS = new Map(DEPARTEMENTS.map(([num, name, pref]) => [num, { name, pref }]))

// Réponses acceptées en plus du nom officiel.
const FR_ALIASES: Record<string, string[]> = {
  '90': ['Belfort'],
  '973': ['Guyane française', 'French Guiana'],
  '974': ['Réunion'],
  Bretagne: ['Brittany'],
  Normandie: ['Normandy'],
  Corse: ['Corsica'],
  'Centre-Val de Loire': ['Centre'],
  'Provence-Alpes-Côte d’Azur': ['PACA'],
  Guyane: ['Guyane française', 'French Guiana'],
  'La Réunion': ['Réunion'],
}

// Les noms des régions et des départements restent en français, dans toutes les langues du site.
function franceSpec(france: France, ask: FranceAsk): Spec {
  const regions = ask === 'regions'
  const map = regions ? france.regions : france.departements
  const members = franceMembers(ask)
  const name = (c: string) => (regions ? c : DEPS.get(c)!.name)
  const pref = (c: string) => DEPS.get(c)!.pref
  const info = regions
    ? t('{n} régions à trouver. Premier essai : blanc · deuxième : jaune · troisième : orange · après trois erreurs, la région clignote en rouge. Molette ou pincement pour zoomer, glisser pour déplacer la carte.', { n: members.length })
    : t('{n} départements à trouver. Premier essai : blanc · deuxième : jaune · troisième : orange · après trois erreurs, le département clignote en rouge. Molette ou pincement pour zoomer, glisser pour déplacer la carte.', { n: members.length })
  return {
    id: `france-${ask}`,
    title: quizTitle(`france-${ask}`)!,
    map,
    drawn: map.codes,
    members,
    name,
    prompt: (c) => (ask === 'numeros' ? c : ask === 'prefectures' ? pref(c) : name(c)),
    answers: (c) => [name(c), ...(FR_ALIASES[c] ?? [])],
    label: (c) => (ask === 'numeros' ? `${c} · ${name(c)}` : ask === 'prefectures' ? `${name(c)} · ${pref(c)}` : name(c)),
    flag: false,
    asksName: regions || ask === 'departements',
    countries: false,
    sphere: false,
    placeholder: regions ? t('Quelle est cette région ?') : t('Quel est ce département ?'),
    hint: regions ? t('Survole ou clique une région') : t('Survole ou clique un département'),
    info,
    // Lambert-93 : la projection dans laquelle l'outre-mer a été rapproché ; le bas reste aux boutons de zoom,
    // qui cacheraient la Corse
    projection: (w, h) =>
      geoConicConformal()
        .parallels([44, 49])
        .rotate([-3, 0])
        .fitExtent(
          [
            [8, 8],
            [w - 8, h - 90],
          ],
          { type: 'FeatureCollection', features: [...map.features.values(), ...france.frames] },
        ),
    ratio: [0.82, 1.25],
    frames: france.frames,
  }
}

// La carte de France se charge à la demande, à la première ouverture d'un de ses quiz.
function FranceQuiz({ ask, mode }: { ask: FranceAsk; mode: PlayMode }) {
  const [france, setFrance] = useState<France | null>(null)
  useEffect(() => {
    void loadFrance().then(setFrance)
  }, [])
  const spec = useMemo(() => (france ? franceSpec(france, ask) : null), [france, ask])
  if (!spec)
    return (
      <div className="st">
        <Brand />
        <p className="page-loading">{t('Chargement…')}</p>
      </div>
    )
  return <Quiz spec={spec} mode={mode} />
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

function Quiz({ spec, mode }: { spec: Spec; mode: PlayMode }) {
  const { map: world, members, name, prompt } = spec
  const memberSet = useMemo(() => new Set(members), [members])
  const [challenge] = useState(readChallenge)
  // l'ordre des questions vient d'une graine : un lien de défi pose les mêmes, dans le même ordre
  const [seed, setSeed] = useState(() => challenge?.seed ?? newSeed())
  const order = useMemo(() => shuffle(members, seededRng('seterra-' + seed)), [members, seed])
  const pagePath = `/cartographe/${spec.id}${mode === 'epingler' ? '' : `?mode=${mode}`}`
  const [targets, setTargets] = useState<Map<string, Target>>(() => new Map(members.map((c) => [c, { code: c, tries: 0, status: 'pending' }])))
  const [index, setIndex] = useState(0)
  const [clicks, setClicks] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [flash, setFlash] = useState<{ code: string; kind: 'wrong' | 'right' } | null>(null)
  // les pays trouvés du premier coup d'affilée, qui font monter la note
  const run = useRef(0)
  const [hover, setHover] = useState<string | null>(null)
  const [pinned, setPinned] = useState<Set<string>>(new Set())
  const learning = mode === 'apprendre'
  const placing = mode === 'placer'
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)

  function startDrag(e: React.PointerEvent) {
    e.preventDefault()
    setDrag({ x: e.clientX, y: e.clientY })
    const move = (ev: PointerEvent) => setDrag({ x: ev.clientX, y: ev.clientY })
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.st-map [data-code]')
      const code = hit?.getAttribute('data-code')
      if (code) attemptRef.current(code)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
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
  // sur téléphone la carte est plus haute que large pour rester lisible
  const height = Math.round(width * spec.ratio[width < 640 ? 1 : 0])
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

  const projection = useMemo(() => spec.projection(width, height), [spec, width, height])
  const path = useMemo(() => geoPath(projection), [projection])
  const shapes = useMemo(() => spec.drawn.map((c) => ({ code: c, d: path(world.features.get(c)!) ?? '' })).filter((s) => s.d), [spec, world, path])
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
    recordPlay('cartographe', { pts: pct, s: pct, ms: now - startAt, sub: spec.id })
    setRecord(submitBest('carto-' + spec.id, pct))
  }, [finished, started, correct, clicks, spec, now, startAt])

  const elapsed = started ? (finished ? now : performance.now()) - startAt : 0

  function start() {
    setStarted(true)
    setStartAt(performance.now())
    setNow(performance.now())
  }

  function resolve(status: Target['status']) {
    feedback(status === 'fail' ? 'bad' : 'good', run.current)
    run.current = status === 'fail' ? 0 : run.current + 1
    if (status !== 'fail' && spec.countries) stamp(current, 'cartographe')
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
    feedback('tap')
    run.current = 0
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
    if (mode !== 'epingler') return
    attempt(code)
  }

  // Un essai sur un pays, par clic (Épingler) ou par dépôt d'étiquette (Placer).
  function attempt(code: string) {
    if (!started || finished || !memberSet.has(code)) return
    const t = targets.get(code)!
    if (t.status !== 'pending') return
    if (code === current) {
      const tries = targets.get(current)!.tries
      setClicks((c) => c + 1)
      if (tries < 3) setCorrect((c) => c + 1)
      resolve(tries === 0 ? 'ok1' : tries === 1 ? 'ok2' : tries === 2 ? 'ok3' : 'fail')
    } else miss(code)
  }

  const attemptRef = useRef(attempt)
  useEffect(() => {
    attemptRef.current = attempt
  })

  function onType() {
    if (!started || finished) return
    const ok = spec.answers(current).some((n) => normalize(n) === normalize(typed))
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
    if (challenge) return go(pagePath)
    setSeed(newSeed())
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
  const title = spec.title

  return (
    <div className="st">
      <Brand />
      <main className="st-play">
        <div className="st-frame" ref={wrapRef}>
          {started && learning && (
            <div className="st-bar">
              <span className="st-score">
                <b>{t('Apprendre')}</b>
              </span>
              <span className="st-target">{hover ? name(hover) : spec.hint}</span>
              <span className="st-right">
                <button className="st-pill ui-btn line" onClick={() => setPinned(pinned.size ? new Set() : new Set(members))}>
                  {pinned.size ? t('Masquer les noms') : t('Tous les noms')}
                </button>
                <button className="st-x" onClick={() => go('/cartographe')} aria-label={t('Quitter')}>
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
              {!finished && mode === 'epingler' && <span className={spec.flag ? 'st-target flag' : 'st-target'}>{prompt(current)}</span>}
              <span className="st-right">
                <span className="st-time">{formatTime(elapsed)}</span>
                <button className="st-x" onClick={() => go('/cartographe')} aria-label={t('Quitter')}>
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
              {spec.frames.map((f) => (
                <path key={'f' + f.id} d={path(f) ?? ''} className="st-inset" />
              ))}
              {spec.sphere && <path d={path({ type: 'Sphere' }) ?? ''} className="st-sphere" />}
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
                  mode === 'saisir' && spec.asksName && started && !finished && code === current ? 'ask' : '',
                ].join(' ')
                return <path key={code} data-code={code} d={d} style={{ fill }} className={cls} onClick={() => onCountry(code)} />
              })}
              {members.map((code) => {
                const c = centers.get(code)
                if (!c?.small) return null
                const t = targets.get(code)!
                const isAsk = mode === 'saisir' && spec.asksName && started && !finished && code === current
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
            {placing &&
              members
                .filter((code) => targets.get(code)!.status !== 'pending' && centers.get(code))
                .map((code) => {
                  const c = centers.get(code)!
                  return (
                    <g key={'p' + code} transform={`translate(${c.x * k + zt.x},${c.y * k + zt.y})`} className="st-label st-placed">
                      <text y={4} textAnchor="middle">
                        {name(code)}
                      </text>
                    </g>
                  )
                })}
            {learning &&
              [...new Set([...pinned, ...(hover && memberSet.has(hover) ? [hover] : [])])].map((code) => {
                const c = centers.get(code)
                if (!c) return null
                return (
                  <g key={'l' + code} transform={`translate(${c.x * k + zt.x},${c.y * k + zt.y})`} className="st-label">
                    <text y={4} textAnchor="middle">
                      {spec.label(code)}
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
                      {name(flash.code)}
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
              <h1>{title}</h1>
              <span className="st-kicker">{t('MODE DE JEU')}</span>
              <div className="st-modes">
                {MODES.map(([m, label, icon]) => (
                  <a key={m} href={`#/cartographe/${spec.id}${m === 'epingler' ? '' : `?mode=${m}`}`} className={mode === m ? 'on' : ''}>
                    <span>
                      <Icon d={icon} size={22} />
                    </span>
                    {t(label)}
                  </a>
                ))}
              </div>
              <button className="st-go ui-btn" onClick={start}>
                {learning ? t('Explorer la carte') : t('Commencer le quiz')}
              </button>
            </div>
          )}

          {finished && started && (
            <div className="st-start st-end">
              <h1>{pct >= 90 ? t('Bravo !') : pct >= 60 ? t('Bien joué !') : t('Continue !')}</h1>
              <p>
                {tx('Score : {score} en {time}', {
                  score: (
                    <b>
                      <CountUp value={pct} /> %
                    </b>
                  ),
                  time: <b>{formatTime(elapsed)}</b>,
                })}
              </p>
              {record && <p className="st-record">{t('Nouveau record !')}</p>}
              <div className="st-modes">
                <button className="st-go ui-btn" onClick={restart}>
                  {t('Rejouer')}
                </button>
                <button className="st-pill ui-btn line" onClick={() => go('/cartographe')}>
                  {t('Autres quiz')}
                </button>
              </div>
              {!learning && <ChallengeBox game="cartographe" path={pagePath} seed={seed} result={{ pts: pct, s: pct, ms: elapsed }} />}
            </div>
          )}
        </div>

        {placing && started && !finished && (
          <div className="st-place">
            <span className="ui-label">{t('Glisse l’étiquette sur la carte')}</span>
            <button className={drag ? 'st-chip dragging' : 'st-chip'} onPointerDown={startDrag}>
              {prompt(current)}
            </button>
          </div>
        )}
        {drag && (
          <div className="st-chip st-chip-ghost" style={{ left: drag.x, top: drag.y }}>
            {prompt(current)}
          </div>
        )}
        {mode === 'saisir' && started && !finished && (
          <div className="st-type">
            {!spec.asksName && <span className={spec.flag ? 'st-target flag' : 'st-target'}>{prompt(current)}</span>}
            <input
              autoFocus
              className={shake ? 'shake' : ''}
              value={typed}
              placeholder={spec.placeholder}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onType()}
            />
            <button className="st-go ui-btn" onClick={onType}>
              {t('Valider')}
            </button>
          </div>
        )}

        <section className="st-info">
          <h2>{title}</h2>
          <p>{spec.info}</p>
          <p className="st-list-names">{members.map(name).sort((a, b) => a.localeCompare(b, locale())).join(' · ')}</p>
          {!spec.countries && <p className="st-source">{t('Contours : IGN, ADMIN EXPRESS 2026, sous Licence Ouverte.')}</p>}
        </section>
      </main>
    </div>
  )
}
