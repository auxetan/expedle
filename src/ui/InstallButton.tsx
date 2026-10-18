import { t } from '../lib/i18n'
import { install, useInstall } from '../lib/install'

// Dans les réglages : installer Méridien comme une application, ou le geste à faire sur iPhone.
export default function InstallButton() {
  const state = useInstall()
  if (state === 'installed' || state === 'none') return null
  return (
    <div className="ui-field">
      <span>{t('Application')}</span>
      {state === 'prompt' ? (
        <>
          <p className="ui-note">{t('Installe Méridien sur ton écran d’accueil : il s’ouvre comme une application et marche aussi hors ligne.')}</p>
          <button className="ui-btn-line" onClick={() => void install()}>
            {t('Installer Méridien')}
          </button>
        </>
      ) : (
        <p className="ui-note">{t('Sur iPhone : touche Partager, puis « Sur l’écran d’accueil ». Méridien s’ouvrira comme une application.')}</p>
      )}
    </div>
  )
}
