import { geoAzimuthalEqualArea, geoCentroid, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson'
import { useEffect, useMemo, useRef, useState } from 'react'
import { countryName } from '../../geo/countries'
import { countryCenter } from '../../geo/measure'
import { getWorld, type World } from '../../geo/world'
import { newSeed, readChallenge } from '../../lib/challenge'
import { feedback, runOf } from '../../lib/feedback'
import { locale, t } from '../../lib/i18n'
import { go } from '../../lib/router'
import { FACET_LABELS, record, savoir } from '../../lib/savoir'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { seededRng } from '../../lib/util'
import AppBar from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import CountUp from '../../ui/CountUp'
import GameHud from '../../ui/GameHud'
import { flagUrl } from '../flagle/game'
import '../quiz/quiz.css'
import { askable, buildQuestions, decodeSession, encodeSession, pickItems, PROMPTS, type Question } from './session'
import './revision.css'

const LETTERS = ['A', 'B', 'C', 'D']

// Une nouvelle séance : ses cartes et le tirage de ses choix tiennent dans une graine, comme un défi.
function newSession(world: World): string {
  const salt = newSeed()
  return encodeSession(pickItems(world, savoir(), Date.now(), seededRng(salt)), salt)
}

const label = (q: Question, option: string) => (q.facet === 'capitale' ? option : countryName(option))

const SIZE = 240

function Shape({ world, code }: { world: World; code: string }) {
  const d = useMemo(() => {
    const [lon, lat] = countryCenter(world, code)
    const f = world.features.get(code)!
    const projection = geoAzimuthalEqualArea()
      .rotate([-lon, -lat])
      .fitExtent(
        [
          [12, 12],
          [SIZE - 12, SIZE - 12],
        ],
        f,
      )
    return geoPath(projection)(f) ?? ''
  }, [world, code])
  return (
    <svg className="rv-shape" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={t('Silhouette du pays à trouver')}>
      <path d={d} />
    </svg>
  )
}

function Flag({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    flagUrl(code).then((url) => alive && setSrc(url))
    return () => {
      alive = false
    }
  }, [code])
  return <div className="rv-flag">{src && <img src={src} alt={t('Drapeau')} draggable={false} />}</div>
}

const PW = 600
const PH = 320

// la masse principale d'un pays, sans ses îles lointaines : c'est elle qui cadre la carte
function mainland(world: World, code: string): Feature<MultiPolygon> {
  const parts = world.parts.filter((p) => p.code === code)
  const max = Math.max(...parts.map((p) => p.area))
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiPolygon', coordinates: parts.filter((p) => p.area >= max * 0.25).map((p) => p.feature.geometry.coordinates) },
  }
}

