import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getLang } from './lib/i18n'
// garde la proposition d'installation du navigateur, qui n'arrive qu'une fois au chargement
import './lib/install'
import { applyTheme } from './ui/theme'

applyTheme()
document.documentElement.lang = getLang()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
