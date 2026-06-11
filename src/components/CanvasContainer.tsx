import { useRef, useEffect } from 'react'
import { FlowScene } from '@/scene/FlowScene'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import type { InternalGraph } from '@/types/internal'

interface CanvasContainerProps {
  graph:         InternalGraph
  onSceneReady?: (scene: FlowScene, bridge: OverlayBridge) => void
}

export function CanvasContainer({ graph, onSceneReady }: CanvasContainerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef  = useRef<FlowScene | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const scene = new FlowScene(canvasRef.current, graph)
    sceneRef.current = scene

    onSceneReady?.(scene, scene.overlayBridge)

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      scene.resize(width, height)
    })
    ro.observe(canvasRef.current.parentElement!)

    return () => {
      scene.dispose()
      ro.disconnect()
      sceneRef.current = null
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
