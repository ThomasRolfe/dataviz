import * as THREE from 'three'
import * as TWEEN from '@tweenjs/tween.js'
import type { PacketShape } from '@/types/schema'

const PACKET_COLOR = 0x00ffcc

function buildPacketMesh(shape: PacketShape): THREE.Mesh {
  let geometry: THREE.BufferGeometry

  switch (shape) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(0.35, 16, 8)
      break
    case 'document':
      geometry = new THREE.BoxGeometry(0.65, 0.12, 0.45)
      break
    case 'token':
      geometry = new THREE.CylinderGeometry(0.28, 0.28, 0.09, 16)
      break
    case 'blob': {
      const blobGeo = new THREE.SphereGeometry(0.38, 8, 6)
      blobGeo.scale(1.0, 0.7, 0.9)
      geometry = blobGeo
      break
    }
    case 'envelope':
      geometry = new THREE.BoxGeometry(0.60, 0.09, 0.42)
      break
  }

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color:             PACKET_COLOR,
      emissive:          new THREE.Color(PACKET_COLOR),
      emissiveIntensity: 1.0,
      metalness:         0.2,
      roughness:         0.1,
    })
  )
}

export class DataPacket {
  mesh: THREE.Mesh

  constructor(scene: THREE.Scene, shape: PacketShape) {
    this.mesh = buildPacketMesh(shape)
    scene.add(this.mesh)
  }

  travel(curve: THREE.CatmullRomCurve3, durationMs: number): Promise<void> {
    return new Promise(resolve => {
      const target = { t: 0 }
      new TWEEN.Tween(target)
        .to({ t: 1 }, durationMs)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
          const pos = curve.getPointAt(target.t)
          this.mesh.position.copy(pos)

          const tangent = curve.getTangentAt(target.t)
          this.mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            tangent.normalize()
          )

          // Gentle spin
          this.mesh.rotation.z += 0.02
        })
        .onComplete(() => resolve())
        .start()
    })
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
