import { useEffect, useState } from 'react'
import { evaluate, levelOf, loadSeen, saveSeen, TIER_XP, type Tier } from '../lib/achievements'
import { HISTORY_CHANGED } from '../lib/cloud'
import { plural, t } from '../lib/i18n'
import { feedback } from '../lib/feedback'
import { plays, PLAYED, type Play } from '../lib/stats'

interface Toast {
  id: number
  glyph: string
  title: string
  desc: string
  tier?: Tier
}

let next = 0

// Annonce les succès débloqués et les passages de niveau, un peu après la fin de la partie
// pour laisser le résultat du jeu s'afficher d'abord. Un seul message à la fois, quoi qu'il arrive.
const great = (p: Play) => (p.win === true && p.pts >= 60) || (p.win === undefined && p.pts >= 85)

export default function Celebrations() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    function push(t: Omit<Toast, 'id'>, delay: number) {
      const id = next++
      setTimeout(() => setToasts([{ ...t, id }]), delay)
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), delay + 4000)
    }

    function check() {
      const list = plays()
      const progress = evaluate(list)
      const unlocked = progress.filter((a) => a.unlocked)
      const level = levelOf(list, progress)
      const seen = loadSeen()
      saveSeen({ ids: unlocked.map((a) => a.id), level: level.level })
      // première visite depuis l'arrivée des succès : un seul message pour les parties passées
      if (!seen) {
        if (unlocked.length)
          push({ glyph: '🏅', title: plural(unlocked.length, '{n} succès débloqué', '{n} succès débloqués'), desc: t('Grâce à tes parties passées · niveau {n}', { n: level.level }) }, 400)
        return
      }
      const fresh = unlocked.filter((a) => !seen.ids.includes(a.id))
      const up = level.level > seen.level
      if (fresh.length === 1)
        push({ glyph: fresh[0].glyph, title: t(fresh[0].title), desc: up ? t('Succès débloqué · niveau {n}', { n: level.level }) : t('Succès débloqué · +{xp} XP', { xp: TIER_XP[fresh[0].tier] }), tier: fresh[0].tier }, 0)
      else if (fresh.length > 1) push({ glyph: '🏅', title: plural(fresh.length, '{n} succès débloqué', '{n} succès débloqués'), desc: up ? t('Niveau {n}', { n: level.level }) : t('Voir mes succès') }, 0)
      else if (up) push({ glyph: '⬆️', title: t('Niveau {n}', { n: level.level }), desc: t(level.title) }, 0)
    }

    let timer = 0
    const onSync = () => {
      clearTimeout(timer)
      timer = window.setTimeout(check, 900)
    }
    // la fin de partie se signale d'un son ; le message, s'il y en a un, vient ensuite
    const onPlay = (e: Event) => {
      const play = (e as CustomEvent<Play>).detail
      feedback(great(play) ? 'win' : play.win === false || play.pts < 30 ? 'lose' : 'good')
      onSync()
    }
    check()
    window.addEventListener(PLAYED, onPlay)
    window.addEventListener(HISTORY_CHANGED, onSync)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(PLAYED, onPlay)
      window.removeEventListener(HISTORY_CHANGED, onSync)
    }
  }, [])

  if (!toasts.length) return null
  return (
    <div className="ach-toasts" aria-live="polite">
      {toasts.map((t) => (
        <a key={t.id} href="#/succes" className={`ach-toast ${t.tier ?? ''}`}>
          <span className="ach-badge small">{t.glyph}</span>
          <span>
            <b>{t.title}</b>
            <small>{t.desc}</small>
          </span>
        </a>
      ))}
    </div>
  )
}
