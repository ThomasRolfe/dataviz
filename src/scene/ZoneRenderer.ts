import * as THREE from 'three'
import type { InternalZone } from '@/types/internal'

export class ZoneRenderer {
  private fillMesh:   THREE.Mesh
  private borderMesh: THREE.LineSegments
  labelPosition:      THREE.Vector3

  constructor(scene: THREE.Scene, zone: InternalZone) {
    const width = zone.max.x - zone.min.x
    const depth = zone.max.z - zone.min.z

    const geometry = new THREE.PlaneGeometry(width, depth)
    geometry.rotateX(-Math.PI / 2)

    const fill = new THREE.MeshStandardMaterial({
      color:      zone.color,
      transparent: true,
      opacity:     0.12,
      depthWrite:  false,
    })
    this.fillMesh = new THREE.Mesh(geometry, fill)
    this.fillMesh.position.set(
      (zone.min.x + zone.max.x) / 2,
      -0.08,
      (zone.min.z + zone.max.z) / 2
    )
    this.fillMesh.receiveShadow = true
    scene.add(this.fillMesh)

    // Border
    const edges = new THREE.EdgesGeometry(geometry)
    this.borderMesh = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: zone.color, opacity: 0.6, transparent: true })
    )
    this.borderMesh.position.copy(this.fillMesh.position)
    this.borderMesh.position.y += 0.01
    scene.add(this.borderMesh)

    // Label anchor: top-right corner of the zone boundary
    this.labelPosition = new THREE.Vector3(zone.max.x - 0.5, 0.2, zone.min.z + 0.5)
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.fillMesh)
    scene.remove(this.borderMesh)
    this.fillMesh.geometry.dispose()
    ;(this.fillMesh.material as THREE.Material).dispose()
    this.borderMesh.geometry.dispose()
    ;(this.borderMesh.material as THREE.Material).dispose()
  }
}
