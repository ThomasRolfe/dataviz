import { useRef } from 'react'
import ReactDOM from 'react-dom'
import type { FlowScene } from '@/scene/FlowScene'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import styles from '@/styles/PacketTooltip.module.css'

interface PacketTooltipProps {
  scene:     FlowScene
  bridge:    OverlayBridge
  hoveredId: string
}

export function PacketTooltip({ scene, bridge, hoveredId }: PacketTooltipProps) {
  const divRef   = useRef<HTMLDivElement | null>(null)
  const labelRef = useRef<HTMLElement | null>(null)
  const shapeRef = useRef<HTMLSpanElement | null>(null)
  const dataRef  = useRef<HTMLPreElement | null>(null)

  useAnimationFrame(() => {
    const mesh = scene.getPacketMesh(hoveredId)
    if (!divRef.current || !mesh) return

    const label = mesh.userData.packetLabel as string | undefined
    const shape = mesh.userData.packetShape as string | undefined
    const data  = mesh.userData.packetData  as Record<string, unknown> | undefined

    if (labelRef.current) labelRef.current.textContent = label ?? ''
    if (shapeRef.current) shapeRef.current.textContent = shape ?? ''
    if (dataRef.current)  dataRef.current.textContent  = data ? JSON.stringify(data, null, 2) : '(no payload)'

    const pos = bridge.worldToScreen(mesh.position)
    divRef.current.style.transform = `translate(calc(${pos.x}px - 50%), calc(${pos.y}px - 100% - 16px))`
  }, [scene, bridge])

  const overlayRoot = document.getElementById('overlay-root')
  if (!overlayRoot) return null

  return ReactDOM.createPortal(
    <div
      ref={divRef}
      className={styles.tooltip}
      style={{ transform: 'translate(-9999px, -9999px)' }}
    >
      <strong ref={labelRef as React.RefObject<HTMLElement>} />
      <span ref={shapeRef} className={styles.shape} />
      <pre ref={dataRef} className={styles.payload} />
    </div>,
    overlayRoot
  )
}
