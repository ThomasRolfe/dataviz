import { useRef } from 'react'
import ReactDOM from 'react-dom'
import * as THREE from 'three'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'

interface ZoneLabelData {
  label:    string
  position: THREE.Vector3
  color:    string
}

interface ZoneLabelsProps {
  zones:  ZoneLabelData[]
  bridge: OverlayBridge
}

export function ZoneLabels({ zones, bridge }: ZoneLabelsProps) {
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useAnimationFrame(() => {
    zones.forEach((zone, i) => {
      const el = itemRefs.current.get(i)
      if (!el) return
      const pos = bridge.worldToScreen(zone.position)
      // Anchor the label's right edge and vertical midpoint at the corner
      el.style.transform = `translate(calc(${pos.x}px - 100%), calc(${pos.y}px - 50%))`
    })
  }, [zones, bridge])

  const overlayRoot = document.getElementById('overlay-root')
  if (!overlayRoot) return null

  return ReactDOM.createPortal(
    <>
      {zones.map((zone, i) => (
        <div
          key={zone.label}
          ref={el => {
            if (el) itemRefs.current.set(i, el)
            else itemRefs.current.delete(i)
          }}
          style={{
            position:        'absolute',
            top:             0,
            left:            0,
            transform:       'translate(-9999px, -9999px)',
            color:           zone.color,
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            border:          `1.5px solid ${zone.color}`,
            borderRadius:    '0.25rem',
            padding:         '2px 8px',
            fontSize:        '0.68rem',
            fontWeight:      700,
            letterSpacing:   '0.1em',
            textTransform:   'uppercase',
            whiteSpace:      'nowrap',
            pointerEvents:   'none',
            userSelect:      'none',
          }}
        >
          {zone.label}
        </div>
      ))}
    </>,
    overlayRoot
  )
}
