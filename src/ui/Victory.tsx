// Le moment d'une victoire : une pépite tombe au centre et le gain se compte, source par source ; puis elle éclate
// en petites pépites qui filent se poser sur le solde de la barre du haut, qui les compte une à une.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { coin } from '../lib/feedback'
import { fmt, msg, plural, t } from '../lib/i18n'
import type { Victory as Tier } from '../lib/stats'
import type { Gain } from '../lib/wallet'
import { barWallet, center, fly, shares } from './flight'
import Mascot from './Mascot'
import { Pepites, setFlying, useFlying, useWallet } from './Pepites'
import './victory.css'

export interface Win {
  tier: Tier
  gains: Gain[]
}

const TITLES: Record<Tier, string> = { parfait: msg('Parfait'), victoire: msg('Victoire'), bravo: msg('Bien joué') }

// en millisecondes : le gain commence à se compter, puis chaque source s'y ajoute, et la pépite éclate après une pause
const COUNT_AT = 450
const ROW_GAP = 260
const HOLD = 600
// l'instant où la pépite touche le sol, accordé à l'animation vic-drop
const LANDING = 520
const MAX_COINS = 14

const easeOut = (k: number) => 1 - (1 - k) ** 3

export default function Victory({ win, onDone }: { win: Win; onDone: () => void }) {
  const total = win.gains.reduce((s, g) => s + g.n, 0)
  const coins = Math.min(total, MAX_COINS)
  const [reduce] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [rows, setRows] = useState(0)
  const [burst, setBurst] = useState(false)
  const [over, setOver] = useState(false)
  // Pépite tombe, surprise, et sourit en touchant le sol
  const [landed, setLanded] = useState(false)
  const [shown, setShown] = useState(0)
  // sans solde visible (un téléphone où la barre porte les outils du jeu), les pépites rejoignent un solde à elles
  const [ownWallet] = useState(() => !barWallet())
  const { balance } = useWallet()
  const inFlight = useFlying()
  const hero = useRef<HTMLDivElement>(null)
  const figure = useRef<HTMLDivElement>(null)
  const wallet = useRef<HTMLSpanElement>(null)
  const shownRef = useRef(0)

  const target = win.gains.slice(0, rows).reduce((s, g) => s + g.n, 0)
  const skip = useCallback(() => {
    setRows(win.gains.length)
    setBurst(true)
  }, [win])

  // les pépites gagnées restent en vol, hors du solde, jusqu'à ce qu'elles s'y posent
  useEffect(() => {
    setFlying(total)
    const ids = win.gains.map((_, i) => window.setTimeout(() => setRows((r) => Math.max(r, i + 1)), COUNT_AT + i * ROW_GAP))
    ids.push(window.setTimeout(() => setLanded(true), LANDING))
    ids.push(window.setTimeout(() => setBurst(true), COUNT_AT + win.gains.length * ROW_GAP + HOLD))
    return () => {
      ids.forEach(clearTimeout)
      setFlying(0)
    }
  }, [win, total])

  // le gain défile jusqu'à chaque nouvelle somme, et le chiffre accuse le coup
  useEffect(() => {
    const from = shownRef.current
    if (target === from) return
    const t0 = performance.now()
    const ms = from ? 280 : 480
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms)
      shownRef.current = Math.round(from + (target - from) * easeOut(k))
      setShown(shownRef.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    if (from) figure.current?.animate([{ transform: 'scale(1.07)' }, { transform: 'none' }], { duration: 280, easing: 'ease-out' })
    return () => cancelAnimationFrame(raf)
  }, [target])

  useEffect(() => {
    if (burst) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return
      e.preventDefault()
      skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [burst, skip])

  // L'éclat : la pépite se brise en petites pépites qui filent vers le solde, qui compte chacune à son arrivée.
  useLayoutEffect(() => {
    if (!burst) return
    if (reduce) {
      setFlying(0)
      const id = window.setTimeout(onDone, 450)
      return () => clearTimeout(id)
    }
    const goal = barWallet() ?? wallet.current!
    const or = getComputedStyle(goal).getPropertyValue('--or').trim()
    const values = shares(total, coins)
    let left = total
    let closing = 0
    const stop = fly({
      from: center(hero.current!),
      to: center(goal),
      count: coins,
      onLand: (i, last) => {
        left -= values[i]
        setFlying(left)
        coin(i, last)
        goal.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' })
        if (!last) return
        setOver(true)
        goal.animate([{ boxShadow: `0 0 0 0 color-mix(in srgb, ${or} 70%, transparent)` }, { boxShadow: '0 0 0 12px transparent' }], { duration: 700, easing: 'ease-out' })
        closing = window.setTimeout(onDone, 450)
      },
    })
    return () => {
      stop()
      clearTimeout(closing)
    }
  }, [burst, reduce, coins, total, onDone])

  const several = win.gains.length > 1
  return (
    <div className={['vic', burst && 'burst', over && 'over'].filter(Boolean).join(' ')} onClick={skip}>
      <div className="vic-bg" />
      <span className="vic-sr" role="status">
        {t(TITLES[win.tier])}. {plural(total, '{n} pépite gagnée', '{n} pépites gagnées')}
      </span>
      <div className={`vic-stage ${win.tier}`} aria-hidden>
        <div className="vic-hero" ref={hero}>
          <span className="vic-glow" />
          <span className="vic-ring" />
          {win.tier === 'parfait' && <span className="vic-ring late" />}
          <span className="vic-pop" />
          <Mascot className="vic-nugget" mood={landed ? 'joie' : 'surprise'} shine />
        </div>
        <div className="vic-copy">
          <p className="vic-title">{t(TITLES[win.tier])}</p>
          <div className={rows ? 'vic-total on' : 'vic-total'} ref={figure}>
            +{fmt(shown)}
          </div>
          {several && (
            <dl className="vic-rows">
              {win.gains.map((g, i) => (
                <div key={g.label} className={i < rows ? 'on' : undefined}>
                  <dt>{t(g.label, g.params)}</dt>
                  <dd>+{fmt(g.n)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      {ownWallet && (
        <span className="ui-wallet vic-wallet" ref={wallet} aria-hidden>
          <Pepites n={balance - inFlight} />
        </span>
      )}
    </div>
  )
}
