import * as THREE from 'three'
import * as TWEEN from '@tweenjs/tween.js'
import type { InternalComponent } from '@/types/internal'
import type { ComponentType } from '@/types/schema'
import { buildShapeMeshes } from '@/scene/shapeRegistry'
import { buildLogoMeshes } from '@/scene/LogoMesh'
import type { ComponentMeshUserData } from '@/scene/meshUserData'

export type MeshState = 'idle' | 'highlighted' | 'dimmed'

export const TYPE_COLOR: Record<ComponentType, number> = {
  client:   0x1e88e5,
  service:  0x43a047,
  database: 0xf57c00,
  queue:    0x8e24aa,
  function: 0xe53935,
  external: 0x546e7a,
}

export const STATE_EMISSIVE: Record<MeshState, number> = {
  idle:        0x000000,
  highlighted: 0x1a2a3a,
  dimmed:      0x000000,
}

export const STATE_OPACITY: Record<MeshState, number> = {
  idle:        1.0,
  highlighted: 1.0,
  dimmed:      0.25,
}

const PENETRATED_OPACITY = 0.30

export class ComponentMesh {
  group:     THREE.Group
  hitMesh:   THREE.Mesh
  topCenter: THREE.Vector3
  id:        string

  private mat:          THREE.MeshStandardMaterial
  private iconMat:      THREE.MeshBasicMaterial
  private currentState: MeshState = 'idle'
  private penetrated:   boolean   = false

  constructor(scene: THREE.Scene, component: InternalComponent) {
    this.id        = component.id
    this.topCenter = component.topCenter.clone()

    const { x: w, y: h, z: d } = component.meshSize

    this.group = new THREE.Group()
    this.group.position.set(
      component.center.x,
      component.center.y + h / 2,
      component.center.z,
    )

    // Box/shape material — component colour, drives all opacity/emissive transitions
    this.mat = new THREE.MeshStandardMaterial({
      color:       component.color ? new THREE.Color(component.color) : TYPE_COLOR[component.type],
      transparent: true,
      opacity:     STATE_OPACITY['idle'],
    })

    // Icon face material — always white so the SVG reads against the coloured box
    this.iconMat = new THREE.MeshBasicMaterial({
      color:       0xffffff,
      transparent: true,
      opacity:     STATE_OPACITY['idle'],
    })

    const visualMeshes = component.logo
      ? buildLogoMeshes(component.logo, component.meshSize, this.mat, this.iconMat)
      : buildShapeMeshes(component.type, component.shape, component.meshSize, this.mat, this.iconMat)
    for (const m of visualMeshes) {
      m.castShadow    = true
      m.receiveShadow = true
      this.group.add(m)
    }

    // Invisible hit box for raycasting
    this.hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    this.hitMesh.userData = { componentId: component.id } satisfies ComponentMeshUserData
    this.group.add(this.hitMesh)

    scene.add(this.group)
  }

  transitionTo(state: MeshState, durationMs: number): Promise<void> {
    this.currentState = state
    return new Promise(resolve => {
      const targetOpacity  = STATE_OPACITY[state]
      const targetEmissive = new THREE.Color(STATE_EMISSIVE[state])

      new TWEEN.Tween({
        opacity: this.mat.opacity,
        r:       this.mat.emissive.r,
        g:       this.mat.emissive.g,
        b:       this.mat.emissive.b,
      })
        .to({ opacity: targetOpacity, r: targetEmissive.r, g: targetEmissive.g, b: targetEmissive.b }, durationMs)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(({ opacity, r, g, b }) => {
          if (!this.penetrated) {
            this.mat.opacity      = opacity
            this.mat.transparent  = opacity < 1.0
            this.iconMat.opacity  = opacity
          }
          this.mat.emissive.setRGB(r, g, b)
        })
        .onComplete(() => resolve())
        .start()
    })
  }

  setPenetrated(penetrated: boolean): void {
    if (this.penetrated === penetrated) return
    this.penetrated = penetrated
    if (penetrated) {
      this.mat.opacity     = PENETRATED_OPACITY
      this.mat.transparent = true
      this.iconMat.opacity = PENETRATED_OPACITY
    } else {
      this.mat.opacity     = STATE_OPACITY[this.currentState]
      this.mat.transparent = this.mat.opacity < 1.0
      this.iconMat.opacity = STATE_OPACITY[this.currentState]
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group)
    this.hitMesh.geometry.dispose()
    ;(this.hitMesh.material as THREE.Material).dispose()
    this.mat.dispose()
    this.iconMat.dispose()
    for (const child of this.group.children) {
      if (child instanceof THREE.Mesh && child !== this.hitMesh) {
        child.geometry.dispose()
      }
    }
  }
}
