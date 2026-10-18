import { useEffect, useMemo, useState } from 'react'
import { bestScore, dailyResult } from '../../lib/stats'
import { todayKey, weekKey } from '../../lib/util'
import GhBar from './GhBar'
import { dailyObjective, weeklyTheme } from './setup'
import './classement.css'
import { locale, msg, t, tx } from '../../lib/i18n'

function untilMidnight(): string {
  const now = new Date()
  const end = new Date(now)
  end.setHours(24, 0, 0, 0)
  const m = Math.floor((end.getTime() - now.getTime()) / 60000)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// initiales des jours, lundi d'abord, dans la langue du site ; le 5 janvier 2026 est un lundi
const days = () => Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(locale(), { weekday: 'narrow' }))

type Tile = 'classique' | 'monde' | 'special' | 'villes'

const TILES: { id: Tile; icon: string; name: string; text: string }[] = [
  { id: 'classique', icon: '◎', name: msg('Classique'), text: msg('Joue pour gagner ton premier rang et te classer') },
  { id: 'monde', icon: '🌐', name: msg('Monde'), text: msg('Corruption, pollution, gastronomie, basket…') },
  { id: 'special', icon: '⚡', name: msg('Spécial'), text: msg('Militaire, passeport, biodiversité, rugby…') },
  { id: 'villes', icon: '🏙', name: msg('Villes'), text: msg('8 villes du monde, 8 catégories') },
]

export default function ClassementHome() {
  const [easy, setEasy] = useState(false)
  const [tile, setTile] = useState<Tile>('classique')
  const [left, setLeft] = useState(untilMidnight)
  useEffect(() => {
    const id = setInterval(() => setLeft(untilMidnight()), 30000)
    return () => clearInterval(id)
  }, [])
  const objective = useMemo(dailyObjective, [])
  const theme = weeklyTheme()
  const dailyDone = dailyResult<{ total: number }>('classement-jour')
  const weekDone = dailyResult<{ total: number }>('classement-hebdo', weekKey())

  const week = useMemo(() => {
    const d = new Date()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return days().map((label, i) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      const key = todayKey(day)
      return { label, key, today: key === todayKey(), done: dailyResult('classement-jour', key) !== null }
    })
  }, [])
  const streak = week.filter((d) => d.done).length

  const current = TILES.find((t) => t.id === tile)!
  const easyOn = easy && tile !== 'villes'
  const href = tile === 'classique' ? `#/classement/${easyOn ? 'facile' : 'classique'}` : `#/classement/${tile}${easyOn ? '?facile=1' : ''}`
  const bestKey = (t: Tile) => (t === 'classique' ? (easy ? 'classement-facile' : 'classement-classique') : `classement-${t}${easy && t !== 'villes' ? '-facile' : ''}`)
  const best = bestScore(bestKey(tile))

  return (
    <div className="ghh">
      <GhBar />
      <header className="ghh-head">
        <h1>GeoHunter</h1>
        <p>{t('Place chaque pays là où il est le mieux classé.')}</p>
      </header>

      <section className="ghh-panel">
        <h2>{t('DÉFIS')}</h2>
        <div className="ghh-week">
          <span className="ghh-streak">🔥 {streak}</span>
          {week.map((d) => (
            <span key={d.key} className={['ghh-day', d.today ? 'today' : '', d.done ? 'done' : ''].join(' ')}>
              {d.done ? '✓' : d.label}
            </span>
          ))}
        </div>
        <div className="ghh-challenges">
          <a href="#/classement/jour" className="ghh-ch daily">
            <div className="ghh-ch-top">
              <span className="ghh-ch-icon">🕐</span>
              <b>{t('Défi du jour')}</b>
              <span className="ghh-ch-play">▶</span>
            </div>
            <div className="ghh-ch-bottom">
              <span>{dailyDone ? t('Fait : {n}', { n: dailyDone.total }) : t('Encore {time}', { time: left })}</span>
              <span>{t('OBJECTIF : {n}', { n: objective })}</span>
            </div>
          </a>
          <a href="#/classement/hebdo" className="ghh-ch weekly">
            <div className="ghh-ch-top">
              <span className="ghh-ch-icon">{theme.icon}</span>
              <div>
                <b>{t('Hebdo')}</b>
                <small>{t(theme.name)}</small>
              </div>
              <span className="ghh-ch-play">▶</span>
            </div>
            <div className="ghh-ch-bottom">
              <span>{weekDone ? t('Fait : {n}', { n: weekDone.total }) : t('Semaine {n}', { n: weekKey().split('-S')[1] })}</span>
            </div>
          </a>
        </div>
      </section>

      <section className="ghh-panel">
        <div className="ghh-row">
          <h2>{t('JEUX ORIGINAUX')}</h2>
          <div className="ghh-toggle">
            <button className={!easy ? 'on' : ''} onClick={() => setEasy(false)}>
              🌐 {t('Normal')}
            </button>
            <button className={easy ? 'on' : ''} onClick={() => setEasy(true)}>
              🌱 {t('Facile')}
            </button>
          </div>
        </div>
        <div className="ghh-tiles">
          {TILES.map((t) => (
            <button key={t.id} className={tile === t.id ? 'on' : ''} onClick={() => setTile(t.id)}>
              <span>{t.icon}</span>
              <small>{bestScore(bestKey(t.id)) ?? '—'}</small>
            </button>
          ))}
        </div>
        <div className="ghh-launch" key={href}>
          <span className="ghh-launch-icon">{current.icon}</span>
          <div>
            <b>
              {t(current.name)}
              {easyOn ? ` · ${t('facile')}` : ''}
            </b>
            <small>{easyOn ? t('80 pays connus · idéal pour débuter') : t(current.text)}</small>
          </div>
          <span className="ghh-best">{best !== null ? `◷ ${best}` : ''}</span>
          <a href={href} className="ghh-go">
            {t('JOUER')} ▶
          </a>
        </div>
      </section>

      <section className="ghh-panel ghh-how">
        <h2>{t('COMMENT JOUER')}</h2>
        <p>
          {tx('{goal} Associe 8 pays aux catégories où ils sont le mieux classés. Un n°1 ajoute seulement 1 point ; sans donnée, le rang compte pour 100. Chaque catégorie ne sert qu’une fois.', {
            goal: <b>{t('Obtiens le score total le plus bas.')}</b>,
          })}
        </p>
      </section>
    </div>
  )
}
