import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { SceneManager } from '@/scene/SceneManager'
import { setupLighting } from '@/scene/LightingSetup'
import { OverlayBridge } from '@/scene/OverlayBridge'

interface CanvasContainerProps {
  onSceneReady?: (sm: SceneManager, bridge: OverlayBridge) => void
}

export function CanvasContainer({ onSceneReady }: CanvasContainerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef  = useRef<SceneManager | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const sm = new SceneManager(canvasRef.current)
    sceneRef.current = sm
    setupLighting(sm.scene)

    // Debug cube at origin to verify isometric camera angle
    const debugCube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff4444 })
    )
    sm.scene.add(debugCube)

    sm.startLoop()

    const bridge = new OverlayBridge(sm.camera, sm.renderer)
    onSceneReady?.(sm, bridge)

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      sm.resize(width, height)
    })
    ro.observe(canvasRef.current.parentElement!)

    return () => {
      sm.stopLoop()
      sm.dispose()
      ro.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <div id="overlay-root" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
    </div>
  )
}
