import * as THREE from 'three'
import type { InternalGraph } from '@/types/internal'
import { CELL_SIZE } from '@/engine/layoutEngine'

export class GridFloor {
  private mesh: THREE.GridHelper

  constructor(scene: THREE.Scene, graph: InternalGraph) {
    const { minX, maxX, minZ, maxZ } = graph.gridBounds
    const sizeX = maxX - minX
    const sizeZ = maxZ - minZ
    const size  = Math.max(sizeX, sizeZ) + CELL_SIZE * 2

    const divisions = Math.round(size / CELL_SIZE)
    this.mesh = new THREE.GridHelper(size, divisions, 0x334455, 0x223344)
    this.mesh.position.set(
      (minX + maxX) / 2,
      -0.15,
      (minZ + maxZ) / 2
    )
    scene.add(this.mesh)
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
  }
}
