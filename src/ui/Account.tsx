import { useEffect, useRef, useState } from 'react'
import { cloudEnabled, sendCode, signOut, startCloud, useAccount, verifyCode } from '../lib/cloud'
import { t } from '../lib/i18n'

// Branche le compte au démarrage : session rétablie, synchronisation, envoi des parties.
export function CloudSync() {
  useEffect(() => startCloud(), [])
  return null
}

// Connexion sans mot de passe : un email, puis le lien ou le code à 6 chiffres qu'il contient.
export default function AccountBox() {
  const account = useAccount()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  if (!cloudEnabled) return null

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Une erreur est survenue.'))
    } finally {
      setBusy(false)
    }
  }

  if (account.state === 'loading') return <p className="ui-note">{t('Connexion au compte…')}</p>

  // un compte élève sans email ne se retrouve pas après déconnexion : on prévient avant
  if (account.state === 'in' && account.anonymous)
    return (
      <div className="ui-field ui-account">
        <span>{t('Compte')}</span>
        <p className="ui-note">{account.syncing ? t('Synchronisation…') : t('Compte élève, sans email : il n’existe que sur cet appareil.')}</p>
        {account.error && <p className="ui-error">{account.error}</p>}
        {leaving ? (
          <div className="ui-confirm">
            <span>{t('Te déconnecter ? Ce compte sans email ne pourra pas être retrouvé, ni ta place dans ta classe.')}</span>
            <button className="danger" onClick={() => void signOut()}>
              {t('Oui, me déconnecter')}
            </button>
            <button onClick={() => setLeaving(false)}>{t('Annuler')}</button>
          </div>
        ) : (
          <button className="ui-btn-line" onClick={() => setLeaving(true)}>
            {t('Se déconnecter')}
          </button>
        )}
      </div>
    )

  if (account.state === 'in')
    return (
      <div className="ui-field ui-account">
        <span>{t('Compte')}</span>
        <p className="ui-note">
          {t('Connecté avec')} <b>{account.email}</b>.{' '}
          {account.syncing ? t('Synchronisation…') : account.error ? '' : t('Tes parties sont sauvegardées et suivent sur tous tes appareils.')}
        </p>
        {account.error && <p className="ui-error">{account.error}</p>}
        <button className="ui-btn-line" onClick={() => void signOut()}>
          {t('Se déconnecter')}
        </button>
      </div>
    )

  return (
    <div className="ui-field ui-account">
      <span>{t('Compte')}</span>
      <p className="ui-note">
        {t('Connecte-toi pour apparaître dans les classements et retrouver ta progression sur tous tes appareils. Pas de mot de passe : tout passe par un email.')}
      </p>
      {step === 'email' ? (
        <form
          className="ui-account-form"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await sendCode(email)
              setStep('code')
            })
          }}
        >
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('ton@email.fr')} autoComplete="email" required />
          <button className="ui-btn" disabled={busy || !email.includes('@')}>
            {busy ? t('Envoi…') : t('Recevoir l’email')}
          </button>
        </form>
      ) : (
        <form
          className="ui-account-form"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => verifyCode(email, code))
          }}
        >
          <input
            ref={codeRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('Code à 6 chiffres')}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="ui-code"
          />
          <button className="ui-btn" disabled={busy || code.length !== 6}>
            {busy ? t('Vérification…') : t('Se connecter')}
          </button>
          <p className="ui-note">
            {t('Email envoyé à {email} : clique sur le lien qu’il contient, ou tape ici son code s’il en affiche un.', { email })}{' '}
            <button
              type="button"
              className="ui-link"
              onClick={() => {
                setStep('email')
                setCode('')
                setError('')
              }}
            >
              {t('Changer d’adresse')}
            </button>{' '}
            ·{' '}
            <button type="button" className="ui-link" disabled={busy} onClick={() => void run(() => sendCode(email))}>
              {t('Renvoyer')}
            </button>
          </p>
        </form>
      )}
      {error && <p className="ui-error">{error}</p>}
    </div>
  )
}
