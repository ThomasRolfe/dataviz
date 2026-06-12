import * as THREE from 'three'
import type { PacketShape } from '@/types/schema'
import { THEME_COLORS } from '@/scene/ThemeColors'
import type { Theme } from '@/scene/ThemeColors'

function buildPacketMesh(shape: PacketShape, color: number): THREE.Mesh {
  let geometry: THREE.BufferGeometry

  switch (shape) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(0.35, 16, 8)
      break
    case 'document':
      geometry = new THREE.BoxGeometry(0.65, 0.45, 0.12)
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
      geometry = new THREE.BoxGeometry(0.60, 0.42, 0.09)
      break
  }

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      emissive:          new THREE.Color(color),
      emissiveIntensity: 1.5,
      metalness:         0.2,
      roughness:         0.1,
    })
  )
}

export class DataPacket {
  mesh:         THREE.Mesh
  arrived:      boolean = false
  private curve:     THREE.CatmullRomCurve3 | null = null
  private startTime: number = -1
  private duration:  number = 0
  private onDone:    (() => void) | null = null

  constructor(scene: THREE.Scene, shape: PacketShape, theme: Theme = 'dark') {
    this.mesh = buildPacketMesh(shape, THEME_COLORS[theme].packetColor)
    scene.add(this.mesh)
  }

  setTheme(theme: Theme): void {
    const color = THEME_COLORS[theme].packetColor
    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.color.setHex(color)
    mat.emissive.setHex(color)
  }

  travel(curve: THREE.CatmullRomCurve3, durationMs: number): Promise<void> {
    this.curve     = curve
    this.duration  = durationMs
    this.startTime = performance.now()
    this.arrived   = false
    this.mesh.position.copy(curve.getPointAt(0))
    return new Promise(resolve => { this.onDone = resolve })
  }

  // Called every frame from FlowScene.onFrame. No-op once arrived.
  update(now: number): void {
    if (!this.curve || this.startTime < 0 || this.arrived) return

    const elapsed = now - this.startTime
    const raw     = Math.min(elapsed / this.duration, 1)
    // Quadratic ease-in-out
    const t = raw < 0.5 ? 2 * raw * raw : -1 + (4 - 2 * raw) * raw

    const pos = this.curve.getPointAt(t)
    this.mesh.position.copy(pos)

    const tangent = this.curve.getTangentAt(t)
    if (tangent.lengthSq() > 0) {
      this.mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        tangent.normalize()
      )
    }

    if (raw >= 1) {
      this.arrived = true
      this.onDone?.()
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
