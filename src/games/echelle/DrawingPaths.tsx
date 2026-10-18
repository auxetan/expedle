import type { Part } from './drawings'

// Aplats et traits d'une silhouette dessinée ; la couleur vient du groupe parent.
export default function DrawingPaths({ parts }: { parts: Part[] }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <path key={i} d={p} stroke="none" />
        ) : (
          <path key={i} d={p.d} fill="none" strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" />
        ),
      )}
    </>
  )
}
