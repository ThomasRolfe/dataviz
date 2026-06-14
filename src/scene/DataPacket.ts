import * as THREE from 'three'
import * as TWEEN from '@tweenjs/tween.js'
import type { PacketShape, ArrivalStyle } from '@/types/schema'
import { buildPacketGeometry } from '@/scene/shapeRegistry'
import { THEME_COLORS } from '@/scene/ThemeColors'
import type { Theme } from '@/scene/ThemeColors'

const ARRIVAL_COLORS: Record<ArrivalStyle, number> = {
  error:   0xff4444,
  success: 0x44ee88,
  warning: 0xffaa22,
}

export class DataPacket {
  mesh:         THREE.Mesh
  arrived:      boolean = false
  reversed:     boolean = false
  private curve:        THREE.Curve<THREE.Vector3> | null = null
  private startTime:    number = -1
  private duration:     number = 0
  private onDone:       (() => void) | null = null
  private arrivalColor: number | null = null

  constructor(scene: THREE.Scene, shape: PacketShape, theme: Theme = 'dark') {
    const color = THEME_COLORS[theme].packetColor
    this.mesh = new THREE.Mesh(
      buildPacketGeometry(shape),
      new THREE.MeshStandardMaterial({
        color,
        emissive:          new THREE.Color(color),
        emissiveIntensity: 1.5,
        metalness:         0.2,
        roughness:         0.1,
      })
    )
    scene.add(this.mesh)
  }

  setArrivalStyle(style: ArrivalStyle): void {
    this.arrivalColor = ARRIVAL_COLORS[style]
  }

  setTheme(theme: Theme): void {
    // Don't override arrival color once packet has landed
    if (this.arrived && this.arrivalColor !== null) return
    const color = THEME_COLORS[theme].packetColor
    const mat   = this.mesh.material as THREE.MeshStandardMaterial
    mat.color.setHex(color)
    mat.emissive.setHex(color)
  }

  travel(curve: THREE.Curve<THREE.Vector3>, durationMs: number, reversed = false): Promise<void> {
    this.curve     = curve
    this.duration  = durationMs
    this.reversed  = reversed
    this.startTime = performance.now()
    this.arrived   = false
    this.mesh.position.copy(curve.getPointAt(reversed ? 1 : 0))
    return new Promise(resolve => { this.onDone = resolve })
  }

  update(now: number): void {
    if (!this.curve || this.startTime < 0 || this.arrived) return

    const elapsed = now - this.startTime
    const raw     = Math.min(elapsed / this.duration, 1)
    const eased   = raw < 0.5 ? 2 * raw * raw : -1 + (4 - 2 * raw) * raw
    const t       = this.reversed ? 1 - eased : eased

    const pos = this.curve.getPointAt(t)
    this.mesh.position.copy(pos)

    const tangent = this.curve.getTangentAt(t)
    if (tangent.lengthSq() > 0) {
      const dir = this.reversed ? tangent.negate() : tangent
      this.mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize()
      )
    }

    if (raw >= 1) {
      this.arrived = true
      if (this.arrivalColor !== null) {
        const mat    = this.mesh.material as THREE.MeshStandardMaterial
        const target = new THREE.Color(this.arrivalColor)
        new TWEEN.Tween({ r: mat.color.r, g: mat.color.g, b: mat.color.b })
          .to({ r: target.r, g: target.g, b: target.b }, 400)
          .easing(TWEEN.Easing.Quadratic.Out)
          .onUpdate(({ r, g, b }) => {
            mat.color.setRGB(r, g, b)
            mat.emissive.setRGB(r * 0.6, g * 0.6, b * 0.6)
          })
          .start()
      }
      this.onDone?.()
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
