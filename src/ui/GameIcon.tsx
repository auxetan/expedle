import { useWallet } from './Pepites'
import { useTheme } from './theme'

// Les icônes existent en deux variantes : le noir devient crème sur fond sombre. Celles achetées dans la boutique
// passent à l'or.
export default function GameIcon({ icon, size, golden }: { icon: string; size: number; golden?: boolean }) {
  const theme = useTheme()
  const { owned } = useWallet()
  const gold = golden ?? owned.has(`icone:${icon}`)
  return (
    <img className={gold ? 'game-icon dore' : 'game-icon'} src={`${import.meta.env.BASE_URL}icons/${icon}-${theme}.webp`} width={size} height={size} alt="" draggable={false} />
  )
}
