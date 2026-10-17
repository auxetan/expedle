import { useEffect, useState } from 'react'
import { locale } from '../lib/i18n'

// Le nombre défile jusqu'à sa valeur, en ralentissant vers la fin.
export default function CountUp({ value, format = (v) => v.toLocaleString(locale()), ms = 900 }: { value: number; format?: (v: number) => string; ms?: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - t0) / ms)
      setShown(Math.round(value * (1 - (1 - k) ** 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return <>{format(shown)}</>
}
