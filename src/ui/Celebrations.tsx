import { useEffect, useState } from 'react'
import { evaluate, levelOf, loadSeen, saveSeen, TIER_XP, type Tier } from '../lib/achievements'
import { HISTORY_CHANGED } from '../lib/cloud'
import { plural, t } from '../lib/i18n'
import { countryName, flagEmoji } from '../geo/countries'
import { coverage, passport, STAMPED } from '../lib/passport'
import { plays, PLAYED } from '../lib/stats'
import { feedback } from '../lib/feedback'

interface Toast {
  id: number
  glyph: string
  title: string
  desc: string
  tier?: Tier
  href?: string
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
          push({ glyph: '🏅', title: plural(unlocked.length, '{n} succès débloqué', '{n} succès débloqués'), desc: t('Grâce à tes parties passées · niveau {n}', { n: level.level }) }, 400)
        return
      }
      const fresh = unlocked.filter((a) => !seen.ids.includes(a.id))
      fresh.forEach((a, i) => push({ glyph: a.glyph, title: t(a.title), desc: t('Succès débloqué · +{xp} XP', { xp: TIER_XP[a.tier] }), tier: a.tier }, i * 700))
      if (level.level > seen.level) push({ glyph: '⬆️', title: t('Niveau {n}', { n: level.level }), desc: t(level.title) }, fresh.length * 700)
    }

    let timer = 0
    const onPlay = () => {
      clearTimeout(timer)
      timer = window.setTimeout(check, 900)
    }
    // un nouveau pays au passeport : un tampon s'annonce, avec le compte du monde
    const onStamp = (e: Event) => {
      const fresh = (e as CustomEvent<string[]>).detail
      setTimeout(() => feedback('stamp'), 300)
      const { stamped, total } = coverage(passport())
      fresh.slice(0, 3).forEach((code, i) =>
        push({ glyph: flagEmoji(code), title: t('Nouveau tampon : {name}', { name: countryName(code) }), desc: t('Passeport : {n} / {total} pays', { n: stamped, total }), href: '#/passeport' }, 300 + i * 600),
      )
    }
    check()
    window.addEventListener(PLAYED, onPlay)
    window.addEventListener(HISTORY_CHANGED, onPlay)
    window.addEventListener(STAMPED, onStamp)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(PLAYED, onPlay)
      window.removeEventListener(HISTORY_CHANGED, onPlay)
      window.removeEventListener(STAMPED, onStamp)
    }
  }, [])

  if (!toasts.length) return null
  return (
    <div className="ach-toasts" aria-live="polite">
      {toasts.map((t) => (
        <a key={t.id} href={t.href ?? '#/succes'} className={`ach-toast ${t.tier ?? ''}`}>
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
