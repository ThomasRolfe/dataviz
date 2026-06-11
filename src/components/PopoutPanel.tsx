import { useRef } from 'react'
import ReactDOM from 'react-dom'
import type { Popout } from '@/types/schema'
import type { InternalGraph } from '@/types/internal'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import styles from '@/styles/PopoutPanel.module.css'

interface PopoutPanelProps {
  popouts: Popout[]
  graph:   InternalGraph
  bridge:  OverlayBridge
}

function ValueDisplay({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <span className={styles.valueString}>"{value}"</span>
  }
  if (typeof value === 'number') {
    return <span className={styles.valueNumber}>{value}</span>
  }
  if (typeof value === 'boolean') {
    return <span className={styles.valueBoolean}>{String(value)}</span>
  }
  if (value !== null && typeof value === 'object') {
    return <span className={styles.valueObject}>{'{...}'}</span>
  }
  return <span className={styles.valueObject}>{String(value)}</span>
}

export function PopoutPanel({ popouts, graph, bridge }: PopoutPanelProps) {
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useAnimationFrame(() => {
    popouts.forEach((popout, i) => {
      const el = itemRefs.current.get(i)
      if (!el) return
      const component = graph.components.get(popout.anchor)
      if (!component) return
      const anchor = component.topCenter.clone()
      anchor.y += 0.5
      const pos = bridge.worldToScreen(anchor)
      el.style.transform = `translate(${pos.x + 20}px, ${pos.y}px)`
    })
  }, [popouts, graph, bridge])

  const overlayRoot = document.getElementById('overlay-root')
  if (!overlayRoot) return null

  return ReactDOM.createPortal(
    <>
      {popouts.map((popout, i) => (
        <div
          key={i}
          ref={el => {
            if (el) itemRefs.current.set(i, el)
            else itemRefs.current.delete(i)
          }}
          className={styles.panel}
          style={{ transform: 'translate(-9999px, -9999px)' }}
        >
          <div className={styles.title}>{popout.title}</div>
          {Object.entries(popout.data).map(([key, val]) => (
            <div key={key} className={styles.entry}>
              <span className={styles.key}>{key}</span>
              <ValueDisplay value={val} />
            </div>
          ))}
        </div>
      ))}
    </>,
    overlayRoot
  )
}
