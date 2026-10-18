// Une pluie de confettis par-dessus la page, sans bibliothèque : un canvas le temps de l'animation, puis plus rien.
const COLORS = ['#e3b55b', '#8fbf8f', '#d9705f', '#ece6da', '#9fb7d9', '#c8a2d6']

export function confetti(count = 140): void {
  if (typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  // deux canons en bas des côtés, comme une célébration de fin de partie
  const bits = Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0
    const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9
    const speed = 9 + Math.random() * 9
    return {
      x: left ? -10 : w + 10,
      y: h * 0.75,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 6,
      spin: Math.random() * Math.PI,
      vs: (Math.random() - 0.5) * 0.3,
      color: COLORS[i % COLORS.length],
    }
  })
  const start = performance.now()
  const frame = (now: number) => {
    const t = now - start
    ctx.clearRect(0, 0, w, h)
    for (const b of bits) {
      b.vy += 0.32
      b.vx *= 0.99
      b.x += b.vx
      b.y += b.vy
      b.spin += b.vs
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(b.spin)
      ctx.globalAlpha = Math.max(0, 1 - t / 2600)
      ctx.fillStyle = b.color
      ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2)
      ctx.restore()
    }
    if (t < 2600) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
