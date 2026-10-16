import { useEffect, useMemo, useRef, useState } from 'react'
import { parseQuizId, ASK_LABEL } from '../games/cartographe/quizzes'
import { calendarWeeks, gameRecords, plays, summarize, type Play } from '../lib/stats'
import { todayKey } from '../lib/util'
import AppBar from '../ui/AppBar'
import CountUp from '../ui/CountUp'
import { ALL_GAMES } from '../ui/games'
import { loadProfile } from '../ui/Panels'
import './stats.css'

interface GameInfo {
  title: string
  href: string
  unit: (s: number) => string
  lower?: boolean
  // le chrono n'a pas de sens quand tenir longtemps est le but
  untimed?: boolean
}

const pts = (s: number) => `${s.toLocaleString('fr-FR')} pts`
const essais = (s: number) => `${s} essai${s > 1 ? 's' : ''}`
const rang = (s: number) => `total ${s}`

const GAMES: Record<string, GameInfo> = {
  itineraire: { title: 'Travle', href: '#/itineraire', unit: essais, lower: true },
  'itineraire-hebdo': { title: 'Travle : défi hebdo', href: '#/itineraire/hebdo', unit: essais, lower: true },
  'itineraire-usa': { title: 'Travle USA', href: '#/itineraire/usa', unit: essais, lower: true },
  'itineraire-libre': { title: 'Travle : entraînement', href: '#/itineraire/libre', unit: essais, lower: true },
  'classement-classique': { title: 'GeoHunter', href: '#/classement/classique', unit: rang, lower: true },
  'classement-facile': { title: 'GeoHunter facile', href: '#/classement/facile', unit: rang, lower: true },
  'classement-monde': { title: 'GeoHunter Monde', href: '#/classement/monde', unit: rang, lower: true },
  'classement-special': { title: 'GeoHunter Spécial', href: '#/classement/special', unit: rang, lower: true },
  'classement-villes': { title: 'GeoHunter Villes', href: '#/classement/villes', unit: rang, lower: true },
  'classement-jour': { title: 'GeoHunter : défi du jour', href: '#/classement/jour', unit: rang, lower: true },
  'classement-hebdo': { title: 'GeoHunter hebdo', href: '#/classement/hebdo', unit: rang, lower: true },
  cartographe: { title: 'Seterra', href: '#/cartographe', unit: (s) => `${s} %` },
  'echelle-objets': { title: 'Size It Up', href: '#/echelle', unit: pts },
  'echelle-pop': { title: 'Size It Up : Pop Culture', href: '#/echelle/pop', unit: pts },
  'echelle-geo': { title: 'Size It Up : Géographie', href: '#/echelle/geo', unit: pts },
  'echelle-1000': { title: 'The Weekly 1K', href: '#/echelle/1000', unit: pts },
  balance: { title: 'Weigh It Up', href: '#/balance', unit: pts },
  question: { title: 'Daily Question', href: '#/question', unit: (s) => `${s} / 100`, untimed: true },
  survie: { title: 'Survival Mode', href: '#/survie', unit: (s) => `${s} question${s > 1 ? 's' : ''}`, untimed: true },
  'quiz-jour': { title: 'Quiz du jour', href: '#/quiz/jour', unit: pts },
  'quiz-culture': { title: 'Quiz culture G', href: '#/quiz', unit: pts },
  'quiz-drapeaux': { title: 'Drapeaux', href: '#/quiz/drapeaux', unit: pts },
  'quiz-capitales': { title: 'Capitales', href: '#/quiz/capitales', unit: pts },
}

const info = (g: string): GameInfo => GAMES[g] ?? { title: g, href: '#/', unit: pts }
function glyph(g: string): string {
  const href = info(g).href
  const exact = ALL_GAMES.find((x) => x.dailyId === g || x.href === href)
  const parent = ALL_GAMES.filter((x) => href.startsWith(x.href)).sort((a, b) => b.href.length - a.href.length)[0]
  return (exact ?? parent)?.glyph ?? '•'
}

const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}

function longDate(day: string, withYear = false): string {
  return new Date(day + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: withYear ? 'numeric' : undefined })
}

function ago(t: number): string {
  const days = Math.round((new Date(todayKey() + 'T12:00:00').getTime() - new Date(todayKey(new Date(t)) + 'T12:00:00').getTime()) / 86400000)
  return days === 0 ? 'aujourd’hui' : days === 1 ? 'hier' : `il y a ${days} jours`
}

