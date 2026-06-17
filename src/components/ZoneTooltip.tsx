import { useRef } from 'react'
import ReactDOM from 'react-dom'
import type { InternalGraph } from '@/types/internal'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import type { FlowScene } from '@/scene/FlowScene'
import { useWorldToScreen } from '@/hooks/useWorldToScreen'
import styles from '@/styles/ZoneTooltip.module.css'

interface Props {
  zoneId: string
  graph:  InternalGraph
  scene:  FlowScene
  bridge: OverlayBridge
}

export function ZoneTooltip({ zoneId, graph, scene, bridge }: Props) {
  const divRef = useRef<HTMLDivElement | null>(null)
  const zone   = graph.zones.find(z => z.id === zoneId) ?? null

  useWorldToScreen(
    bridge,
    () => scene.zoneLabelPositions.get(zoneId) ?? null,
    (x, y) => {
      if (divRef.current) {
        divRef.current.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 100% - 8px))`
      }
    },
    [zoneId],
  )

  if (!zone?.meta?.description && !zone?.meta?.notes) return null

  const overlayRoot = document.getElementById('overlay-root')
  if (!overlayRoot) return null

  return ReactDOM.createPortal(
    <div
      ref={divRef}
      className={styles.tooltip}
      style={{ transform: 'translate(-9999px, -9999px)' }}
    >
      <strong>{zone.label}</strong>
      {zone.meta?.description && <p>{zone.meta.description}</p>}
      {zone.meta?.notes && <p className={styles.notes}>{zone.meta.notes}</p>}
    </div>,
    overlayRoot,
  )
}