// La région des quatre pays proposés, chacun marqué de sa lettre : on répond en touchant le pays ou sa lettre.
function Place({ world, question, picked, onPick }: { world: World; question: Question; picked: string | null; onPick: (code: string) => void }) {
  const { land, marks } = useMemo(() => {
    const frame: FeatureCollection<MultiPolygon> = { type: 'FeatureCollection', features: question.options.map((c) => mainland(world, c)) }
    const [lon, lat] = geoCentroid(frame)
    const projection = geoAzimuthalEqualArea()
      .rotate([-lon, -lat])
      .clipAngle(90)
      .fitExtent(
        [
          [44, 36],
          [PW - 44, PH - 36],
        ],
        frame,
      )
    const path = geoPath(projection)
    return {
      land: world.codes.map((code) => ({ code, d: path(world.features.get(code)!) ?? '' })).filter((s) => s.d),
      marks: question.options.map((code) => projection(countryCenter(world, code))!),
    }
  }, [world, question])
  const state = (code: string) => (picked === null ? 'opt' : code === question.answer ? 'right' : code === picked ? 'wrong' : 'dim')
  const pick = (code: string) => picked === null && onPick(code)

  return (
    <svg className="rv-place" viewBox={`0 0 ${PW} ${PH}`} role="img" aria-label={t('Carte de la région, quatre pays marqués de A à D')}>
      {land.map(({ code, d }) =>
        question.options.includes(code) ? (
          <path key={code} d={d} className={`rv-land ${state(code)}`} onClick={() => pick(code)} />
        ) : (
          <path key={code} d={d} className="rv-land" />
        ),
      )}
      {question.options.map((code, k) => (
        <g key={code} transform={`translate(${marks[k][0]},${marks[k][1]})`} className={`rv-mark ${state(code)}`} onClick={() => pick(code)}>
          <circle r={13} />
          <text y={4.5} textAnchor="middle">
            {LETTERS[k]}
          </text>
          {/* seul le bon pays est nommé : les quatre noms sont déjà sous la carte, et deux voisins se chevaucheraient */}
          {picked !== null && code === question.answer && (
            <text y={-20} textAnchor="middle" className="rv-name">
              {countryName(code)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

export default function Revision() {
  const world = getWorld()
  const [challenge] = useState(readChallenge)
  const [seed, setSeed] = useState(() => challenge?.seed ?? newSession(world))
  // une graine venue d'un lien ne demande que ce qui peut se demander
  const questions = useMemo(() => buildQuestions(world, decodeSession(seed).filter((it) => askable(world, it)), seededRng('revision-' + seed)), [world, seed])
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [results, setResults] = useState<boolean[]>([])
  const [over, setOver] = useState(false)
  const [ms, setMs] = useState<number>()
  const elapsed = useStopwatch(seed)
  const q = questions[i]
  const good = results.filter(Boolean).length

  function answer(option: string) {
    if (picked !== null) return
    const ok = option === q.answer
    feedback(ok ? 'good' : 'bad', runOf(results))
    record(q.code, q.facet, ok)
    setPicked(option)
    setResults([...results, ok])
  }

  function next() {
    if (i + 1 < questions.length) {
      setI(i + 1)
      setPicked(null)
      return
    }
    const time = elapsed()
    setOver(true)
    setMs(time)
    // un entraînement : la révision n'entre jamais dans les classements du jour
    recordPlay('revision', { pts: (100 * good) / questions.length, s: good, ms: time, sub: 'libre' })
    if (!challenge && !dailyResult('revision')) saveDailyResult('revision', { good, total: questions.length })
  }

  function again() {
    if (challenge) return go('/revision')
    setSeed(newSession(world))
    setI(0)
    setPicked(null)
    setResults([])
    setOver(false)
  }

  // A–D ou 1–4 pour répondre, Entrée pour passer à la suite
  const answerRef = useRef(answer)
  const nextRef = useRef(next)
  useEffect(() => {
    answerRef.current = answer
    nextRef.current = next
  })
  useEffect(() => {
    if (over || !q) return
    const onKey = (e: KeyboardEvent) => {
      const k = Math.max('abcd'.indexOf(e.key.toLowerCase()), '1234'.indexOf(e.key))
      if (picked === null && k >= 0 && q.options[k]) answerRef.current(q.options[k])
      else if (picked !== null && e.key === 'Enter') {
        e.preventDefault()
        nextRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [over, picked, q])

  return (
    <div className="qz rv">
      <AppBar title={t('Révision du jour')} />
      <header className="qz-top">
        <h1>{t('Révision du jour')}</h1>
      </header>

      {!q ? (
        <main className="qz-card rv-empty">
          <h2>{t('Rien à revoir pour l’instant')}</h2>
          <p>{t('Joue à Worldle, Flagle, Globle, Travle, Seterra ou aux quiz Drapeaux et Capitales : ce que tu rates reviendra ici, au bon moment.')}</p>
          <a className="qz-cta" href="#/savoir">
            {t('Ma carte du savoir')}
          </a>
        </main>
      ) : over ? (
        <main className="qz-card qz-end">
          <span className="qz-kicker">{t('RÉVISION TERMINÉE')}</span>
          <div className="qz-final">
            <CountUp value={good} />
            <small> / {questions.length}</small>
          </div>
          <div className="qz-strip stagger">
            {results.map((r, k) => (
              <span key={k} className={r ? 'ok' : 'ko'} />
            ))}
          </div>
          <ul className="qz-recap stagger">
            {questions.map((it, k) => (
              <li key={k} className={results[k] ? 'ok' : 'ko'}>
                <span>{t(FACET_LABELS[it.facet])}</span>
                <b>{it.answer === it.code ? countryName(it.code) : `${countryName(it.code)} · ${label(it, it.answer)}`}</b>
              </li>
            ))}
          </ul>
          <div className="qz-actions">
            <a className="qz-ghost" href="#/savoir">
              {t('Ma carte du savoir')}
            </a>
            <button className="qz-cta" onClick={again}>
              {t('Encore une révision ↻')}
            </button>
          </div>
          <ChallengeBox game="revision" path="/revision" seed={seed} result={{ pts: (100 * good) / questions.length, s: good, ms }} />
        </main>
      ) : (
        <>
          {/* hors de la carte, recréée à chaque question : le bandeau garde le fil de la séance */}
          <div className="qz-hud">
            <GameHud
              steps={questions.map((_, k) => (k < results.length ? results[k] : null))}
              label={`${t('QUESTION {n} / {total}', { n: i + 1, total: questions.length })} · ${t(FACET_LABELS[q.facet]).toLocaleUpperCase(locale())}`}
            />
          </div>
          <main className="qz-card" key={`${seed}-${i}`}>
            <h2 className="qz-q">{t(PROMPTS[q.facet])}</h2>
            {q.facet === 'forme' ? (
              <Shape world={world} code={q.code} />
            ) : q.facet === 'drapeau' ? (
              <Flag code={q.code} />
            ) : (
              <div className="qz-big">{countryName(q.code)}</div>
            )}
            {q.facet === 'position' && <Place world={world} question={q} picked={picked} onPick={answer} />}
            <div className={q.facet === 'position' && picked === null ? 'qz-options rv-letters stagger' : 'qz-options stagger'}>
              {q.options.map((option, k) => {
                const state = picked === null ? '' : option === q.answer ? 'right' : option === picked ? 'wrong' : 'dim'
                return (
                  <button key={option} className={`qz-opt ${state}`} onClick={() => answer(option)} disabled={picked !== null}>
                    <span className="qz-letter">{LETTERS[k]}</span>
                    {/* sur la carte, le nom donnerait la réponse : il n'apparaît qu'après */}
                    {(q.facet !== 'position' || picked !== null) && label(q, option)}
                  </button>
                )
              })}
            </div>
            {picked !== null && (
              <div className="qz-feedback">
                <span className={picked === q.answer ? 'qz-pill ok' : 'qz-pill ko'}>{picked === q.answer ? t('Bonne réponse !') : t('Raté !')}</span>
                <button className="qz-cta" onClick={next} autoFocus>
                  {i + 1 >= questions.length ? t('Voir le score') : t('Question suivante →')}
                </button>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  )
}
