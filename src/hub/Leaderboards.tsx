import { useEffect, useState } from 'react'
import { cloudEnabled, dailyBoard, pointsBoard, useAccount, type DailyRow, type PointsRow } from '../lib/cloud'
import { load, save, todayKey } from '../lib/util'
import AppBar, { SubLink } from '../ui/AppBar'
import { gameInfo } from '../ui/gameInfo'
import GameIcon from '../ui/GameIcon'
import { ALL_GAMES } from '../ui/games'
import './leaderboards.css'

type Tab = 'jour' | 'semaine' | 'toujours'

const DAILIES = ALL_GAMES.filter((g) => g.rhythm === 'quotidien' && g.dailyId)
const fmt = (n: number) => n.toLocaleString('fr-FR')

function shift(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return todayKey(new Date(y, m - 1, d + by))
}

function longDay(day: string): string {
  if (day === todayKey()) return 'Aujourd’hui'
  if (day === shift(todayKey(), -1)) return 'Hier'
  return new Date(day + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function clock(ms: number | null): string {
  if (ms === null) return ''
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Lundi 0 h, heure locale.
function weekStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
}

function Rank({ rank }: { rank: number }) {
  return <span className={`lb-rank ${rank === 1 ? 'or' : rank === 2 ? 'argent' : rank === 3 ? 'bronze' : ''}`}>{rank}</span>
}

function useBoard<T>(fetcher: () => Promise<T[]>, deps: unknown[]) {
  const [state, setState] = useState<{ rows: T[] | null; error: string }>({ rows: null, error: '' })
  useEffect(() => {
    let alive = true
    setState({ rows: null, error: '' })
    fetcher().then(
      (rows) => alive && setState({ rows, error: '' }),
      (e: Error) => alive && setState({ rows: null, error: e.message }),
    )
    return () => {
      alive = false
    }
  }, deps)
  return state
}

function Board<T extends { rank: number; name: string; avatar: string; me: boolean }>({
  state,
  empty,
  value,
}: {
  state: { rows: T[] | null; error: string }
  empty: string
  value: (row: T) => React.ReactNode
}) {
  if (state.error) return <p className="lb-message">Classement indisponible : {state.error}</p>
  if (!state.rows)
    return (
      <div className="lb-message">
        <div className="lb-spinner" />
      </div>
    )
  if (!state.rows.length) return <p className="lb-message">{empty}</p>
  return (
    <ol className="lb-list stagger">
      {state.rows.map((r, i) => (
        // la ligne du joueur peut venir après une coupure dans le classement
        <li key={`${r.rank}-${r.name}-${i}`} className={`${r.me ? 'me' : ''} ${i > 0 && r.rank > state.rows![i - 1].rank + 1 && r.me ? 'gap' : ''}`}>
          <Rank rank={r.rank} />
          <span className="lb-avatar">{r.avatar}</span>
          <b className="lb-name">
            {r.name}
            {r.me && <small> · toi</small>}
          </b>
          <span className="lb-value">{value(r)}</span>
        </li>
      ))}
    </ol>
  )
}

function DailyTab() {
  const [game, setGame] = useState(() => load<string>('board-game', DAILIES[0].dailyId!))
  const [day, setDay] = useState(todayKey)
  const account = useAccount()
  const state = useBoard<DailyRow>(() => dailyBoard(game, day), [game, day, account.state])
  const info = gameInfo(game)

  return (
    <>
      <div className="lb-games">
        {DAILIES.map((g) => (
          <button
            key={g.dailyId}
            className={g.dailyId === game ? 'on' : ''}
            onClick={() => {
              setGame(g.dailyId!)
              save('board-game', g.dailyId)
            }}
          >
            <GameIcon icon={g.icon} size={26} />
            <span>{g.title}</span>
          </button>
        ))}
      </div>
      <div className="lb-day">
        <button onClick={() => setDay(shift(day, -1))} aria-label="Jour précédent">
          ‹
        </button>
        <b>{longDay(day)}</b>
        <button onClick={() => setDay(shift(day, 1))} disabled={day >= todayKey()} aria-label="Jour suivant">
          ›
        </button>
      </div>
      <Board
        state={state}
        empty={day === todayKey() ? 'Personne n’a encore fini ce jeu aujourd’hui. À toi d’ouvrir le bal !' : 'Personne n’a joué ce jour-là.'}
        value={(r) => (
          <>
            <span>{r.win === false ? 'perdu' : r.score !== null ? info.unit(r.score) : `${r.pts} pts`}</span>
            {!info.untimed && r.ms !== null && <small>{clock(r.ms)}</small>}
          </>
        )}
      />
      <p className="lb-note muted">Seule ta première partie du jour compte : ni l’entraînement, ni les archives, ni les rejeux.</p>
    </>
  )
}

function PointsTab({ since }: { since: Date | null }) {
  const account = useAccount()
  const state = useBoard<PointsRow>(() => pointsBoard(since), [since?.getTime(), account.state])
  return (
    <>
      <Board
        state={state}
        empty="Personne n’a encore marqué de points sur cette période."
        value={(r) => (
          <>
            <span>{fmt(r.points)} pts</span>
            <small>
              {fmt(r.plays)} partie{r.plays > 1 ? 's' : ''}
            </small>
          </>
        )}
      />
      <p className="lb-note muted">Chaque partie terminée rapporte de 0 à 100 points selon ta performance, quel que soit le jeu.</p>
    </>
  )
}

export default function Leaderboards({ tab }: { tab?: string }) {
  const current: Tab = tab === 'semaine' || tab === 'toujours' ? tab : 'jour'
  const account = useAccount()
  const [monday] = useState(weekStart)

  return (
    <div className="home">
      <AppBar title="Classements">
        <SubLink href="#/classements" active={current === 'jour'}>
          Jeux du jour
        </SubLink>
        <SubLink href="#/classements/semaine" active={current === 'semaine'}>
          Cette semaine
        </SubLink>
        <SubLink href="#/classements/toujours" active={current === 'toujours'}>
          Depuis toujours
        </SubLink>
      </AppBar>
      <main className="home-main lb-main">
        {!cloudEnabled ? (
          <section className="lb-closed">
            <h2>Les classements arrivent bientôt</h2>
            <p className="muted">Cette version de Méridien n’est pas encore reliée à un compte en ligne : tes parties restent sur cet appareil.</p>
          </section>
        ) : (
          <>
            {account.state === 'out' && (
              <p className="lb-banner">Connecte-toi depuis ton profil (en haut à droite) pour apparaître dans les classements : une adresse email suffit, sans mot de passe.</p>
            )}
            {current === 'jour' && <DailyTab />}
            {current === 'semaine' && <PointsTab since={monday} />}
            {current === 'toujours' && <PointsTab since={null} />}
          </>
        )}
      </main>
    </div>
  )
}
