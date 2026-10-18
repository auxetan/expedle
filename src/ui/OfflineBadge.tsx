import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'

// Hors connexion, une pastille le dit : les jeux qui n'ont pas besoin d'Internet restent jouables.
export default function OfflineBadge() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div className="offline-badge" role="status">
      {t('Hors ligne · les jeux sans Internet restent jouables')}
    </div>
  )
}
