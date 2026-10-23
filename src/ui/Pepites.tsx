// Les pépites à l'écran : leur icône, un montant, et le solde tenu à jour dès qu'une partie finit ou qu'un achat passe.
import { useEffect, useRef, useState } from 'react'
import { HISTORY_CHANGED } from '../lib/cloud'
import { fmt, t } from '../lib/i18n'
import { plays, PLAYED } from '../lib/stats'
import { balanceOf, loadConsumed, loadPurchases, stockOf, WALLET_CHANGED } from '../lib/wallet'

// une pépite d'or, taillée en facettes
export function PepiteIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="pepite-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M4 15.5 7 8l6.5-3.5L20 9l.5 7-6 4.5-8-1.5z" fill="var(--or)" />
      <path d="M7 8l4 4 2.5-7.5M11 12l-4.5 7.5M11 12l9.5 4M11 12l9-3" fill="none" stroke="var(--bg)" strokeOpacity=".35" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  )
}

export function Pepites({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="pepites">
      <PepiteIcon size={size} />
      {fmt(n)}
    </span>
  )
}

export interface Wallet {
  balance: number
  owned: Set<string>
  // ce qui reste de chaque joker acheté
  stock: Map<string, number>
}

const read = (): Wallet => {
  const bought = loadPurchases()
  const consumed = loadConsumed()
  const stock = new Map(bought.filter((p) => p.n).map((p) => [p.id, stockOf(p.id, bought, consumed)]))
  return { balance: balanceOf(plays(), bought), owned: new Set(bought.map((p) => p.id)), stock }
}

// Le solde et les achats, relus à chaque partie terminée, synchronisation ou achat.
export function useWallet(): Wallet {
  const [wallet, setWallet] = useState(read)
  useEffect(() => {
    const refresh = () => setWallet(read())
    const events = [PLAYED, HISTORY_CHANGED, WALLET_CHANGED]
    events.forEach((e) => window.addEventListener(e, refresh))
    return () => events.forEach((e) => window.removeEventListener(e, refresh))
  }, [])
  return wallet
}

// Le solde dans la barre du haut, qui mène à la boutique ; un gain s'y affiche un instant. `crowded` : la barre
// porte déjà les outils d'un jeu, et le solde s'efface sur un téléphone pour leur laisser la place.
export function WalletChip({ crowded }: { crowded?: boolean }) {
  const { balance } = useWallet()
  const before = useRef(balance)
  const [gain, setGain] = useState(0)
  useEffect(() => {
    const diff = balance - before.current
    before.current = balance
    if (diff <= 0) return
    setGain(diff)
    const id = window.setTimeout(() => setGain(0), 2500)
    return () => clearTimeout(id)
  }, [balance])
  return (
    <a href="#/boutique" className={crowded ? 'ui-wallet crowded' : 'ui-wallet'} aria-label={t('Boutique : {n} pépites', { n: fmt(balance) })}>
      <Pepites n={balance} />
      {gain > 0 && <small>+{fmt(gain)}</small>}
    </a>
  )
}
