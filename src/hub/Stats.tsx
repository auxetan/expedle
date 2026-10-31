import { useEffect, useMemo, useRef, useState } from 'react'
import { quizTitle } from '../games/cartographe/quizzes'
import { calendarWeeks, gameRecords, plays, summarize, type Play } from '../lib/stats'
import { todayKey } from '../lib/util'
import AppBar from '../ui/AppBar'
import CountUp from '../ui/CountUp'
import GameIcon from '../ui/GameIcon'
import { gameIcon as icon, gameInfo as info } from '../ui/gameInfo'
import { loadProfile } from '../ui/Panels'
import { locale, plural, t } from '../lib/i18n'
import './stats.css'

// noms des jours (lundi d'abord) et des mois dans la langue du site ; le 5 janvier 2026 est un lundi
const weekdays = () => Array.from({ length: 7 }, (_, d) => new Date(2026, 0, 5 + d).toLocaleDateString(locale(), { weekday: 'long' }))
const months = () => Array.from({ length: 12 }, (_, m) => new Date(2026, m, 1).toLocaleDateString(locale(), { month: 'short' }))

function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}

function longDate(day: string, withYear = false): string {
  return new Date(day + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'long', year: withYear ? 'numeric' : undefined })
}

function ago(time: number): string {
  const days = Math.round((new Date(todayKey() + 'T12:00:00').getTime() - new Date(todayKey(new Date(time)) + 'T12:00:00').getTime()) / 86400000)
  return days === 0 ? t('aujourd’hui') : days === 1 ? t('hier') : t('il y a {n} jours', { n: days })
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
                {show && i < weeks.length - 2 ? months()[month] : ''}
              </span>
            )
          })}
          {Array.from({ length: 7 }, (_, d) => (
            <div key={d} className="cal-row" style={{ display: 'contents' }}>
              <span className="cal-wd">{d % 2 === 0 ? weekdays()[d][0].toUpperCase() : ''}</span>
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
                    aria-label={`${longDate(day)} : ${plural(cell?.n ?? 0, '{n} partie', '{n} parties')}`}
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
          <b>{plural(byDay.get(tip.day)?.n ?? 0, '{n} partie', '{n} parties')}</b>
          {byDay.get(tip.day) ? ` · ${t('{n} pts', { n: byDay.get(tip.day)!.pts })}` : ''}
          <span>{longDate(tip.day)}</span>
        </div>
      )}
      <div className="cal-legend">
        {t('Moins')}
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`cal-day l${l}`} />
        ))}
        {t('Plus')}
      </div>
    </div>
  )
}

