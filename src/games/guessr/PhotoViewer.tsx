import { useEffect, useRef, useState } from 'react'

interface View {
  k: number
  x: number
  y: number
}

// Photo zoomable : molette ou pincement pour scruter un panneau, glisser pour se déplacer, double-clic pour revenir.
export default function PhotoViewer({ src, alt }: { src: string; alt: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 })
  const [loaded, setLoaded] = useState(false)
  const viewRef = useRef(view)

  useEffect(() => {
    viewRef.current = view
  })

  useEffect(() => {
    const el = box.current!
    const pointers = new Map<number, { x: number; y: number }>()
    let pinch = 0
    // garde l'image dans le cadre : on ne peut pas la faire sortir en la déplaçant
    const clamp = (v: View): View => {
      const mx = ((v.k - 1) * el.clientWidth) / 2
      const my = ((v.k - 1) * el.clientHeight) / 2
      return { k: v.k, x: Math.max(-mx, Math.min(mx, v.x)), y: Math.max(-my, Math.min(my, v.y)) }
    }
    const zoomAt = (factor: number, cx: number, cy: number) => {
      const v = viewRef.current
      const k = Math.min(6, Math.max(1, v.k * factor))
      const r = el.getBoundingClientRect()
      const px = cx - r.left - r.width / 2
      const py = cy - r.top - r.height / 2
      const f = k / v.k
      setView(clamp({ k, x: px - (px - v.x) * f, y: py - (py - v.y) * f }))
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY)
    }
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest('button')) return
      el.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2)
        pinch = d
      } else {
        const v = viewRef.current
        setView(clamp({ k: v.k, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }))
      }
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      pinch = 0
    }
    const reset = () => setView({ k: 1, x: 0, y: 0 })
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('dblclick', reset)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('dblclick', reset)
    }
  }, [])

  return (
    <div className={view.k > 1 ? 'wg-photo zoomed' : 'wg-photo'} ref={box}>
      {!loaded && <div className="wg-spinner" aria-label="Chargement de la photo" />}
      <img
        key={src}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={loaded ? 'in' : ''}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      />
      <div className="wg-zoom">
        <button onClick={() => setView((v) => ({ ...v, k: Math.min(6, v.k * 1.5) }))} aria-label="Zoomer">
          +
        </button>
        <button onClick={() => setView({ k: 1, x: 0, y: 0 })} aria-label="Vue entière">
          ⤢
        </button>
      </div>
    </div>
  )
}
