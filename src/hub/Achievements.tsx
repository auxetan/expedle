import { useMemo } from 'react'
import { ACHIEVEMENTS, evaluate, levelOf, TIER_XP } from '../lib/achievements'
import { plays } from '../lib/stats'
import AppBar from '../ui/AppBar'
import CountUp from '../ui/CountUp'
import './achievements.css'
import { fmt, msg, t } from '../lib/i18n'

const GROUPS = [...new Set(ACHIEVEMENTS.map((a) => a.group))]
const TIER_LABEL = { bronze: msg('Bronze'), argent: msg('Argent'), or: msg('Or') }

export default function Achievements() {
  const { progress, level } = useMemo(() => {
    const list = plays()
    const progress = evaluate(list)
    return { progress, level: levelOf(list, progress) }
  }, [])
  const unlocked = progress.filter((a) => a.unlocked).length

  return (
    <div className="home">
      <AppBar title={t('Succès')} />
      <main className="home-main ach-main">
        <section className="ach-hero">
          <div className="ach-level" style={{ '--p': level.into / level.need } as React.CSSProperties}>
            <b>{level.level}</b>
            <span>{t('niveau')}</span>
          </div>
          <div className="ach-hero-text">
            <h1>{t(level.title)}</h1>
            <div className="ach-xp">
              <i style={{ width: `${(level.into / level.need) * 100}%` }} />
            </div>
            <p className="muted">
              <CountUp value={level.into} format={(v) => fmt(v)} /> / {t('{need} XP vers le niveau {next} · {xp} XP en tout', { need: fmt(level.need), next: level.level + 1, xp: fmt(level.xp) })}
            </p>
            <p className="muted">
              {t('{done} succès sur {total} · chaque partie rapporte ses points, chaque succès un bonus ({bronze}, {argent} ou {or} XP)', {
                done: unlocked,
                total: progress.length,
                bronze: TIER_XP.bronze,
                argent: TIER_XP.argent,
                or: fmt(TIER_XP.or),
              })}
            </p>
          </div>
        </section>

        {GROUPS.map((group) => {
          const items = progress.filter((a) => a.group === group)
          return (
            <section key={group} className="ach-group">
              <h2>
                {t(group)} <small>{items.filter((a) => a.unlocked).length} / {items.length}</small>
              </h2>
              <div className="ach-grid stagger">
                {items.map((a) => (
                  <article key={a.id} className={`ach-card ${a.tier} ${a.unlocked ? 'unlocked' : 'locked'}`}>
                    <span className="ach-badge">{a.glyph}</span>
                    <div>
                      <b>{t(a.title)}</b>
                      <p>{t(a.desc)}</p>
                      {a.unlocked ? (
                        <span className="ach-tier">
                          {t(TIER_LABEL[a.tier])} · +{fmt(TIER_XP[a.tier])} XP
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