function Bars({ values, labels, highlight }: { values: number[]; labels: string[]; highlight: number }) {
  const max = Math.max(1, ...values)
  return (
    <div className="bars" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
      {values.map((v, i) => (
        <div key={i} className={i === highlight && v > 0 ? 'bar top' : 'bar'} title={plural(v, '{n} partie', '{n} parties')}>
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
        <p className="muted">{t('Aucune partie ce jour-là.')}</p>
      ) : (
        <ul>
          {entries.map((p) => (
            <li key={p.t}>
              <span className="muted">{new Date(p.t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</span>
              <a href={info(p.g).href}>{t(info(p.g).title)}</a>
              <b>{t('{n} pts', { n: p.pts })}</b>
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
    const best = Math.max(...ps.map((p) => p.s ?? 0))
    const perfect = ps.filter((p) => p.s === 100 && p.ms).map((p) => p.ms!)
    return { id, label: quizTitle(id) ?? id, n: ps.length, best, time: perfect.length ? Math.min(...perfect) : null }
  })
  return (
    <section className="stats-card">
      <h2>{t('Seterra : meilleurs temps')}</h2>
      <p className="muted small">{t('Temps retenu seulement pour un sans-faute (100 %).')}</p>
      <ul className="seterra-times">
        {rows
          .sort((a, b) => b.n - a.n)
          .map((r) => (
            <li key={r.id}>
              <a href={`#/cartographe/${r.id}`}>{r.label}</a>
              <span className="muted">{plural(r.n, '{n} partie', '{n} parties')}</span>
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
      <AppBar title={t('Statistiques')} />
      <main className="home-main stats-main">
        <section className="stats-hero">
          <span className="stats-avatar">{profile.avatar}</span>
          <div>
            <h1>{profile.name || t('Tes statistiques')}</h1>
            <p className="muted">{first ? t('Première partie le {date}', { date: longDate(todayKey(new Date(first)), true) }) : t('Aucune partie pour l’instant')}</p>
          </div>
          <a href="#/passeport" className="stats-passport">
            🛂 {t('Mon passeport')} →
          </a>
        </section>

        {list.length === 0 ? (
          <section className="stats-card stats-empty">
            <p>{t('Joue une première partie : tes points, tes records et ton calendrier apparaîtront ici.')}</p>
            <a className="stats-cta" href="#/">
              {t('Choisir un jeu')}
            </a>
          </section>
        ) : (
          <>
            <section className="stats-figures">
              {(
                [
                  [t('Parties'), s.total],
                  [t('Points'), s.points],
                  [t('Jours joués'), s.days],
                  [t('Série en cours'), s.streak, (v: number) => t('{n} j', { n: v })],
                  [t('Meilleure série'), s.bestStreak, (v: number) => t('{n} j', { n: v })],
                  [t('Temps de jeu'), s.ms, duration],
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
                <h2>{t('Ton année de jeu')}</h2>
                <span className="muted small">{t('Clique un jour pour voir tes parties')}</span>
              </div>
              <Calendar byDay={s.byDay} selected={day} onPick={(d) => setDay(d === day ? null : d)} />
              {day && <DayDetail day={day} list={list} />}
            </section>

            <section className="stats-card">
              <h2>{t('Quand tu joues')}</h2>
              <div className="stats-when">
                <div>
                  <h3>{t('Par jour de la semaine')}</h3>
                  <Bars values={s.weekdays} labels={weekdays().map((w) => w.slice(0, 3))} highlight={topWeekday} />
                </div>
                <div>
                  <h3>{t('Par heure')}</h3>
                  <Bars values={s.hours} labels={s.hours.map((_, h) => (h % 6 === 0 ? `${h} h` : ''))} highlight={topHour} />
                </div>
              </div>
              <ul className="stats-facts">
                <li>
                  <span>{t('Jour préféré')}</span>
                  <b>{weekdays()[topWeekday]}</b>
                </li>
                <li>
                  <span>{t('Heure de pointe')}</span>
                  <b>
                    {topHour} h – {topHour + 1} h
                  </b>
                </li>
                {s.bestDay && (
                  <li>
                    <span>{t('Meilleure journée')}</span>
                    <b>
                      {plural(s.bestDay.n, '{n} partie', '{n} parties')}, {longDate(s.bestDay.day)}
                    </b>
                  </li>
                )}
                {s.favorite && (
                  <li>
                    <span>{t('Jeu favori')}</span>
                    <b>{t(info(s.favorite).title)}</b>
                  </li>
                )}
              </ul>
            </section>

            <section className="stats-card">
              <h2>{t('Tes records')}</h2>
              <div className="records">
                {records.map((r, i) => {
                  const g = info(r.g)
                  return (
                    <a key={r.g} href={g.href} className="record" style={{ animationDelay: `${i * 40}ms` }}>
                      <span className="record-glyph">{icon(r.g) && <GameIcon icon={icon(r.g)!} size={32} />}</span>
                      <div className="record-head">
                        <b>{t(g.title)}</b>
                        <span className="muted">
                          {plural(r.n, '{n} partie', '{n} parties')} · {ago(r.last)}
                        </span>
                      </div>
                      <dl>
                        <div>
                          <dt>{t('Record')}</dt>
                          <dd>{r.best === null ? '—' : g.unit(r.best)}</dd>
                        </div>
                        <div>
                          <dt>{g.untimed ? t('Temps total') : t('Meilleur temps')}</dt>
                          <dd>{g.untimed ? duration(r.ms) : r.bestMs ? duration(r.bestMs) : '—'}</dd>
                        </div>
                        <div>
                          <dt>{t('Moyenne')}</dt>
                          <dd>{t('{n} pts', { n: r.avg })}</dd>
                        </div>
                      </dl>
                      <div className="record-bar">
                        <i style={{ width: `${r.avg}%` }} />
                      </div>
                    </a>
                  )
                })}
              </div>
              <p className="muted small">{t('Chaque partie rapporte jusqu’à 100 points selon ta performance.')}</p>
            </section>

            <SeterraTimes list={list} />
          </>
        )}
      </main>
    </div>
  )
}
