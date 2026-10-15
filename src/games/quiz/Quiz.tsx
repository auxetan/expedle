import { useEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES, flagEmoji } from '../../geo/countries'
import { dailyResult, recordPlay, saveDailyResult, submitBest } from '../../lib/stats'
import { copyText, seededRng, shuffle, todayKey } from '../../lib/util'
import { QUESTIONS } from './questions'
import './quiz.css'

type Kind = 'culture' | 'jour' | 'drapeaux' | 'capitales'

interface Item {
  cat: string
  q: string
  big?: string
  answer: string
  options: string[]
}

const MODE_TABS: Record<Kind, string> = { culture: 'Culture G', jour: 'Du jour', drapeaux: 'Drapeaux', capitales: 'Capitales' }

const COUNT = 10
const TIME = 20000

const TITLES: Record<Kind, string> = {
  culture: 'Quiz culture G',
  jour: 'Quiz du jour',
  drapeaux: 'Drapeaux',
  capitales: 'Capitales',
}

function sovereign() {
  return COUNTRIES.filter((c) => !c.territory && c.capital !== '—')
}

function wrongOptions<T>(pool: T[], correct: T, same: (t: T) => boolean, rng: () => number): T[] {
  const near = shuffle(pool.filter((t) => t !== correct && same(t)), rng)
  const far = shuffle(pool.filter((t) => t !== correct && !same(t)), rng)
  return [...near, ...far].slice(0, 3)
}

function buildItems(kind: Kind, rng: () => number): Item[] {
  if (kind === 'drapeaux' || kind === 'capitales') {
    const pool = sovereign()
    return shuffle(pool, rng)
      .slice(0, COUNT)
      .map((c) => {
        const wrong = wrongOptions(pool, c, (o) => o.continent === c.continent, rng)
        return kind === 'drapeaux'
          ? {
              cat: 'Drapeaux',
              q: 'À quel pays appartient ce drapeau ?',
              big: flagEmoji(c.code),
              answer: c.name,
              options: shuffle([c.name, ...wrong.map((w) => w.name)], rng),
            }
          : {
              cat: 'Capitales',
              q: `Quelle est la capitale de ce pays ?`,
              big: c.name,
              answer: c.capital,
              options: shuffle([c.capital, ...wrong.map((w) => w.capital)], rng),
            }
      })
  }
  return shuffle(QUESTIONS, rng)
    .slice(0, COUNT)
    .map((q) => ({ cat: q.cat, q: q.q, answer: q.a, options: shuffle([q.a, ...q.w], rng) }))
}

export default function Quiz({ kind: raw }: { kind?: string }) {
  const kind: Kind = raw === 'jour' || raw === 'drapeaux' || raw === 'capitales' ? raw : 'culture'
  const day = todayKey()
  const done = kind === 'jour' ? dailyResult<{ score: number; good: number }>('quiz-jour', day) : null
  const [run, setRun] = useState(0)
  const items = useMemo(
    () => buildItems(kind, kind === 'jour' && run === 0 ? seededRng('quiz-' + day) : Math.random),
    [kind, run, day],
  )
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
  const item = items[i]
  const alreadyPlayed = !!done && run === 0

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
  }, [i, over, run, picked, alreadyPlayed])

  function answer(opt: string) {
    if (picked !== null) return
    const remaining = Math.max(0, TIME - (performance.now() - t0.current))
    const ok = opt === item.answer
    const pts = ok ? 100 + Math.round((remaining / TIME) * 100) : 0
    setPicked(opt)
    setGain(pts)
    setScore((s) => s + pts)
    if (ok) setGood((g) => g + 1)
    setResults((r) => [...r, ok])
  }

  const answerRef = useRef(answer)
  answerRef.current = answer

  function next() {
    if (i + 1 >= items.length) {
      setOver(true)
      recordPlay('quiz-' + kind)
      if (kind === 'jour' && run === 0 && !done) saveDailyResult('quiz-jour', { score, good }, day)
      setRecord(submitBest('quiz-' + kind, score))
      return
    }
    setI(i + 1)
    setPicked(null)
  }

  function replay() {
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
      <header className="qz-top">
        <a href="#/" className="qz-back">
          ← Hub
        </a>
        <h1>{TITLES[kind]}</h1>
        <nav className="qz-modes">
          {(['culture', 'jour', 'drapeaux', 'capitales'] as Kind[]).map((k) => (
            <a key={k} href={`#/quiz/${k === 'culture' ? '' : k}`} className={k === kind ? 'on' : ''}>
              {MODE_TABS[k]}
            </a>
          ))}
        </nav>
      </header>

      {alreadyPlayed && done ? (
        <main className="qz-card qz-end">
          <h2>Déjà joué aujourd’hui</h2>
          <p>
            Ton score du jour : <b>{done.score}</b> ({done.good}/{COUNT} bonnes réponses)
          </p>
          <button className="qz-cta" onClick={replay}>
            Jouer une partie libre
          </button>
        </main>
      ) : over ? (
        <main className="qz-card qz-end">
          <span className="qz-kicker">PARTIE TERMINÉE</span>
          <div className="qz-final">{score}</div>
          <p>
            {good} / {COUNT} bonnes réponses {record && <b className="qz-record">· Nouveau record !</b>}
          </p>
          <div className="qz-strip">
            {results.map((r, k) => (
              <span key={k} className={r ? 'ok' : 'ko'} />
            ))}
          </div>
          <ul className="qz-recap">
            {items.map((it, k) => (
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
                setCopied(await copyText(`${TITLES[kind]}${kind === 'jour' ? ' ' + day : ''}\n${results.map((r) => (r ? '🟩' : '🟥')).join('')} ${score} pts`))
              }
            >
              {copied ? 'Copié !' : 'Partager'}
            </button>
            <button className="qz-cta" onClick={replay}>
              Rejouer ↻
            </button>
          </div>
        </main>
      ) : (
        <main className="qz-card" key={i + '-' + run}>
          <div className="qz-head">
            <span className="qz-kicker">
              QUESTION {i + 1} / {COUNT} · {item.cat.toUpperCase()}
            </span>
            <span className="qz-score">{score} pts</span>
          </div>
          <div className="qz-progress">
            {items.map((_, k) => (
              <span key={k} className={k < results.length ? (results[k] ? 'ok' : 'ko') : k === i ? 'now' : ''} />
            ))}
          </div>
          <div className="qz-timer">
            <div style={{ width: `${(left / TIME) * 100}%` }} className={left < 5000 ? 'low' : ''} />
          </div>
          <h2 className="qz-q">{item.q}</h2>
          {item.big && <div className={kind === 'drapeaux' ? 'qz-big flag' : 'qz-big'}>{item.big}</div>}
          <div className="qz-options">
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
          {picked !== null && (
            <div className="qz-feedback">
              <span className={picked === item.answer ? 'qz-pill ok' : 'qz-pill ko'}>
                {picked === item.answer ? `Bonne réponse ! +${gain}` : picked === '' ? 'Temps écoulé !' : 'Raté !'}
              </span>
              <button className="qz-cta" onClick={next} autoFocus>
                {i + 1 >= items.length ? 'Voir le score' : 'Question suivante →'}
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  )
}
