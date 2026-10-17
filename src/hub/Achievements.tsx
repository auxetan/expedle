import { useMemo } from 'react'
import { ACHIEVEMENTS, evaluate, levelOf, TIER_XP } from '../lib/achievements'
import { plays } from '../lib/stats'
import AppBar from '../ui/AppBar'
import CountUp from '../ui/CountUp'
import './achievements.css'

const GROUPS = [...new Set(ACHIEVEMENTS.map((a) => a.group))]
const TIER_LABEL = { bronze: 'Bronze', argent: 'Argent', or: 'Or' }
const fmt = (n: number) => n.toLocaleString('fr-FR')

export default function Achievements() {
  const { progress, level } = useMemo(() => {
    const list = plays()
    const progress = evaluate(list)
    return { progress, level: levelOf(list, progress) }
  }, [])
  const unlocked = progress.filter((a) => a.unlocked).length

  return (
    <div className="home">
      <AppBar title="Succès" />
      <main className="home-main ach-main">
        <section className="ach-hero">
          <div className="ach-level" style={{ '--p': level.into / level.need } as React.CSSProperties}>
            <b>{level.level}</b>
            <span>niveau</span>
          </div>
          <div className="ach-hero-text">
            <h1>{level.title}</h1>
            <div className="ach-xp">
              <i style={{ width: `${(level.into / level.need) * 100}%` }} />
            </div>
            <p className="muted">
              <CountUp value={level.into} format={fmt} /> / {fmt(level.need)} XP vers le niveau {level.level + 1} · {fmt(level.xp)} XP en tout
            </p>
            <p className="muted">
              {unlocked} succès sur {progress.length} · chaque partie rapporte ses points, chaque succès un bonus ({TIER_XP.bronze}, {TIER_XP.argent} ou {fmt(TIER_XP.or)} XP)
            </p>
          </div>
        </section>

        {GROUPS.map((group) => {
          const items = progress.filter((a) => a.group === group)
          return (
            <section key={group} className="ach-group">
              <h2>
                {group} <small>{items.filter((a) => a.unlocked).length} / {items.length}</small>
              </h2>
              <div className="ach-grid stagger">
                {items.map((a) => (
                  <article key={a.id} className={`ach-card ${a.tier} ${a.unlocked ? 'unlocked' : 'locked'}`}>
                    <span className="ach-badge">{a.glyph}</span>
                    <div>
                      <b>{a.title}</b>
                      <p>{a.desc}</p>
                      {a.unlocked ? (
                        <span className="ach-tier">
                          {TIER_LABEL[a.tier]} · +{fmt(TIER_XP[a.tier])} XP
                        </span>
                      ) : (
                        a.goal > 1 && (
                          <span className="ach-progress">
                            <i style={{ width: `${(a.current / a.goal) * 100}%` }} />
                            <small>
                              {fmt(a.current)} / {fmt(a.goal)}
                            </small>
                          </span>
                        )
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
