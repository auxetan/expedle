import { Viewer } from '@photo-sphere-viewer/core'
import '@photo-sphere-viewer/core/index.css'
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import { VirtualTourPlugin, type VirtualTourNode } from '@photo-sphere-viewer/virtual-tour-plugin'
import '@photo-sphere-viewer/virtual-tour-plugin/index.css'
import { useEffect, useRef } from 'react'
import type { SphereNode, SphereSpot } from './sphere'

const RAD = Math.PI / 180

// Le panorama est tourné pour que le lacet 0 vise le nord : les flèches vers les vues voisines se placent
// alors d'après leurs coordonnées GPS, et le cap de départ est un vrai cap.
function tourNode(n: SphereNode): VirtualTourNode {
  return {
    id: n.id,
    panorama: n.panorama,
    gps: [n.lng, n.lat],
    sphereCorrection: { pan: -n.azimuth * RAD },
    links: n.links.map((l) => ({ nodeId: l.id, gps: [l.lng, l.lat] })),
  }
}

// Une seule visionneuse pour toute la partie, comme pour Street View : chaque manche y charge un autre nœud.
export default function SphereView({ spot, load }: { spot: SphereSpot; load: (id: string) => Promise<SphereNode> }) {
  const el = useRef<HTMLDivElement>(null)
  const tour = useRef<VirtualTourPlugin | null>(null)
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    const viewer = new Viewer({
      container: el.current!,
      adapter: EquirectangularTilesAdapter,
      navbar: false,
      loadingTxt: '',
      defaultZoomLvl: 0,
      mousewheelCtrlKey: false,
      touchmoveTwoFingers: false,
      plugins: [
        VirtualTourPlugin.withConfig({
          dataMode: 'server',
          positionMode: 'gps',
          renderMode: '3d',
          preload: true,
          showLinkTooltip: false,
          getNode: async (id) => tourNode(await loadRef.current(id)),
        }),
      ],
    })
    tour.current = viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin)
    return () => {
      tour.current = null
      viewer.destroy()
    }
  }, [])

  function goStart(effect: 'none' | 'fade') {
    tour.current
      ?.setCurrentNode(spot.start.id, { rotateTo: { yaw: spot.heading * RAD, pitch: 0 }, zoomTo: 0, rotation: false, effect, forceUpdate: true })
      .catch(() => {})
  }

  const goStartRef = useRef(goStart)
  useEffect(() => {
    goStartRef.current = goStart
  })
  useEffect(() => goStartRef.current('none'), [spot])

  return (
    <div className="gg-pano-wrap">
      <div className="gg-pano" ref={el} />
      <button className="gg-return" onClick={() => goStart('fade')}>
        ⟲ Retour au départ
      </button>
    </div>
  )
}
