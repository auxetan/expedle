import { useEffect, useMemo, useState } from 'react'
import { COUNTRY_BY_CODE } from '../geo/countries'
import { evaluate, levelOf } from '../lib/achievements'
import { PASSPORT_SYNCED, useAccount } from '../lib/cloud'
import { t } from '../lib/i18n'
import { coverage, passport } from '../lib/passport'
import { plays } from '../lib/stats'
import { hashString } from '../lib/util'
import AppBar from '../ui/AppBar'
import { loadProfile } from '../ui/Panels'
import Book, { type Face } from './passport/Book'
import { mrz } from './passport/mrz'
import { BackCover, Cover, DataPage, InsideBack, InsideCover, NotesPage, PER_PAGE, VisaPage, type Holder, type Visa } from './passport/pages'
import './passport.css'

// Les jeux qui délivrent des tampons, rappelés en fin de passeport.
const STAMPING = ['worldle', 'globle', 'countryle', 'flagle', 'dailygeo', 'geogrid', 'factle', 'itineraire', 'cartographe', 'quiz-drapeaux', 'quiz-capitales', 'quiz-francophonie', 'geoguessr', 'photoguessr']

// Le numéro du passeport : le code ami quand on est connecté, sinon un numéro tiré de l'appareil.
function passportNumber(code: string, seed: string): string {
  if (code) return `E${code}`
  return `E${(hashString(seed) % 36 ** 7).toString(36).toUpperCase().padStart(7, '0')}X`
}

export default function Passport() {
  const account = useAccount()
  const [book, setBook] = useState(passport)
  useEffect(() => {
    // le passeport du compte arrive après l'ouverture de la page : on le relit
    const reload = () => setBook(passport())
    window.addEventListener(PASSPORT_SYNCED, reload)
    return () => window.removeEventListener(PASSPORT_SYNCED, reload)
  }, [])

  const faces = useMemo(() => {
    const history = plays()
    const level = levelOf(history, evaluate(history))
    const profile = loadProfile()
    const cover = coverage(book)
    const firstStamp = Math.min(...Object.values(book).map((s) => s.first))
    const issued = new Date(history[0]?.t ?? (Number.isFinite(firstStamp) ? firstStamp : Date.now()))
    const expires = new Date(issued.getFullYear() + 10, issued.getMonth(), issued.getDate())
    const name = profile.name || t('Voyageur')
    const number = passportNumber(account.code, `${profile.name}${issued.getTime()}`)
    const holder: Holder = {
      name,
      avatar: profile.avatar,
      title: level.title,
      level: level.level,
      number,
      issued,
      expires,
      mrz: mrz({ surname: name, given: t(level.title), number, issued, expires, country: 'EXP', personal: `L${level.level}P${cover.stamped}` }),
      stamped: cover.stamped,
      total: cover.total,
    }

    // les tampons dans l'ordre où on les a reçus, six par page, et au moins quatre pages de visas
    const visas: Visa[] = Object.entries(book)
      .filter(([code]) => COUNTRY_BY_CODE.has(code))
      .sort((a, b) => a[1].first - b[1].first)
      .map(([code, data]) => ({ code, data }))
    let pageCount = Math.max(4, Math.ceil(visas.length / PER_PAGE))
    // couverture, garde, identité, observations, visas, renseignements, dos : un nombre pair de faces
    if (pageCount % 2) pageCount++
    const visaPages = Array.from({ length: pageCount }, (_, i) => visas.slice(i * PER_PAGE, (i + 1) * PER_PAGE))
    // pages de papier : tout sauf la couverture et le dos
    const total = 4 + visaPages.length
    const list: Face[] = [
      { node: <Cover />, cover: true },
      { node: <InsideCover pages={total} /> },
      { node: <DataPage holder={holder} number={1} /> },
      { node: <NotesPage book={book} coverage={cover} number={2} /> },
      ...visaPages.map((v, i) => ({ node: <VisaPage visas={v} number={3 + i} /> })),
      { node: <InsideBack games={STAMPING} /> },
      { node: <BackCover />, cover: true },
    ]
    return list
  }, [book, account.code])

  return (
    <div className="home pp-page">
      <AppBar title={t('Passeport')} />
      {/* encre des tampons : un trait irrégulier, un peu passé par endroits */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="pp-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.2" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="11" result="blot" />
          <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.3" result="mask" />
          <feComposite in="rough" in2="mask" operator="in" />
        </filter>
      </svg>
      <main className="pp-main">
        <Book faces={faces} />
      </main>
    </div>
  )
}
