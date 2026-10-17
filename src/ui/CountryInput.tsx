import { useEffect, useMemo, useRef, useState } from 'react'
import type { Atlas } from '../geo/atlas'
import { t } from '../lib/i18n'
import { exactMatch, matchSuggestions } from '../games/itineraire/puzzle'

interface Props {
  atlas: Atlas
  onPick: (code: string) => void
  // pays déjà proposés : refusés avec un message
  used: Set<string>
  placeholder?: string
  button?: string
  // prend le focus dès son apparition (GeoGrid l'affiche quand on choisit une case)
  autoFocus?: boolean
}

function Highlight({ label, at, len }: { label: string; at: number; len: number }) {
  if (at < 0) return <>{label}</>
  return (
    <>
      {label.slice(0, at)}
      <mark>{label.slice(at, at + len)}</mark>
      {label.slice(at + len)}
    </>
  )
}

// Saisie d'un pays avec la liste complète des correspondances, au clavier comme à la souris.
export default function CountryInput({ atlas, onPick, used, placeholder = t('Entre un pays…'), button = t('Deviner'), autoFocus = false }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState(false)
  const list = useRef<HTMLUListElement>(null)
  const suggestions = useMemo(() => matchSuggestions(atlas, query), [atlas, query])

  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function refuse(text: string) {
    setMessage(text)
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  function submit(code?: string) {
    const pick = code ?? suggestions[active]?.s.code ?? exactMatch(atlas, query)?.code
    if (!pick) return refuse(t('Pays inconnu'))
    if (used.has(pick)) return refuse(t('{name} : déjà proposé', { name: atlas.name(pick) }))
    onPick(pick)
    setQuery('')
    setActive(0)
    setOpen(false)
    setMessage('')
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="ci">
      <div className="ci-row">
        <input
          className={shake ? 'ci-input shake' : 'ci-input'}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
            setMessage('')
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKey}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="ui-btn ci-go" onMouseDown={(e) => e.preventDefault()} onClick={() => submit()}>
          {button}
        </button>
      </div>
      {open && suggestions.length > 0 && (
        <ul className="ci-list" ref={list}>
          {suggestions.map(({ s, at }, i) => (
            <li
              key={s.code}
              className={(i === active ? 'on' : '') + (used.has(s.code) ? ' used' : '')}
              onMouseMove={() => i !== active && setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                submit(s.code)
              }}
            >
              <Highlight label={s.label} at={at} len={query.trim().length} />
            </li>
          ))}
        </ul>
      )}
      {message && <p className="ci-msg">{message}</p>}
    </div>
  )
}
