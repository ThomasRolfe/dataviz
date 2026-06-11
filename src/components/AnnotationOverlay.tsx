import { useRef } from 'react'
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
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useAnimationFrame(() => {
    annotations.forEach((ann, i) => {
      const el = itemRefs.current.get(i)
      if (!el) return
      const component = graph.components.get(ann.target)
      if (!component) return
      const anchor = component.topCenter.clone()
      anchor.y += 0.5
      const pos = bridge.worldToScreen(anchor)
      el.style.transform = `translate(calc(${pos.x}px - 50%), ${pos.y}px)`
    })
  }, [annotations, graph, bridge])

  const overlayRoot = document.getElementById('overlay-root')
  if (!overlayRoot) return null

  return ReactDOM.createPortal(
    <>
      {annotations.map((ann, i) => (
        <div
          key={i}
          ref={el => {
            if (el) itemRefs.current.set(i, el)
            else itemRefs.current.delete(i)
          }}
          className={`${styles.annotation} ${styles[ann.type]}`}
          style={{ transform: 'translate(-9999px, -9999px)' }}
        >
          {ann.text}
        </div>
      ))}
    </>,
    overlayRoot
  )
}
