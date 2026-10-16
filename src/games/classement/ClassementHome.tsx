import { useEffect, useMemo, useState } from 'react'
import { bestScore, dailyResult } from '../../lib/stats'
import { todayKey, weekKey } from '../../lib/util'
import GhBar from './GhBar'
import { dailyObjective, weeklyTheme } from './setup'
import './classement.css'

function untilMidnight(): string {
  const now = new Date()
  const end = new Date(now)
  end.setHours(24, 0, 0, 0)
  const m = Math.floor((end.getTime() - now.getTime()) / 60000)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type Tile = 'classique' | 'monde' | 'special' | 'villes'

const TILES: { id: Tile; icon: string; name: string; text: string }[] = [
  { id: 'classique', icon: '◎', name: 'Classique', text: 'Joue pour gagner ton premier rang et te classer' },
  { id: 'monde', icon: '🌐', name: 'Monde', text: 'Corruption, pollution, gastronomie, basket…' },
  { id: 'special', icon: '⚡', name: 'Spécial', text: 'Militaire, passeport, biodiversité, rugby…' },
  { id: 'villes', icon: '🏙', name: 'Villes', text: '8 villes du monde, 8 catégories' },
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
    return DAYS.map((label, i) => {
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
        <p>Place chaque pays là où il est le mieux classé.</p>
      </header>

      <section className="ghh-panel">
        <h2>DÉFIS</h2>
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
              <b>Défi du Jour</b>
              <span className="ghh-ch-play">▶</span>
            </div>
            <div className="ghh-ch-bottom">
              <span>{dailyDone ? `Fait : ${dailyDone.total}` : `Encore ${left}`}</span>
              <span>OBJECTIF : {objective}</span>
            </div>
          </a>
          <a href="#/classement/hebdo" className="ghh-ch weekly">
            <div className="ghh-ch-top">
              <span className="ghh-ch-icon">{theme.icon}</span>
              <div>
                <b>Hebdo</b>
                <small>{theme.name}</small>
              </div>
              <span className="ghh-ch-play">▶</span>
            </div>
            <div className="ghh-ch-bottom">
              <span>{weekDone ? `Fait : ${weekDone.total}` : `Semaine ${weekKey().split('-S')[1]}`}</span>
            </div>
          </a>
        </div>
      </section>

      <section className="ghh-panel">
        <div className="ghh-row">
          <h2>JEUX ORIGINAUX</h2>
          <div className="ghh-toggle">
            <button className={!easy ? 'on' : ''} onClick={() => setEasy(false)}>
              🌐 Normal
            </button>
            <button className={easy ? 'on' : ''} onClick={() => setEasy(true)}>
              🌱 Facile
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
        <div className="ghh-launch">
          <span className="ghh-launch-icon">{current.icon}</span>
          <div>
            <b>
              {current.name}
              {easyOn ? ' · facile' : ''}
            </b>
            <small>{easyOn ? '80 pays connus · idéal pour débuter' : current.text}</small>
          </div>
          <span className="ghh-best">{best !== null ? `◷ ${best}` : ''}</span>
          <a href={href} className="ghh-go">
            JOUER ▶
          </a>
        </div>
      </section>

      <section className="ghh-panel ghh-how">
        <h2>COMMENT JOUER</h2>
        <p>
          <b>Obtiens le score total le plus bas.</b> Associe 8 pays aux catégories où ils sont le mieux classés. Un n°1 ajoute
          seulement 1 point ; sans donnée, le rang compte pour 100. Chaque catégorie ne sert qu’une fois.
        </p>
      </section>
    </div>
  )
}
