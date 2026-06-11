import { useState } from 'react'
import ReactDOM from 'react-dom'
import type { Annotation } from '@/types/schema'
import type { InternalGraph } from '@/types/internal'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import styles from '@/styles/AnnotationOverlay.module.css'

interface AnnotationOverlayProps {
  annotations: Annotation[]
  graph:       InternalGraph
  bridge:      OverlayBridge
}

export function AnnotationOverlay({ annotations, graph, bridge }: AnnotationOverlayProps) {
  const [positions, setPositions] = useState<Map<number, { x: number; y: number }>>(new Map())

  useAnimationFrame(() => {
    const next = new Map<number, { x: number; y: number }>()
    annotations.forEach((ann, i) => {
      const component = graph.components.get(ann.target)
      if (!component) return
      const anchor = component.topCenter.clone()
      anchor.y += 1.2
      next.set(i, bridge.worldToScreen(anchor))
    })
    setPositions(next)
  }, [annotations])

  const overlayRoot = document.getElementById('overlay-root')
  if (!overlayRoot) return null

  return ReactDOM.createPortal(
    <>
      {annotations.map((ann, i) => {
        const p = positions.get(i)
        if (!p) return null
        return (
          <div
            key={i}
            className={`${styles.annotation} ${styles[ann.type]}`}
            style={{ transform: `translate(${p.x - 110}px, ${p.y}px)` }}
          >
            {ann.text}
          </div>
        )
      })}
    </>,
    overlayRoot
  )
}
