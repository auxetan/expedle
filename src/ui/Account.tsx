import { useEffect, useRef, useState } from 'react'
import { cloudEnabled, sendCode, signOut, startCloud, useAccount, verifyCode } from '../lib/cloud'

// Branche le compte au démarrage : session rétablie, synchronisation, envoi des parties.
export function CloudSync() {
  useEffect(() => startCloud(), [])
  return null
}

// Connexion sans mot de passe : un email, puis le code à 6 chiffres reçu.
export default function AccountBox() {
  const account = useAccount()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  if (account.state === 'loading') return <p className="ui-note">Connexion au compte…</p>

  if (account.state === 'in')
    return (
      <div className="ui-field ui-account">
        <span>Compte</span>
        <p className="ui-note">
          Connecté avec <b>{account.email}</b>. {account.syncing ? 'Synchronisation…' : account.error ? '' : 'Tes parties sont sauvegardées et suivent sur tous tes appareils.'}
        </p>
        {account.error && <p className="ui-error">{account.error}</p>}
        <button className="ui-btn-line" onClick={() => void signOut()}>
          Se déconnecter
        </button>
      </div>
    )

  return (
    <div className="ui-field ui-account">
      <span>Compte</span>
      <p className="ui-note">Connecte-toi pour apparaître dans les classements et retrouver ta progression sur tous tes appareils. Pas de mot de passe : un code arrive par email.</p>
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
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" autoComplete="email" required />
          <button className="ui-btn" disabled={busy || !email.includes('@')}>
            {busy ? 'Envoi…' : 'Recevoir un code'}
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
            placeholder="Code à 6 chiffres"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="ui-code"
          />
          <button className="ui-btn" disabled={busy || code.length !== 6}>
            {busy ? 'Vérification…' : 'Se connecter'}
          </button>
          <p className="ui-note">
            Code envoyé à <b>{email}</b>.{' '}
            <button
              type="button"
              className="ui-link"
              onClick={() => {
                setStep('email')
                setCode('')
                setError('')
              }}
            >
              Changer d’adresse
            </button>{' '}
            ·{' '}
            <button type="button" className="ui-link" disabled={busy} onClick={() => void run(() => sendCode(email))}>
              Renvoyer
            </button>
          </p>
        </form>
      )}
      {error && <p className="ui-error">{error}</p>}
    </div>
  )
}
