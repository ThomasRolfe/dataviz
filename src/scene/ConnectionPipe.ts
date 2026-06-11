import * as THREE from 'three'
import * as TWEEN from '@tweenjs/tween.js'
import type { InternalConnection } from '@/types/internal'

const TUBE_SEGMENTS    = 64
const TUBE_RADIUS      = 0.06
const TUBE_RADIUS_SEGS = 8

const IDLE_COLOR    = 0x334455
const ACTIVE_COLOR  = 0x4a6a8a
const ACTIVE_EMISSIVE = 0x1a3a5c

export class ConnectionPipe {
  mesh:     THREE.Mesh
  curve:    THREE.CatmullRomCurve3
  id:       string
  midpoint: THREE.Vector3

  constructor(scene: THREE.Scene, connection: InternalConnection) {
    this.id    = connection.id
    this.curve = connection.curve

    const geo = new THREE.TubeGeometry(
      connection.curve,
      TUBE_SEGMENTS,
      TUBE_RADIUS,
      TUBE_RADIUS_SEGS,
      false
    )
    const mat = new THREE.MeshStandardMaterial({
      color:       IDLE_COLOR,
      transparent: true,
      opacity:     0.35,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.castShadow    = true
    this.mesh.receiveShadow = true
    scene.add(this.mesh)

    this.midpoint = connection.curve.getPointAt(0.5)
  }

  setActive(active: boolean, durationMs: number): Promise<void> {
    return new Promise(resolve => {
      const mat = this.mesh.material as THREE.MeshStandardMaterial
      const targetColor    = new THREE.Color(active ? ACTIVE_COLOR : IDLE_COLOR)
      const targetOpacity  = active ? 1.0 : 0.35
      const targetEmissive = new THREE.Color(active ? ACTIVE_EMISSIVE : 0x000000)

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
          mat.opacity = opacity
          mat.transparent = opacity < 1.0
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
