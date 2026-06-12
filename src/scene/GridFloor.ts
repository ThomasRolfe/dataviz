import * as THREE from 'three'
import type { InternalGraph } from '@/types/internal'
import { CELL_SIZE } from '@/engine/layoutEngine'
import { THEME_COLORS } from '@/scene/ThemeColors'
import type { Theme } from '@/scene/ThemeColors'

export class GridFloor {
  private mesh:      THREE.GridHelper
  private size:      number
  private divisions: number
  private center:    THREE.Vector3

  constructor(scene: THREE.Scene, graph: InternalGraph) {
    const { minX, maxX, minZ, maxZ } = graph.gridBounds
    const sizeX = maxX - minX
    const sizeZ = maxZ - minZ
    this.size      = Math.max(sizeX, sizeZ) + CELL_SIZE * 2
    this.divisions = Math.round(this.size / CELL_SIZE)
    this.center    = new THREE.Vector3((minX + maxX) / 2, -0.15, (minZ + maxZ) / 2)

    const { gridPrimary, gridSecondary } = THEME_COLORS['dark']
    this.mesh = new THREE.GridHelper(this.size, this.divisions, gridPrimary, gridSecondary)
    this.mesh.position.copy(this.center)
    scene.add(this.mesh)
  }

  setTheme(theme: Theme, scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()

    const { gridPrimary, gridSecondary } = THEME_COLORS[theme]
    this.mesh = new THREE.GridHelper(this.size, this.divisions, gridPrimary, gridSecondary)
    this.mesh.position.copy(this.center)
    scene.add(this.mesh)
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
