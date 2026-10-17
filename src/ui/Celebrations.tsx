import { useEffect, useState } from 'react'
import { evaluate, levelOf, loadSeen, saveSeen, TIER_XP, type Tier } from '../lib/achievements'
import { HISTORY_CHANGED } from '../lib/cloud'
import { plays, PLAYED } from '../lib/stats'

interface Toast {
  id: number
  glyph: string
  title: string
  desc: string
  tier?: Tier
}

let next = 0

// Annonce les succès débloqués et les passages de niveau, un peu après la fin de la partie
// pour laisser le résultat du jeu s'afficher d'abord.
export default function Celebrations() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    function push(t: Omit<Toast, 'id'>, delay: number) {
      const id = next++
      setTimeout(() => setToasts((list) => [...list, { ...t, id }]), delay)
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), delay + 5000)
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
          push({ glyph: '🏅', title: `${unlocked.length} succès débloqué${unlocked.length > 1 ? 's' : ''}`, desc: `Grâce à tes parties passées · niveau ${level.level}` }, 400)
        return
      }
      const fresh = unlocked.filter((a) => !seen.ids.includes(a.id))
      fresh.forEach((a, i) => push({ glyph: a.glyph, title: a.title, desc: `Succès débloqué · +${TIER_XP[a.tier]} XP`, tier: a.tier }, i * 700))
      if (level.level > seen.level) push({ glyph: '⬆️', title: `Niveau ${level.level}`, desc: level.title }, fresh.length * 700)
    }

    let timer = 0
    const onPlay = () => {
      clearTimeout(timer)
      timer = window.setTimeout(check, 900)
    }
    check()
    window.addEventListener(PLAYED, onPlay)
    window.addEventListener(HISTORY_CHANGED, onPlay)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(PLAYED, onPlay)
      window.removeEventListener(HISTORY_CHANGED, onPlay)
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
