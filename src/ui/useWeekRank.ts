// Le rang de la semaine (points marqués depuis lundi), gardé quelques minutes pour ne pas réinterroger le serveur
// à chaque page ; une partie terminée le fait relire.
import { useEffect, useState } from 'react'
import { cloudEnabled, pointsBoard, useAccount, whenSynced } from '../lib/cloud'
import { PLAYED } from '../lib/stats'
import { weekStart } from '../lib/util'

const KEEP = 5 * 60_000
let cache: { at: number; rank: number | null } | null = null

export function useWeekRank(): number | null {
  const account = useAccount()
  const [rank, setRank] = useState(cache?.rank ?? null)
  const [stale, setStale] = useState(0)

  useEffect(() => {
    const drop = () => {
      cache = null
      setStale((n) => n + 1)
    }
    window.addEventListener(PLAYED, drop)
    return () => window.removeEventListener(PLAYED, drop)
  }, [])

  useEffect(() => {
    if (!cloudEnabled || account.state !== 'in' || (cache && Date.now() - cache.at < KEEP)) return
    let alive = true
    whenSynced()
      .then(() => pointsBoard(weekStart()))
      .then(
        (rows) => {
          cache = { at: Date.now(), rank: rows.find((r) => r.me)?.rank ?? null }
          if (alive) setRank(cache.rank)
        },
        () => {},
      )
    return () => {
      alive = false
    }
  }, [account.state, stale])

  return account.state === 'in' ? rank : null
}
