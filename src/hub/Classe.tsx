import { useEffect, useMemo, useState } from 'react'
import {
  classBoard,
  classesReady,
  cloudEnabled,
  createClass,
  deleteClass,
  joinClass,
  leaveClass,
  myClasses,
  removeMember,
  updateClass,
  useAccount,
  type ClassInfo,
  type ClassRow,
} from '../lib/cloud'
import { cleanCode, MAX_PINS, pinGroups, pinTitle, playedSince, validPseudo } from '../lib/classe'
import { fmt, plural, t } from '../lib/i18n'
import { go } from '../lib/router'
import { plays } from '../lib/stats'
import { copyText, weekStart } from '../lib/util'
import AccountBox from '../ui/Account'
import AppBar from '../ui/AppBar'
import './challenges.css'
import './leaderboards.css'
import './classe.css'

const joinLink = (code: string) => `${location.origin}${location.pathname}#/classe/rejoindre?code=${code}`

// Tant que la migration des classes n'est pas passée, la page le dit et ne crée aucun compte.
function useReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(cloudEnabled ? null : false)
  useEffect(() => {
    if (cloudEnabled) classesReady().then(setReady, () => setReady(true))
  }, [])
  return ready
}

const failure = (e: unknown) => (e instanceof Error ? e.message : t('Une erreur est survenue. Réessaie.'))

// Le classement de la semaine : le professeur et les élèves de la classe ne voient que des pseudos.
function Board({ cls }: { cls: ClassInfo }) {
  const [rows, setRows] = useState<ClassRow[] | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    classBoard(cls.id, weekStart()).then(setRows, (e: Error) => setError(e.message))
  }, [cls.id])

  async function remove(pseudo: string) {
    try {
      await removeMember(cls.id, pseudo)
      // relu : les rangs suivants remontent
      setRows(await classBoard(cls.id, weekStart()))
    } catch (e) {
      setError(failure(e))
    }
    setConfirm('')
  }

  if (error) return <p className="ch-note">{error}</p>
  if (!rows) return <div className="lb-spinner" />
  if (!rows.length) return <p className="ch-note">{t('Pas encore d’élève : donne-leur le code de la classe.')}</p>
  return (
    <ol className="ch-list">
      {rows.map((r) => (
        <li key={r.pseudo} className={r.me ? 'me' : ''}>
          <span className="ch-rank">{r.rank}</span>
          <b className="ch-name">
            {r.pseudo}
            {r.me && <small> · {t('toi')}</small>}
          </b>
          <span className="ch-value">
            {t('{n} pts', { n: fmt(r.points) })}
            <small>{plural(r.plays, '{n} partie', '{n} parties')}</small>
          </span>
          {cls.teacher &&
            (confirm === r.pseudo ? (
              <span className="ui-confirm">
                <button className="danger" onClick={() => void remove(r.pseudo)}>
                  {t('Retirer')}
                </button>
                <button onClick={() => setConfirm('')}>{t('Annuler')}</button>
              </span>
            ) : (
              <button className="cf-remove" onClick={() => setConfirm(r.pseudo)} aria-label={t('Retirer {name}', { name: r.pseudo })}>
                ✕
              </button>
            ))}
        </li>
      ))}
    </ol>
  )
}

