import { useEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES, countryName, flagEmoji } from '../../geo/countries'
import { dailyResult, recordPlay, saveDailyResult, submitBest, useStopwatch } from '../../lib/stats'
import { newSeed, readChallenge } from '../../lib/challenge'
import { go } from '../../lib/router'
import { copyText, load, save, seededRng, shuffle, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import CountUp from '../../ui/CountUp'
import GameHud from '../../ui/GameHud'
import Joker from '../../ui/Joker'
import { CATEGORIES, pickQuestions, questionBank, type BankQuestion } from './bank'
import './quiz.css'
import { locale, msg, t, tx } from '../../lib/i18n'
import { stamp } from '../../lib/passport'
import { record as recordSavoir } from '../../lib/savoir'
import { feedback, runOf } from '../../lib/feedback'

type Kind = 'culture' | 'jour' | 'drapeaux' | 'capitales'

interface Item {
  id?: string
  // le pays de la question, pour le passeport
  code?: string
  cat: string
  q: string
  big?: string
  answer: string
  options: string[]
}

const MODE_TABS: Record<Kind, string> = { culture: msg('Culture G'), jour: msg('Du jour'), drapeaux: msg('Drapeaux'), capitales: msg('Capitales') }

const COUNT = 10
const TIME = 20000

const TITLES: Record<Kind, string> = {
  culture: msg('Quiz culture G'),
  jour: msg('Quiz du jour'),
  drapeaux: msg('Drapeaux'),
  capitales: msg('Capitales'),
}

function sovereign() {
  return COUNTRIES.filter((c) => !c.territory && c.capital !== '—')
}

function wrongOptions<T>(pool: T[], correct: T, same: (t: T) => boolean, rng: () => number): T[] {
  const near = shuffle(pool.filter((t) => t !== correct && same(t)), rng)
  const far = shuffle(pool.filter((t) => t !== correct && !same(t)), rng)
  return [...near, ...far].slice(0, 3)
}

function buildItems(kind: Kind, rng: () => number, category: string | null): Item[] {
  if (kind === 'drapeaux' || kind === 'capitales') {
    const pool = sovereign()
    return shuffle(pool, rng)
      .slice(0, COUNT)
      .map((c) => {
        const wrong = wrongOptions(pool, c, (o) => o.continent === c.continent, rng)
        return kind === 'drapeaux'
          ? {
              code: c.code,
              cat: 'Drapeaux',
              q: t('À quel pays appartient ce drapeau ?'),
              big: flagEmoji(c.code),
              answer: countryName(c.code),
              options: shuffle([c.code, ...wrong.map((w) => w.code)], rng).map(countryName),
            }
          : {
              code: c.code,
              cat: 'Capitales',
              q: t('Quelle est la capitale de ce pays ?'),
              big: countryName(c.code),
              answer: c.capital,
              options: shuffle([c.capital, ...wrong.map((w) => w.capital)], rng),
            }
      })
  }
  return pickQuestions(rng, COUNT, category, kind === 'jour' ? new Set() : new Set(load<string[]>('quiz-seen', []))).map((q) => bankItem(q, rng))
}

const bankItem = (q: BankQuestion, rng: () => number): Item => ({ id: q.id, cat: q.cat, q: q.q, big: q.big, answer: q.a, options: shuffle([q.a, ...q.w], rng) })

// Un défi de culture G emporte ses questions elles-mêmes : le tirage du créateur dépend de ce qu'il a déjà vu.
function itemsFromIds(ids: string[], rng: () => number): Item[] {
  const byId = new Map(questionBank().map((q) => [q.id, q]))
  return ids.flatMap((id) => {
    const q = byId.get(id)
    return q ? [bankItem(q, rng)] : []
  })
}


export default function Quiz({ kind: raw }: { kind?: string }) {
  const kind: Kind = raw === 'jour' || raw === 'drapeaux' || raw === 'capitales' ? raw : 'culture'
  const day = todayKey()
  const done = kind === 'jour' ? dailyResult<{ score: number; good: number }>('quiz-jour', day) : null
  const [challenge] = useState(readChallenge)
  const [run, setRun] = useState(0)
  const [category, setCategory] = useState<string | null>(null)
  const [seed, setSeed] = useState(() => challenge?.seed ?? (kind === 'jour' ? day : newSeed()))
  const items = useMemo(
    () =>
      kind === 'culture' && challenge?.seed === seed
        ? itemsFromIds(seed.split('.'), seededRng('quiz-' + seed))
        : buildItems(kind, seededRng('quiz-' + seed), kind === 'culture' ? category : null),
    [kind, seed, category, challenge],
  )
  // les questions passées avec un joker, remplacées par d'autres
  const [swaps, setSwaps] = useState<Record<number, Item>>({})
  const deck = useMemo(() => items.map((it, k) => swaps[k] ?? it), [items, swaps])
  const jokers = kind === 'culture' && !challenge
  const jokered = Object.keys(swaps).length > 0
  const challengeSeed = kind === 'culture' ? deck.map((it) => it.id).join('.') : seed
  const [ms, setMs] = useState<number>()
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [good, setGood] = useState(0)
  const [gain, setGain] = useState(0)
  const [left, setLeft] = useState(TIME)
  const [over, setOver] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [copied, setCopied] = useState(false)
  const [record, setRecord] = useState(false)
  const t0 = useRef(performance.now())
  const elapsed = useStopwatch(run)
  const item = deck[i]
  const alreadyPlayed = !challenge && !!done && run === 0

  useEffect(() => {
    if (over || picked !== null || alreadyPlayed) return
    t0.current = performance.now()
    setLeft(TIME)
    const id = setInterval(() => {
      const remaining = Math.max(0, TIME - (performance.now() - t0.current))
      setLeft(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        answerRef.current('')
      }
    }, 100)
    return () => clearInterval(id)
  }, [i, item, over, run, picked, alreadyPlayed])

  function answer(opt: string) {
    if (picked !== null) return
    const remaining = Math.max(0, TIME - (performance.now() - t0.current))
    const ok = opt === item.answer
    feedback(ok ? 'good' : 'bad', runOf(results))
    if (ok && item.code) stamp(item.code, 'quiz-' + kind)
    // seuls les quiz Drapeaux et Capitales portent sur un pays
    if (item.code) recordSavoir(item.code, kind === 'drapeaux' ? 'drapeau' : 'capitale', ok)
    const pts = ok ? 100 + Math.round((remaining / TIME) * 100) : 0
    setPicked(opt)
    setGain(pts)
    setScore((s) => s + pts)
    if (ok) setGood((g) => g + 1)
    setResults((r) => [...r, ok])
  }

  const answerRef = useRef(answer)
  answerRef.current = answer
  const nextRef = useRef(next)
  nextRef.current = next

  // A–D ou 1–4 pour répondre, Entrée pour passer à la suite
  useEffect(() => {
    if (over || alreadyPlayed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const k = 'abcd'.indexOf(e.key.toLowerCase()) >= 0 ? 'abcd'.indexOf(e.key.toLowerCase()) : '1234'.indexOf(e.key)
      if (picked === null && k >= 0 && item.options[k]) answerRef.current(item.options[k])
      else if (picked !== null && e.key === 'Enter') {
        e.preventDefault()
        nextRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [over, alreadyPlayed, picked, item])

  function next() {
    if (i + 1 >= items.length) {
      const ms = elapsed()
      setOver(true)
      setMs(ms)
      recordPlay('quiz-' + kind, { pts: (100 * good) / items.length, s: score, ms, sub: challenge ? 'defi' : (category ?? undefined) })
      if (kind === 'jour' && run === 0 && !done && !challenge) saveDailyResult('quiz-jour', { score, good }, day)
      setRecord(submitBest('quiz-' + kind, score))
      const ids = deck.map((it) => it.id).filter((x): x is string => !!x)
      if (ids.length) save('quiz-seen', [...load<string[]>('quiz-seen', []), ...ids].slice(-3000))
      return
    }
    setI(i + 1)
    setPicked(null)
  }

  function skip() {
    const seen = new Set([...load<string[]>('quiz-seen', []), ...deck.map((it) => it.id!)])
    const [q] = pickQuestions(Math.random, 1, category, seen)
    setSwaps({ ...swaps, [i]: bankItem(q, Math.random) })
  }

  function replay() {
    if (challenge) return go(`/quiz/${kind === 'culture' ? '' : kind}`)
    setSeed(newSeed())
    setSwaps({})
    setRun(run + 1)
    setI(0)
    setPicked(null)
    setScore(0)
    setGood(0)
    setResults([])
    setOver(false)
    setCopied(false)
  }

  const letters = ['A', 'B', 'C', 'D']

  return (
    <div className="qz">
      <AppBar title="Quiz">
        {(['culture', 'jour', 'drapeaux', 'capitales'] as Kind[]).map((k) => (
          <SubLink key={k} href={`#/quiz/${k === 'culture' ? '' : k}`} active={k === kind}>
            {t(MODE_TABS[k])}
          </SubLink>
        ))}
      </AppBar>
      <header className="qz-top">
        <h1>{t(TITLES[kind])}</h1>
      </header>
      {kind === 'culture' && (
        <div className="qz-cats">
          {[null, ...CATEGORIES].map((c) => (
            <button
              key={c ?? 'all'}
              className={category === c ? 'on' : ''}
              onClick={() => {
                setCategory(c)
                replay()
              }}
            >
              {c ? t(c) : t('Toutes')}
            </button>
          ))}
        </div>
      )}

      {alreadyPlayed && done ? (
        <main className="qz-card qz-end">
          <h2>{t('Déjà joué aujourd’hui')}</h2>
          <p>{tx('Ton score du jour : {score} ({good}/{count} bonnes réponses)', { score: <b>{done.score}</b>, good: done.good, count: COUNT })}</p>
          <button className="qz-cta" onClick={replay}>
            {t('Jouer une partie libre')}
          </button>
        </main>
      ) : over ? (
        <main className="qz-card qz-end">
          <span className="qz-kicker">{t('PARTIE TERMINÉE')}</span>
          <div className="qz-final">
            <CountUp value={score} />
          </div>
          <p>
            {t('{good} / {count} bonnes réponses', { good, count: COUNT })} {record && <b className="qz-record">· {t('Nouveau record !')}</b>}
          </p>
          <div className="qz-strip stagger">
            {results.map((r, k) => (
              <span key={k} className={r ? 'ok' : 'ko'} />
            ))}
          </div>
          <ul className="qz-recap stagger">
            {deck.map((it, k) => (
              <li key={k} className={results[k] ? 'ok' : 'ko'}>
                <span>{it.big ? `${it.big} — ` : ''}{it.q}</span>
                <b>{it.answer}</b>
              </li>
            ))}
          </ul>
          <div className="qz-actions">
            <button
              className="qz-ghost"
              onClick={async () =>
                setCopied(await copyText(`${t(TITLES[kind])}${kind === 'jour' ? ' ' + day : ''}\n${results.map((r) => (r ? '🟩' : '🟥')).join('')} ${t('{n} pts', { n: score })}`))
              }
            >
              {copied ? t('Copié !') : t('Partager')}
            </button>
            <button className="qz-cta" onClick={replay}>
              {t('Rejouer ↻')}
            </button>
          </div>
          {!jokered && (
            <ChallengeBox
              game={'quiz-' + kind}
              path={kind === 'culture' ? '/quiz' : `/quiz/${kind}`}
              seed={challengeSeed}
              result={{ pts: (100 * good) / items.length, s: score, ms }}
            />
          )}
        </main>
      ) : (
        <>
          {/* hors de la carte, recréée à chaque question : le bandeau garde le fil de la partie */}
          <div className="qz-hud">
            <GameHud
              steps={items.map((_, k) => (k < results.length ? results[k] : null))}
              label={`${t('QUESTION {n} / {total}', { n: i + 1, total: COUNT })} · ${t(item.cat).toLocaleUpperCase(locale())}`}
              score={score}
              time={{ left, total: TIME }}
            />
          </div>
          <main className="qz-card" key={`${i}-${run}-${item.id}`}>
            <h2 className="qz-q">{item.q}</h2>
            {item.big && <div className={kind === 'drapeaux' ? 'qz-big flag' : 'qz-big'}>{item.big}</div>}
            <div className="qz-options stagger">
              {item.options.map((opt, k) => {
                const state =
                  picked === null ? '' : opt === item.answer ? 'right' : opt === picked ? 'wrong' : 'dim'
                return (
                  <button key={opt} className={`qz-opt ${state}`} onClick={() => answer(opt)} disabled={picked !== null}>
                    <span className="qz-letter">{letters[k]}</span>
                    {opt}
                  </button>
                )
              })}
            </div>
            {picked === null && jokers && <Joker id="joker:passe" onUse={skip} />}
            {picked !== null && (
              <div className="qz-feedback">
                <span className={picked === item.answer ? 'qz-pill ok' : 'qz-pill ko'}>
                  {picked === item.answer ? t('Bonne réponse ! +{n}', { n: gain }) : picked === '' ? t('Temps écoulé !') : t('Raté !')}
                </span>
                <button className="qz-cta" onClick={next} autoFocus>
                  {i + 1 >= items.length ? t('Voir le score') : t('Question suivante →')}
                </button>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  )
}
