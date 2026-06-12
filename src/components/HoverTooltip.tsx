import { useRef } from 'react'
import ReactDOM from 'react-dom'
import type { InternalGraph } from '@/types/internal'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import { useWorldToScreen } from '@/hooks/useWorldToScreen'
import styles from '@/styles/HoverTooltip.module.css'

interface HoverTooltipProps {
  hoveredId: string | null
  graph:     InternalGraph
  bridge:    OverlayBridge
}

export function HoverTooltip({ hoveredId, graph, bridge }: HoverTooltipProps) {
  const divRef    = useRef<HTMLDivElement | null>(null)
  const component = hoveredId ? (graph.components.get(hoveredId) ?? null) : null

  useWorldToScreen(
    bridge,
    () => component?.topCenter ?? null,
    (x, y) => {
      if (divRef.current) {
        divRef.current.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 100% - 12px))`
      }
    },
    [hoveredId, graph],
  )

  if (!component) return null

  const { meta } = component
  const overlayRoot = document.getElementById('overlay-root')
  if (!overlayRoot) return null

  return ReactDOM.createPortal(
    <div
      ref={divRef}
      className={styles.tooltip}
      style={{ transform: 'translate(-9999px, -9999px)' }}
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
