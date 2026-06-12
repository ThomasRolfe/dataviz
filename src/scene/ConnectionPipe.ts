import * as THREE from 'three'
import * as TWEEN from '@tweenjs/tween.js'
import type { InternalConnection } from '@/types/internal'
import { THEME_COLORS } from '@/scene/ThemeColors'
import type { Theme } from '@/scene/ThemeColors'

const TUBE_SEGMENTS    = 64
const TUBE_RADIUS      = 0.06
const TUBE_RADIUS_SEGS = 8

const OPACITY_IDLE       = 0.20
const OPACITY_ACTIVE     = 0.45
const OPACITY_TRAVERSING = 1.00

export class ConnectionPipe {
  mesh:     THREE.Mesh
  curve:    THREE.Curve<THREE.Vector3>
  id:       string
  midpoint: THREE.Vector3

  private idleColor:         number
  private activeColor:       number
  private activeEmissive:    number
  private currentActive:     boolean = false
  private packetTraversing:  boolean = false

  constructor(scene: THREE.Scene, connection: InternalConnection) {
    this.id    = connection.id
    this.curve = connection.curve

    const c = THEME_COLORS['light']
    this.idleColor      = c.pipeIdle
    this.activeColor    = c.pipeActive
    this.activeEmissive = c.pipeActiveEmissive

    const geo = new THREE.TubeGeometry(
      connection.curve,
      TUBE_SEGMENTS,
      TUBE_RADIUS,
      TUBE_RADIUS_SEGS,
      false
    )
    const mat = new THREE.MeshStandardMaterial({
      color:       this.idleColor,
      transparent: true,
      opacity:     OPACITY_IDLE,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.castShadow    = true
    this.mesh.receiveShadow = true
    scene.add(this.mesh)

    this.midpoint = connection.curve.getPointAt(0.5)
  }

  setTheme(theme: Theme): void {
    const c = THEME_COLORS[theme]
    this.idleColor      = c.pipeIdle
    this.activeColor    = c.pipeActive
    this.activeEmissive = c.pipeActiveEmissive

    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.color.setHex(this.packetTraversing || this.currentActive ? this.activeColor : this.idleColor)
    mat.emissive.setHex(this.packetTraversing ? this.activeEmissive : 0x000000)
    mat.opacity = this.packetTraversing ? OPACITY_TRAVERSING
                : this.currentActive    ? OPACITY_ACTIVE
                :                         OPACITY_IDLE
  }

  setActive(active: boolean, durationMs: number): Promise<void> {
    this.currentActive = active
    return this.tweenTo(durationMs)
  }

  setPacketTraversing(traversing: boolean, durationMs: number): void {
    this.packetTraversing = traversing
    this.tweenTo(durationMs)
  }

  private tweenTo(durationMs: number): Promise<void> {
    const mat = this.mesh.material as THREE.MeshStandardMaterial

    const targetOpacity  = this.packetTraversing ? OPACITY_TRAVERSING
                         : this.currentActive    ? OPACITY_ACTIVE
                         :                         OPACITY_IDLE
    const targetColor    = new THREE.Color(
      this.packetTraversing || this.currentActive ? this.activeColor : this.idleColor
    )
    const targetEmissive = new THREE.Color(
      this.packetTraversing ? this.activeEmissive : 0x000000
    )

    return new Promise(resolve => {
      new TWEEN.Tween({
        r:       mat.color.r,
        g:       mat.color.g,
        b:       mat.color.b,
        opacity: mat.opacity,
        er:      mat.emissive.r,
        eg:      mat.emissive.g,
        eb:      mat.emissive.b,
      })
        .to({
          r:       targetColor.r,
          g:       targetColor.g,
          b:       targetColor.b,
          opacity: targetOpacity,
          er:      targetEmissive.r,
          eg:      targetEmissive.g,
          eb:      targetEmissive.b,
        }, durationMs)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(({ r, g, b, opacity, er, eg, eb }) => {
          mat.color.setRGB(r, g, b)
          mat.opacity      = opacity
          mat.transparent  = opacity < 1.0
          mat.emissive.setRGB(er, eg, eb)
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
