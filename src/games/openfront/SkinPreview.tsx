import { useEffect, useRef } from 'react'
import type { Skin } from './progress'

// Un motif peint comme ton territoire en jeu : ta teinte mêlée à la terre, plus pâle sur les cases du motif.
export default function SkinPreview({ skin, width = 132, height = 84 }: { skin: Skin; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const style = getComputedStyle(canvas)
    const ctx = canvas.getContext('2d')!
    const cell = 3
    ctx.fillStyle = style.getPropertyValue('--line')
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = style.getPropertyValue('--fg')
    for (let y = 0; y < canvas.height / cell; y++)
      for (let x = 0; x < canvas.width / cell; x++) {
        ctx.globalAlpha = skin.at(x, y) ? 0.5 : 0.78
        ctx.fillRect(x * cell, y * cell, cell, cell)
      }
    ctx.globalAlpha = 1
  }, [skin])
  return <canvas ref={ref} width={width} height={height} aria-hidden />
}
