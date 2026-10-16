import { useEffect, useMemo, useRef, useState } from 'react'
import { bestScore, dailyResult, recordPlay, saveDailyResult, submitBest, useStopwatch } from '../../lib/stats'
import { copyText, formatInt, load, save, seededRng, shuffle, todayKey } from '../../lib/util'
import type { EstimateQuestion } from './estimates'
import { estimationBank } from './estimationBank'
import MgShell, { HelpStep, MgHelp } from './MgShell'
import NumberInput, { formatNumber, parseNumber } from './NumberInput'
import './mg.css'

export function magnitudeError(guess: number, answer: number): number {
  return Math.abs(Math.log10(Math.max(guess, 1e-9) / answer))
}

export function dailyScore(guess: number, answer: number): number {
  return Math.max(0, Math.floor(100 * (1 - magnitudeError(guess, answer) / 3)))
}

function offLabel(guess: number, answer: number): string {
  const r = guess / answer
  if (Math.abs(Math.log10(r)) < 0.02) return 'Pile poil !'
  const k = r > 1 ? r : 1 / r
  const txt = k < 10 ? `×${k.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}` : `${formatInt(k)}×`
  return `${txt} ${r > 1 ? 'trop haut' : 'trop bas'}`
}

function Scale({ guess, answer }: { guess: number; answer: number }) {
  const lo = Math.floor(Math.min(Math.log10(Math.max(guess, 1)), Math.log10(answer))) - 1
  const hi = Math.ceil(Math.max(Math.log10(Math.max(guess, 1)), Math.log10(answer))) + 1
  const pos = (v: number) => `${((Math.log10(Math.max(v, 1)) - lo) / (hi - lo)) * 100}%`
  const step = Math.max(1, Math.ceil((hi - lo) / 6))
  const ticks: number[] = []
  for (let e = lo; e <= hi; e += step) ticks.push(e)
  return (
    <div className="oom">
      <span className="oom-label">ORDRE DE GRANDEUR</span>
      <div className="oom-track">
        <span className="oom-mark guess" style={{ left: pos(guess) }} title="Ton estimation" />
        <span className="oom-mark answer" style={{ left: pos(answer) }} title="Réponse" />
      </div>
      <div className="oom-ticks">
        {ticks.map((e) => (
          <span key={e} style={{ left: `${((e - lo) / (hi - lo)) * 100}%` }}>
            10<sup>{e}</sup>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Estimation({ mode, date }: { mode: 'daily' | 'survival'; date?: string | null }) {
  return mode === 'daily' ? <Daily date={date ?? todayKey()} /> : <Survival />
}

function DailyHelp() {
  return (
    <MgHelp title="Comment jouer" intro="Le déroulé, le calcul du score et quelques stratégies en moins d’une minute.">
      <HelpStep n="01" title="Lire">
        Une nouvelle question d’estimation chaque jour.
      </HelpStep>
      <HelpStep n="02" title="Estimer">
        Entre un seul nombre. Utilise ×1K, ×1M et les autres raccourcis pour changer d’échelle rapidement.
      </HelpStep>
      <HelpStep n="03" title="Calibrer">
        Ton score dépend de l’écart entre ton estimation et la réponse, en puissances de dix. Exemple : 1 000 000 pour une
        réponse de 600 000 donne 92 points.
      </HelpStep>
      <p className="mg-tip">
        <b>Astuce :</b> pars d’un repère familier, puis multiplie.
      </p>
    </MgHelp>
  )
}

function Daily({ date: day }: { date: string }) {
  const done = dailyResult<{ guess: number }>('question', day)
  const [practice, setPractice] = useState(0)
  const question = useMemo(() => {
    const rng = practice ? Math.random : seededRng('question-' + day)
    const bank = estimationBank()
    return bank[Math.floor(rng() * bank.length)]
  }, [practice, day])
  const [value, setValue] = useState('')
  const [guess, setGuess] = useState<number | null>(!practice && done ? done.guess : null)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const elapsed = useStopwatch(practice)

  const parsed = parseNumber(value)
  const valid = Number.isFinite(parsed) && parsed > 0

  function lock() {
    if (!valid) return
    setGuess(parsed)
    const score = dailyScore(parsed, question.a)
    recordPlay('question', { pts: score, s: score, ms: elapsed(), sub: practice ? 'entrainement' : undefined })
    if (!practice) saveDailyResult('question', { guess: parsed, score: dailyScore(parsed, question.a) }, day)
  }

  const date = new Date(day + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).toUpperCase()
  return (
    <MgShell title="Daily Question" help={<DailyHelp />}>
      <section className="dq">
        <div className="dq-kicker">
          {practice ? 'ENTRAÎNEMENT' : date} · <span>{question.cat.toUpperCase()}</span>
        </div>
        <h2 className="dq-q">{question.q}</h2>
        {guess === null ? (
          <>
            <NumberInput ref={inputRef} value={value} onChange={setValue} onSubmit={lock} unit={question.unit} />
            <button className="mg-cta dq-lock" disabled={!valid} onClick={lock}>
              Valider →
            </button>
          </>
        ) : (
          <Result
            question={question}
            guess={guess}
            onShare={async () =>
              setCopied(
                await copyText(
                  `Daily Question ${day}\n${question.q}\nScore : ${dailyScore(guess, question.a)}/100 (${offLabel(guess, question.a)})`,
                ),
              )
            }
            copied={copied}
            onAgain={() => {
              setPractice((p) => p + 1)
              setGuess(null)
              setValue('')
              setCopied(false)
            }}
          />
        )}
      </section>
    </MgShell>
  )
}

function Result({
  question,
  guess,
  onShare,
  copied,
  onAgain,
}: {
  question: EstimateQuestion
  guess: number
  onShare: () => void
  copied: boolean
  onAgain: () => void
}) {
  const score = dailyScore(guess, question.a)
  return (
    <div className="dq-result">
      <div className="dq-score">
        <span>{score}</span>/ 100
      </div>
      <div className="dq-pair">
        <div>
          <small>TON ESTIMATION</small>
          <b className="red">{formatNumber(guess)}</b>
        </div>
        <div>
          <small>RÉPONSE</small>
          <b className="blue">{formatNumber(question.a)}</b>
        </div>
        <div>
          <small>ÉCART</small>
          <b>{offLabel(guess, question.a)}</b>
        </div>
      </div>
      <Scale guess={guess} answer={question.a} />
      {question.fact && <p className="dq-fact">{question.fact}</p>}
      <div className="mg-modal-actions">
        <button className="mg-ghost-btn" onClick={onShare}>
          {copied ? 'Copié !' : 'Partager'}
        </button>
        <button className="mg-cta" onClick={onAgain}>
          Une autre question ↻
        </button>
      </div>
    </div>
  )
}

function SurvivalHelp() {
  return (
    <MgHelp title="Comment jouer à Survival Mode" intro="Estime vite, protège ta vie et survis au plus grand nombre de questions.">
      <HelpStep n="01" title="Course contre la montre">
        Tu as 15 secondes par question. Si le temps s’écoule, ta saisie actuelle (ou 1) est envoyée.
      </HelpStep>
      <HelpStep n="02" title="Protège ta vie">
        Tu commences avec 10 points de vie. Ton erreur en ordres de grandeur est retirée après chaque réponse (100× trop haut =
        −2,0).
      </HelpStep>
      <HelpStep n="03" title="Survis">
        Continue jusqu’à ce que ta vie tombe à zéro.
      </HelpStep>
      <p className="mg-tip">
        <b>Astuce :</b> les raccourcis ×K, ×M, ×Md, ×T et ×Q permettent d’atteindre vite le bon ordre de grandeur.
      </p>
    </MgHelp>
  )
}

const TIME = 15000

function Survival() {
  const [phase, setPhase] = useState<'idle' | 'play' | 'feedback' | 'over'>('idle')
  const [deck, setDeck] = useState<ReturnType<typeof estimationBank>>([])
  const [i, setI] = useState(0)
  const [life, setLife] = useState(10)
  const [value, setValue] = useState('')
  const [left, setLeft] = useState(TIME)
  const [last, setLast] = useState<{ guess: number; loss: number } | null>(null)
  const [record, setRecord] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const [run, setRun] = useState(0)
  const elapsed = useStopwatch(run)

  const q = deck[i]

  function start() {
    const seen = new Set(load<string[]>('survie-seen', []))
    const bank = estimationBank()
    setDeck([...shuffle(bank.filter((q) => !seen.has(q.id))), ...shuffle(bank.filter((q) => seen.has(q.id)))])
    setI(0)
    setLife(10)
    setValue('')
    setLast(null)
    setPhase('play')
    setRun((r) => r + 1)
  }

  function submit(fromTimer = false) {
    if (phase !== 'play') return
    const n = parseNumber(valueRef.current)
    const guess = Number.isFinite(n) && n > 0 ? n : 1
    if (!fromTimer && !(Number.isFinite(n) && n > 0)) return
    const loss = Math.round(magnitudeError(guess, q.a) * 10) / 10
    const newLife = Math.max(0, Math.round((life - loss) * 10) / 10)
    setLast({ guess, loss })
    setLife(newLife)
    setPhase('feedback')
    setTimeout(() => {
      if (newLife <= 0) {
        setPhase('over')
        save('survie-seen', [...load<string[]>('survie-seen', []), ...deck.slice(0, i + 1).map((d) => d.id)].slice(-1200))
        recordPlay('survie', { pts: 5 * (i + 1), s: i + 1, ms: elapsed() })
        setRecord(submitBest('survie', i + 1))
        return
      }
      setI((x) => x + 1)
      setValue('')
      setPhase('play')
    }, 2200)
  }

  useEffect(() => {
    if (phase !== 'play') return
    inputRef.current?.focus()
    const t0 = performance.now()
    const id = setInterval(() => {
      const remaining = Math.max(0, TIME - (performance.now() - t0))
      setLeft(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        submitRef.current(true)
      }
    }, 100)
    return () => clearInterval(id)
  }, [phase, i])

  const submitRef = useRef(submit)
  submitRef.current = submit

  const best = bestScore('survie')

  return (
    <MgShell title="Survival Mode" help={<SurvivalHelp />}>
      <section className="dq">
        <div className="sv-bar">
          <span className="sv-q">QUESTION {phase === 'idle' ? 1 : i + 1}</span>
          {phase !== 'idle' && phase !== 'over' && (
            <div className="sv-timer">
              <div style={{ width: `${(left / TIME) * 100}%` }} />
            </div>
          )}
          <span className="sv-life">♥ {life.toLocaleString('fr-FR', { minimumFractionDigits: 1 })}</span>
        </div>

        {phase === 'idle' && (
          <div className="sv-start">
            <p>Appuie sur départ pour lancer ta partie de Survie.</p>
            {best !== null && <p className="dim">Record : {best} question(s)</p>}
            <button className="mg-cta" onClick={start}>
              C’est parti →
            </button>
          </div>
        )}

        {(phase === 'play' || phase === 'feedback') && q && (
          <>
            <div className="dq-kicker">
              <span>{q.cat.toUpperCase()}</span> · 00:{String(Math.ceil(left / 1000)).padStart(2, '0')}
            </div>
            <h2 className="dq-q">{q.q}</h2>
            <NumberInput
              ref={inputRef}
              value={value}
              onChange={setValue}
              onSubmit={() => submit()}
              unit={q.unit}
              disabled={phase === 'feedback'}
            />
            {phase === 'play' ? (
              <button className="mg-cta dq-lock" onClick={() => submit()}>
                Valider →
              </button>
            ) : (
              last && (
                <div className="sv-feedback">
                  <span className="pill">{offLabel(last.guess, q.a)}</span>
                  <b className="loss">−{last.loss.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} vie</b>
                  <span className="dim">Réponse : {formatNumber(q.a)} {q.unit}</span>
                </div>
              )
            )}
          </>
        )}

        {phase === 'over' && (
          <div className="sv-start">
            <h2 className="dq-q">Partie terminée</h2>
            <p>
              Tu as survécu à <b>{i + 1}</b> question{i ? 's' : ''}.
            </p>
            {record && <p className="red">Nouveau record !</p>}
            <button className="mg-cta" onClick={start}>
              Rejouer ↻
            </button>
          </div>
        )}
      </section>
    </MgShell>
  )
}
