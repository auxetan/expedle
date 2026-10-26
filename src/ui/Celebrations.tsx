import { useCallback, useEffect, useRef, useState } from 'react'
import { evaluate, levelOf, loadSeen, saveSeen, TIER_XP, type Tier } from '../lib/achievements'
import { HISTORY_CHANGED } from '../lib/cloud'
import { plural, t } from '../lib/i18n'
import { feedback } from '../lib/feedback'
import { plays, PLAYED, streakStep, victoryOf, type Play } from '../lib/stats'
import { gainsOf } from '../lib/wallet'
import { setFlying } from './Pepites'
import Victory, { type Win } from './Victory'

interface Toast {
  id: number
  glyph: string
  title: string
  desc: string
  tier?: Tier
}

let next = 0

type Moment = { kind: 'victoire'; win: Win } | { kind: 'serie'; from: number; to: number }

function Flame() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path d="M12 2.5c.8 3 4.5 5.3 4.5 10a4.5 4.5 0 0 1-9 0c0-2.2 1-3.8 2.3-4.8.1 1.5.8 2.5 1.8 2.9-.3-3.2.1-5.8.4-8.1z" fill="var(--orange)" />
      <path d="M12 13.2c1 .9 1.8 2 1.8 3.3a1.8 1.8 0 0 1-3.6 0c0-1.2.8-2.3 1.8-3.3z" fill="var(--or)" />
    </svg>
  )
}

// La série qui grandit avec la première partie du jour : le chiffre roule d'un cran, la flamme se ravive.
function StreakToast({ from, to, onDone }: { from: number; to: number; onDone: () => void }) {
  const [out, setOut] = useState(false)
  useEffect(() => {
    const ids = [window.setTimeout(() => feedback('good', 5), 900), window.setTimeout(() => setOut(true), 3000), window.setTimeout(onDone, 3300)]
    return () => ids.forEach(clearTimeout)
  }, [onDone])
  return (
    <div className="ach-toasts" aria-live="polite">
      <a href="#/stats" className={out ? 'ach-toast streak out' : 'ach-toast streak'}>
        <span className="ach-badge small">
          <Flame />
        </span>
        <span>
          <b>
            <span className="streak-roll" aria-hidden>
              <span className="streak-reel">
                <span>{from}</span>
                <span>{to}</span>
              </span>
            </span>{' '}
            <span className="streak-sr">{to} </span>
            {plural(to, 'jour de série', 'jours de série')}
          </b>
          <small>{t('Reviens demain pour la faire grandir')}</small>
        </span>
      </a>
    </div>
  )
}

// Fête les victoires et la série qui grandit, puis annonce les succès débloqués et les passages de niveau, un peu après
// la fin de la partie pour laisser le résultat du jeu s'afficher d'abord. Un seul message à la fois, quoi qu'il arrive.
export default function Celebrations() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [moments, setMoments] = useState<Moment[]>([])
  const showing = useRef(false)
  const recheck = useRef(() => {})

  useEffect(() => {
    function push(t: Omit<Toast, 'id'>, delay: number) {
      const id = next++
      setTimeout(() => setToasts([{ ...t, id }]), delay)
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), delay + 4000)
    }

    function check() {
      if (showing.current) return
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

    recheck.current = check

    let timer = 0
    const onSync = () => {
      clearTimeout(timer)
      timer = window.setTimeout(check, 900)
    }
    // la fin de partie se signale d'un son ; le message, s'il y en a un, vient ensuite
    const onPlay = (e: Event) => {
      const play = (e as CustomEvent<Play>).detail
      const tier = victoryOf(play)
      feedback(tier ? 'win' : play.win === false || play.pts < 30 ? 'lose' : 'good')
      if (!showing.current) {
        const list = plays()
        const before = list.at(-1)?.t === play.t ? list.slice(0, -1) : list
        const queue: Moment[] = []
        if (tier) {
          const gains = gainsOf(before, play)
          // tout de suite, avant que le solde de la barre ne compte ce gain d'un coup
          setFlying(gains.reduce((s, g) => s + g.n, 0))
          queue.push({ kind: 'victoire', win: { tier, gains } })
        }
        const step = streakStep(before, play)
        if (step && step.to >= 2) queue.push({ kind: 'serie', ...step })
        if (queue.length) {
          showing.current = true
          setMoments(queue)
        }
      }
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

  const advance = useCallback(() => setMoments((m) => m.slice(1)), [])

  // les moments passés, les succès et niveaux en attente peuvent s'annoncer
  useEffect(() => {
    if (moments.length || !showing.current) return
    showing.current = false
    recheck.current()
  }, [moments])

  const moment = moments[0]
  if (moment?.kind === 'victoire') return <Victory win={moment.win} onDone={advance} />
  if (moment?.kind === 'serie') return <StreakToast from={moment.from} to={moment.to} onDone={advance} />
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
