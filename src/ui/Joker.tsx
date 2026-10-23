// Un joker acheté à la boutique, proposé au moment où il sert, tant qu'il en reste. Le jeu ne l'affiche qu'en partie
// libre, entraînement ou archive : jamais au classement du jour ni dans un défi.
import { t } from '../lib/i18n'
import { consume } from '../lib/wallet'
import { useWallet } from './Pepites'
import { ITEMS } from './shop'

export default function Joker({ id, onUse }: { id: string; onUse: () => void }) {
  const n = useWallet().stock.get(id) ?? 0
  if (!n) return null
  const item = ITEMS.find((i) => i.id === id)!
  return (
    <button className="ui-joker" onClick={() => consume(id) && onUse()}>
      <span>{item.value}</span>
      {t(item.name)}
      <small>{t('Joker ×{n}', { n })}</small>
    </button>
  )
}
