import { useTheme } from './theme'

// Les icônes existent en deux variantes : le noir devient crème sur fond sombre.
export default function GameIcon({ icon, size }: { icon: string; size: number }) {
  const theme = useTheme()
  return <img className="game-icon" src={`${import.meta.env.BASE_URL}icons/${icon}-${theme}.webp`} width={size} height={size} alt="" draggable={false} />
}
