import type { DependencyList } from 'react'
import type * as THREE from 'three'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'

// Calls onUpdate(x, y) every animation frame with the element's screen position.
// getPos is called each frame — return null to skip the update.
export function useWorldToScreen(
  bridge: OverlayBridge | null,
  getPos: () => THREE.Vector3 | null,
  onUpdate: (x: number, y: number) => void,
  deps: DependencyList = [],
): void {
  useAnimationFrame(() => {
    if (!bridge) return
    const pos = getPos()
    if (!pos) return
    const screen = bridge.worldToScreen(pos)
    onUpdate(screen.x, screen.y)
  }, [bridge, onUpdate, ...deps])
}