function Calendar({ byDay, selected, onPick }: { byDay: Map<string, { n: number; pts: number }>; selected: string | null; onPick: (d: string) => void }) {
  const weeks = useMemo(() => calendarWeeks(), [])
  const max = Math.max(1, ...[...byDay.values()].map((v) => v.n))
  const scroller = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ day: string; x: number; y: number } | null>(null)

  useEffect(() => {
    const el = scroller.current!
    el.scrollLeft = el.scrollWidth
  }, [])

  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((4 * n) / max)))
  const today = todayKey()

  return (
    <div className="cal-wrap">
      <div className="cal-scroll" ref={scroller}>
        <div className="cal" style={{ gridTemplateColumns: `22px repeat(${weeks.length}, var(--cell))` }}>
          <span className="cal-corner" />
          {weeks.map((w, i) => {
            const first = w[0]!
            const prev = weeks[i - 1]?.[0]
            const month = Number(first.slice(5, 7)) - 1
            const show = !prev || Number(prev.slice(5, 7)) - 1 !== month
            return (
              <span key={first} className="cal-month">
                {show && i < weeks.length - 2 ? MONTHS[month] : ''}
              </span>
            )
          })}
          {Array.from({ length: 7 }, (_, d) => (
            <div key={d} className="cal-row" style={{ display: 'contents' }}>
              <span className="cal-wd">{d % 2 === 0 ? WEEKDAYS[d][0].toUpperCase() : ''}</span>
              {weeks.map((w, i) => {
                const day = w[d]
                if (!day) return <span key={i} />
                const cell = byDay.get(day)
                const cls = `cal-day l${level(cell?.n ?? 0)}${day === selected ? ' on' : ''}${day === today ? ' today' : ''}`
                return (
                  <button
                    key={day}
                    className={cls}
                    style={{ animationDelay: `${i * 9}ms` }}
                    aria-label={`${longDate(day)} : ${cell?.n ?? 0} partie${(cell?.n ?? 0) > 1 ? 's' : ''}`}
                    onClick={() => onPick(day)}
                    onMouseEnter={(e) => {
                      const r = e.currentTarget
                      setTip({ day, x: r.offsetLeft + r.offsetWidth / 2 - scroller.current!.scrollLeft, y: r.offsetTop })
                    }}
                    onMouseLeave={() => setTip(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {tip && (
        <div className="cal-tip" style={{ left: tip.x, top: tip.y }}>
          <b>
            {byDay.get(tip.day)?.n ?? 0} partie{(byDay.get(tip.day)?.n ?? 0) > 1 ? 's' : ''}
          </b>
          {byDay.get(tip.day) ? ` · ${byDay.get(tip.day)!.pts} pts` : ''}
          <span>{longDate(tip.day)}</span>
        </div>
      )}
      <div className="cal-legend">
        Moins
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`cal-day l${l}`} />
        ))}
        Plus
      </div>
    </div>
  )
}

function Bars({ values, labels, highlight }: { values: number[]; labels: string[]; highlight: number }) {
  const max = Math.max(1, ...values)
  return (
    <div className="bars" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
      {values.map((v, i) => (
        <div key={i} className={i === highlight && v > 0 ? 'bar top' : 'bar'} title={`${v} partie${v > 1 ? 's' : ''}`}>
          <i style={{ height: `${(v / max) * 100}%`, animationDelay: `${i * 25}ms` }} />
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

function DayDetail({ day, list }: { day: string; list: Play[] }) {
  const entries = list.filter((p) => todayKey(new Date(p.t)) === day).sort((a, b) => a.t - b.t)
  return (
    <div className="day-detail">
      <h3>{longDate(day, true)}</h3>
      {entries.length === 0 ? (
        <p className="muted">Aucune partie ce jour-là.</p>
      ) : (
        <ul>
          {entries.map((p) => (
            <li key={p.t}>
              <span className="muted">{new Date(p.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              <a href={info(p.g).href}>{info(p.g).title}</a>
              <b>{p.pts} pts</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SeterraTimes({ list }: { list: Play[] }) {
  const byQuiz = new Map<string, Play[]>()
  for (const p of list) if (p.g === 'cartographe' && p.sub) byQuiz.set(p.sub, [...(byQuiz.get(p.sub) ?? []), p])
  if (!byQuiz.size) return null
  const rows = [...byQuiz].map(([id, ps]) => {
    const q = parseQuizId(id)
    const best = Math.max(...ps.map((p) => p.s ?? 0))
    const perfect = ps.filter((p) => p.s === 100 && p.ms).map((p) => p.ms!)
    return { id, label: q ? `${q.region.name} · ${ASK_LABEL[q.ask]}` : id, n: ps.length, best, time: perfect.length ? Math.min(...perfect) : null }
  })
  return (
    <section className="stats-card">
      <h2>Seterra : meilleurs temps</h2>
      <p className="muted small">Temps retenu seulement pour un sans-faute (100 %).</p>
      <ul className="seterra-times">
        {rows
          .sort((a, b) => b.n - a.n)
          .map((r) => (
            <li key={r.id}>
              <a href={`#/cartographe/${r.id}`}>{r.label}</a>
              <span className="muted">
                {r.n} partie{r.n > 1 ? 's' : ''}
              </span>
              <span>{r.best} %</span>
              <b>{r.time ? duration(r.time) : '—'}</b>
            </li>
          ))}
      </ul>
    </section>
  )
}

export default function Stats() {
  const list = useMemo(() => plays(), [])
  const s = useMemo(() => summarize(list), [list])
  const records = useMemo(
    () => gameRecords(list, (g) => !!info(g).lower).sort((a, b) => b.n - a.n),
    [list],
  )
  const [day, setDay] = useState<string | null>(null)
  const profile = loadProfile()
  const first = list.length ? Math.min(...list.map((p) => p.t)) : null
  const topWeekday = s.weekdays.indexOf(Math.max(...s.weekdays))
  const topHour = s.hours.indexOf(Math.max(...s.hours))

  return (
    <div className="home">
      <AppBar title="Statistiques" />
      <main className="home-main stats-main">
        <section className="stats-hero">
          <span className="stats-avatar">{profile.avatar}</span>
          <div>
            <h1>{profile.name || 'Tes statistiques'}</h1>
            <p className="muted">{first ? `Première partie le ${longDate(todayKey(new Date(first)), true)}` : 'Aucune partie pour l’instant'}</p>
          </div>
        </section>

        {list.length === 0 ? (
          <section className="stats-card stats-empty">
            <p>Joue une première partie : tes points, tes records et ton calendrier apparaîtront ici.</p>
            <a className="stats-cta" href="#/">
              Choisir un jeu
            </a>
          </section>
        ) : (
          <>
            <section className="stats-figures">
              {(
                [
                  ['Parties', s.total],
                  ['Points', s.points],
                  ['Jours joués', s.days],
                  ['Série en cours', s.streak, (v: number) => `${v} j`],
                  ['Meilleure série', s.bestStreak, (v: number) => `${v} j`],
                  ['Temps de jeu', s.ms, duration],
                ] as [string, number, ((v: number) => string)?][]
              ).map(([label, value, format], i) => (
                <div key={label} style={{ animationDelay: `${i * 50}ms` }}>
                  <b>
                    <CountUp value={value} format={format} />
                  </b>
                  <span>{label}</span>
                </div>
              ))}
            </section>

            <section className="stats-card">
              <div className="stats-card-head">
                <h2>Ton année de jeu</h2>
                <span className="muted small">Clique un jour pour voir tes parties</span>
              </div>
              <Calendar byDay={s.byDay} selected={day} onPick={(d) => setDay(d === day ? null : d)} />
              {day && <DayDetail day={day} list={list} />}
            </section>

            <section className="stats-card">
              <h2>Quand tu joues</h2>
              <div className="stats-when">
                <div>
                  <h3>Par jour de la semaine</h3>
                  <Bars values={s.weekdays} labels={WEEKDAYS.map((w) => w.slice(0, 3))} highlight={topWeekday} />
                </div>
                <div>
                  <h3>Par heure</h3>
                  <Bars values={s.hours} labels={s.hours.map((_, h) => (h % 6 === 0 ? `${h} h` : ''))} highlight={topHour} />
                </div>
              </div>
              <ul className="stats-facts">
                <li>
                  <span>Jour préféré</span>
                  <b>{WEEKDAYS[topWeekday]}</b>
                </li>
                <li>
                  <span>Heure de pointe</span>
                  <b>
                    {topHour} h – {topHour + 1} h
                  </b>
                </li>
                {s.bestDay && (
                  <li>
                    <span>Meilleure journée</span>
                    <b>
                      {s.bestDay.n} parties, {longDate(s.bestDay.day)}
                    </b>
                  </li>
                )}
                {s.favorite && (
                  <li>
                    <span>Jeu favori</span>
                    <b>{info(s.favorite).title}</b>
                  </li>
                )}
              </ul>
            </section>

            <section className="stats-card">
              <h2>Tes records</h2>
              <div className="records">
                {records.map((r, i) => {
                  const g = info(r.g)
                  return (
                    <a key={r.g} href={g.href} className="record" style={{ animationDelay: `${i * 40}ms` }}>
                      <span className="record-glyph">{glyph(r.g)}</span>
                      <div className="record-head">
                        <b>{g.title}</b>
                        <span className="muted">
                          {r.n} partie{r.n > 1 ? 's' : ''} · {ago(r.last)}
                        </span>
                      </div>
                      <dl>
                        <div>
                          <dt>Record</dt>
                          <dd>{r.best === null ? '—' : g.unit(r.best)}</dd>
                        </div>
                        <div>
                          <dt>{g.untimed ? 'Temps total' : 'Meilleur temps'}</dt>
                          <dd>{g.untimed ? duration(r.ms) : r.bestMs ? duration(r.bestMs) : '—'}</dd>
                        </div>
                        <div>
                          <dt>Moyenne</dt>
                          <dd>{r.avg} pts</dd>
                        </div>
                      </dl>
                      <div className="record-bar">
                        <i style={{ width: `${r.avg}%` }} />
                      </div>
                    </a>
                  )
                })}
              </div>
              <p className="muted small">Chaque partie rapporte jusqu’à 100 points selon ta performance.</p>
            </section>

            <SeterraTimes list={list} />
          </>
        )}
      </main>
    </div>
  )
}