function Pins({ games, onSave }: { games: string[]; onSave: (games: string[]) => void }) {
  return (
    <>
      {games.length ? (
        <ul className="cl-pins">
          {games.map((href) => (
            <li key={href}>
              <a href={href}>{pinTitle(href)}</a>
              <button className="cf-remove" onClick={() => onSave(games.filter((g) => g !== href))} aria-label={t('Retirer {name}', { name: pinTitle(href) })}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ch-note">{t('Épingle quelques jeux : tes élèves les retrouvent sur leur page de classe.')}</p>
      )}
      {games.length < MAX_PINS && (
        <select className="cl-select" value="" onChange={(e) => e.target.value && onSave([...games, e.target.value])} aria-label={t('Épingler un jeu…')}>
          <option value="">{t('Épingler un jeu…')}</option>
          {pinGroups().map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.pins
                .filter((p) => !games.includes(p.href))
                .map((p) => (
                  <option key={p.href} value={p.href}>
                    {p.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      )}
    </>
  )
}

function TeacherClass({ cls, onChange, onDelete }: { cls: ClassInfo; onChange: (c: ClassInfo) => void; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')

  async function save(patch: Partial<Pick<ClassInfo, 'games' | 'open'>>) {
    setError('')
    try {
      await updateClass(cls.id, patch)
      onChange({ ...cls, ...patch })
    } catch (e) {
      setError(failure(e))
    }
  }

  async function remove() {
    try {
      await deleteClass(cls.id)
      onDelete()
    } catch (e) {
      setError(failure(e))
      setConfirm(false)
    }
  }

  async function share() {
    setCopied(await copyText(joinLink(cls.code)))
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <article className="cl-card">
      <header className="cl-head">
        <h2>{cls.name}</h2>
        <small>{plural(cls.members, '{n} élève', '{n} élèves')}</small>
      </header>
      <div className="cf-code">
        <div>
          <small>{t('Code de la classe')}</small>
          <b>{cls.code}</b>
        </div>
        <button className="ui-btn line" onClick={() => void share()}>
          {copied ? t('Lien copié !') : t('Copier le lien d’invitation')}
        </button>
      </div>
      <p className="ch-note">{t('Tes élèves tapent ce code dans Mode classe, ou ouvrent le lien d’invitation.')}</p>
      <label className="ui-check">
        <input type="checkbox" checked={cls.open} onChange={(e) => void save({ open: e.target.checked })} />
        {t('Accepter de nouveaux élèves')}
      </label>
      <h3>{t('Jeux à faire')}</h3>
      <Pins games={cls.games} onSave={(games) => void save({ games })} />
      <h3>{t('Classement de la semaine')}</h3>
      <Board cls={cls} />
      {error && <p className="ui-error">{error}</p>}
      {confirm ? (
        <div className="ui-confirm">
          <span>{t('Supprimer la classe {name} ? Ses élèves en sortent et leurs pseudos sont effacés.', { name: cls.name })}</span>
          <button className="danger" onClick={() => void remove()}>
            {t('Oui, supprimer')}
          </button>
          <button onClick={() => setConfirm(false)}>{t('Annuler')}</button>
        </div>
      ) : (
        <button className="cl-quiet" onClick={() => setConfirm(true)}>
          {t('Supprimer la classe')}
        </button>
      )}
    </article>
  )
}

function StudentClass({ cls, onLeave }: { cls: ClassInfo; onLeave: () => void }) {
  const done = useMemo(() => playedSince(plays(), weekStart()), [])
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')

  async function leave() {
    try {
      await leaveClass(cls.id)
      onLeave()
    } catch (e) {
      setError(failure(e))
      setConfirm(false)
    }
  }

  return (
    <article className="cl-card">
      <header className="cl-head">
        <h2>{cls.name}</h2>
        <small>{t('Ton pseudo : {pseudo}', { pseudo: cls.pseudo ?? '' })}</small>
      </header>
      <h3>{t('Jeux à faire')}</h3>
      {cls.games.length ? (
        <ul className="cl-pins">
          {cls.games.map((href) => (
            <li key={href}>
              <a href={href}>{pinTitle(href)}</a>
              {done.has(href) && <span className="cl-done">✓</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ch-note">{t('Ton professeur n’a pas encore épinglé de jeux.')}</p>
      )}
      <h3>{t('Classement de la semaine')}</h3>
      <Board cls={cls} />
      {error && <p className="ui-error">{error}</p>}
      {confirm ? (
        <div className="ui-confirm">
          <span>{t('Quitter la classe {name} ?', { name: cls.name })}</span>
          <button className="danger" onClick={() => void leave()}>
            {t('Quitter la classe')}
          </button>
          <button onClick={() => setConfirm(false)}>{t('Annuler')}</button>
        </div>
      ) : (
        <button className="cl-quiet" onClick={() => setConfirm(true)}>
          {t('Quitter la classe')}
        </button>
      )}
    </article>
  )
}

function CreateClass({ onCreate }: { onCreate: (c: ClassInfo) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const valid = name.trim().length >= 2 && name.trim().length <= 40

  async function create() {
    setBusy(true)
    setError('')
    try {
      onCreate(await createClass(name))
      setName('')
    } catch (e) {
      setError(failure(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="cf-section">
      <h2>{t('Nouvelle classe')}</h2>
      <form
        className="cf-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) void create()
        }}
      >
        <input className="cl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Nom de la classe, par exemple 6e B')} maxLength={40} />
        <button className="ui-btn" disabled={busy || !valid}>
          {t('Créer la classe')}
        </button>
      </form>
      {error && <p className="ui-error">{error}</p>}
    </section>
  )
}

export default function Classe() {
  const account = useAccount()
  const ready = useReady()
  const [classes, setClasses] = useState<ClassInfo[] | null>(null)
  const [error, setError] = useState('')
  const signedIn = account.state === 'in'

  useEffect(() => {
    if (!ready || !signedIn) return
    myClasses().then(setClasses, (e: Error) => setError(e.message))
  }, [ready, signedIn, account.userId])

  const replace = (c: ClassInfo) => setClasses((list) => list?.map((x) => (x.id === c.id ? c : x)) ?? null)
  const drop = (id: string) => setClasses((list) => list?.filter((x) => x.id !== id) ?? null)
  const teaching = classes?.filter((c) => c.teacher) ?? []
  const joined = classes?.filter((c) => !c.teacher) ?? []

  return (
    <div className="home">
      <AppBar title={t('Classe')} />
      <main className="home-main cf-main">
        <section className="cf-intro">
          <h1>{t('Mode classe')}</h1>
          <p className="muted">
            {t('Crée une classe et donne son code à tes élèves : ils la rejoignent avec un pseudo, sans email ni nom. Tu suis leurs points de la semaine et tu épingles les jeux à faire.')}
          </p>
        </section>
        {ready === false && <p className="lb-banner">{t('Le mode classe n’est pas encore ouvert sur Expedle. Reviens bientôt !')}</p>}
        {ready && account.state === 'out' && (
          <div className="cl-who">
            <section className="cl-card">
              <h2>{t('Élève ?')}</h2>
              <p className="ch-note">{t('Rejoins ta classe avec le code de ton professeur, sans email.')}</p>
              <a className="ui-btn" href="#/classe/rejoindre">
                {t('Rejoindre une classe')}
              </a>
            </section>
            <section className="cl-card">
              <h2>{t('Professeur ?')}</h2>
              <p className="ch-note">{t('Pour créer une classe, connecte-toi avec ton email.')}</p>
              <AccountBox />
            </section>
          </div>
        )}
        {ready && signedIn && (
          <>
            {error && <p className="ch-note">{error}</p>}
            {!classes && !error && <div className="lb-spinner" />}
            {joined.map((c) => (
              <StudentClass key={c.id} cls={c} onLeave={() => drop(c.id)} />
            ))}
            {teaching.map((c) => (
              <TeacherClass key={c.id} cls={c} onChange={replace} onDelete={() => drop(c.id)} />
            ))}
            {classes && !account.anonymous && <CreateClass onCreate={(c) => setClasses((list) => [c, ...(list ?? [])])} />}
            {classes && (
              <a className="cl-join-link" href="#/classe/rejoindre">
                {joined.length ? t('Rejoindre une autre classe') : t('Rejoindre une classe')}
              </a>
            )}
          </>
        )}
        {(ready === null || (ready && account.state === 'loading')) && <div className="lb-spinner" />}
      </main>
    </div>
  )
}

export function JoinClass({ params }: { params: URLSearchParams }) {
  const account = useAccount()
  const ready = useReady()
  const [code, setCode] = useState(() => cleanCode(params.get('code') ?? ''))
  const [pseudo, setPseudo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function join() {
    setBusy(true)
    setError('')
    try {
      await joinClass(code, pseudo)
      go('/classe')
    } catch (e) {
      setError(failure(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home">
      <AppBar title={t('Classe')} />
      <main className="home-main cf-main">
        <section className="cf-intro">
          <h1>{t('Rejoindre une classe')}</h1>
          <p className="muted">{t('Entre le code donné par ton professeur et choisis un pseudo. Pas d’email ni de mot de passe : ton compte élève reste sur cet appareil.')}</p>
        </section>
        {ready === false && <p className="lb-banner">{t('Le mode classe n’est pas encore ouvert sur Expedle. Reviens bientôt !')}</p>}
        {ready === null && <div className="lb-spinner" />}
        {ready && (
          <form
            className="cl-card cl-join"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length === 6 && validPseudo(pseudo)) void join()
            }}
          >
            <label className="ui-field">
              <span>{t('Code de la classe')}</span>
              <input className="cl-code" value={code} onChange={(e) => setCode(cleanCode(e.target.value))} placeholder="ABC234" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
            </label>
            <label className="ui-field">
              <span>{t('Ton pseudo')}</span>
              <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={20} autoComplete="off" />
              <small className="ui-note">{t('Un prénom ou un surnom que ton professeur reconnaîtra, sans ton nom de famille.')}</small>
            </label>
            {account.state === 'in' && !account.anonymous && <p className="ch-note">{t('Tu rejoindras la classe avec le compte {email}.', { email: account.email })}</p>}
            <button className="ui-btn" disabled={busy || code.length !== 6 || !validPseudo(pseudo)}>
              {t('Rejoindre la classe')}
            </button>
            {error && <p className="ui-error">{error}</p>}
          </form>
        )}
      </main>
    </div>
  )
}
