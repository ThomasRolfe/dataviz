import { useState } from 'react'
import ReactDOM from 'react-dom'
import type { InternalGraph } from '@/types/internal'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import styles from '@/styles/HoverTooltip.module.css'

interface HoverTooltipProps {
  hoveredId: string | null
  graph:     InternalGraph
  bridge:    OverlayBridge
}

export function HoverTooltip({ hoveredId, graph, bridge }: HoverTooltipProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useAnimationFrame(() => {
    if (!hoveredId) return
    const component = graph.components.get(hoveredId)
    if (!component) return
    setPos(bridge.worldToScreen(component.topCenter))
  }, [hoveredId])

  if (!hoveredId) return null
  const component = graph.components.get(hoveredId)
  if (!component) return null

  const { meta } = component
  const overlayRoot = document.getElementById('overlay-root')
  if (!overlayRoot) return null

  return ReactDOM.createPortal(
    <div
      className={styles.tooltip}
      style={{ transform: `translate(${pos.x}px, ${pos.y - 20}px)` }}
    >
      <strong>{component.label}</strong>
      {meta?.description && <p>{meta.description}</p>}
      {meta?.file && (
        <code>{meta.file}{meta.line ? `:${meta.line}` : ''}</code>
      )}
      {meta?.notes && <p className={styles.notes}>{meta.notes}</p>}
    </div>,
    overlayRoot
  )
}
