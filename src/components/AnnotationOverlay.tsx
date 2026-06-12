import { useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import type { Annotation, AnnotationStyle } from '@/types/schema'
import type { InternalGraph } from '@/types/internal'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import styles from '@/styles/AnnotationOverlay.module.css'

const OFFSETS = [
  {  dx:  130, dy: -90 },
  {  dx: -130, dy: -90 },
  {  dx:  130, dy:  60 },
  {  dx: -130, dy:  60 },
]

const STYLE_ICON: Record<AnnotationStyle, string> = {
  error:   '✕',
  warning: '⚠',
  success: '✓',
  info:    'ℹ',
}

interface Props {
  annotations: Annotation[]
  graph:       InternalGraph
  bridge:      OverlayBridge
}

export function AnnotationOverlay({ annotations, graph, bridge }: Props) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const lineRefs = useRef<(SVGLineElement | null)[]>([])

  // Fade-in whenever visible annotations change (new arrival or step change)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      cardRefs.current.forEach(el => { if (el) el.style.opacity = '1' })
      lineRefs.current.forEach(el => { if (el) el.style.opacity = '1' })
    })
    return () => cancelAnimationFrame(id)
  }, [annotations])

  useAnimationFrame(() => {
    annotations.forEach((ann, i) => {
      const card = cardRefs.current[i]
      const line = lineRefs.current[i]
      const component = graph.components.get(ann.target)
      if (!component) return

      const anchor = bridge.worldToScreen(component.topCenter)
      const { dx, dy } = OFFSETS[i % 4]
      const extraY = Math.floor(i / 4) * 40
      const cardX  = anchor.x + dx
      const cardY  = anchor.y + dy + extraY

      if (card) {
        card.style.transform = `translate(${cardX}px, ${cardY}px)`
      }
      if (line) {
        const w = card?.offsetWidth  || 200
        const h = card?.offsetHeight || 36
        const lineX2 = dx >= 0 ? cardX : cardX + w
        const lineY2 = cardY + h / 2
        line.setAttribute('x1', String(anchor.x))
        line.setAttribute('y1', String(anchor.y))
        line.setAttribute('x2', String(lineX2))
        line.setAttribute('y2', String(lineY2))
      }
    })
  }, [annotations, graph, bridge])

  const overlayRoot = document.getElementById('overlay-root')
  if (!overlayRoot) return null

  return ReactDOM.createPortal(
    <>
      <svg className={styles.svgOverlay}>
        {annotations.map((_, i) => (
          <line
            key={i}
            ref={el => { lineRefs.current[i] = el }}
            className={styles.leaderLine}
            x1="0" y1="0" x2="0" y2="0"
          />
        ))}
      </svg>
      {annotations.map((ann, i) => {
        const styleClass = ann.style ? styles[ann.style] : ''
        const icon       = ann.style ? STYLE_ICON[ann.style] : null
        return (
          <div
            key={`${ann.target}-${i}-${ann.text.slice(0, 10)}`}
            ref={el => { cardRefs.current[i] = el }}
            className={`${styles.card} ${styles[ann.type]} ${styleClass}`}
            style={{ transform: 'translate(-9999px, -9999px)', opacity: 0 }}
          >
            {icon && <span className={styles.icon}>{icon}</span>}
            {ann.text}
          </div>
        )
      })}
    </>,
    overlayRoot
  )
}
