import * as THREE from 'three'
import * as TWEEN from '@tweenjs/tween.js'
import type { InternalComponent } from '@/types/internal'
import type { ComponentType } from '@/types/schema'
import { buildShapeMeshes } from '@/scene/componentShapes'

export type MeshState = 'idle' | 'highlighted' | 'dimmed'

export const TYPE_COLOR: Record<ComponentType, number> = {
  client:   0x4a9edd,
  service:  0x5dbe8a,
  database: 0xe8a838,
  queue:    0xb06bcc,
  function: 0xe85d5d,
  external: 0x888888,
}

export const STATE_EMISSIVE: Record<MeshState, number> = {
  idle:        0x000000,
  highlighted: 0x224422,
  dimmed:      0x000000,
}

export const STATE_OPACITY: Record<MeshState, number> = {
  idle:        1.0,
  highlighted: 1.0,
  dimmed:      0.25,
}

const PENETRATED_OPACITY = 0.15

export class ComponentMesh {
  group:     THREE.Group
  hitMesh:   THREE.Mesh
  topCenter: THREE.Vector3
  id:        string

  private mat:          THREE.MeshStandardMaterial
  private edgeMesh:     THREE.LineSegments
  private currentState: MeshState = 'idle'
  private penetrated:   boolean   = false

  constructor(scene: THREE.Scene, component: InternalComponent) {
    this.id        = component.id
    this.topCenter = component.topCenter.clone()

    const { x: w, y: h, z: d } = component.meshSize

    // Group sits with its origin at the component's vertical midpoint
    this.group = new THREE.Group()
    this.group.position.set(
      component.center.x,
      component.center.y + h / 2,
      component.center.z,
    )

    // Shared material — all visual meshes use this so transitions apply uniformly
    this.mat = new THREE.MeshStandardMaterial({
      color:       TYPE_COLOR[component.type],
      transparent: true,
      opacity:     STATE_OPACITY['idle'],
    })

    // Visual meshes centered at group origin (y spans -h/2 → +h/2)
    const visualMeshes = buildShapeMeshes(component.type, component.shape, component.meshSize, this.mat)
    for (const m of visualMeshes) {
      m.castShadow    = true
      m.receiveShadow = true
      this.group.add(m)
    }

    // Invisible hit box for raycasting — full bounding box, no render
    this.hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    this.hitMesh.userData.componentId = component.id
    this.group.add(this.hitMesh)

    // Edge outline — bounding-box shape works for all component shapes
    this.edgeMesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
      new THREE.LineBasicMaterial({ color: TYPE_COLOR[component.type] }),
    )
    this.edgeMesh.visible = false
    this.group.add(this.edgeMesh)

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
            this.mat.opacity     = opacity
            this.mat.transparent = opacity < 1.0
          }
          this.mat.emissive.setRGB(r, g, b)
        })
        .onComplete(() => resolve())
        .start()
    })
  }

  // Called from FlowScene.onFrame — runs after TWEEN.update() so always wins.
  setPenetrated(penetrated: boolean): void {
    if (this.penetrated === penetrated) return
    this.penetrated = penetrated
    if (penetrated) {
      this.mat.opacity      = PENETRATED_OPACITY
      this.mat.transparent  = true
      this.edgeMesh.visible = true
    } else {
      this.mat.opacity      = STATE_OPACITY[this.currentState]
      this.mat.transparent  = this.mat.opacity < 1.0
      this.edgeMesh.visible = false
    }
  }

  addToRaycastTargets(targets: THREE.Object3D[]): void {
    targets.push(this.hitMesh)
  }

  removeFromRaycastTargets(targets: THREE.Object3D[]): void {
    const idx = targets.indexOf(this.hitMesh)
    if (idx !== -1) targets.splice(idx, 1)
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group)
    this.hitMesh.geometry.dispose()
    ;(this.hitMesh.material as THREE.Material).dispose()
    this.edgeMesh.geometry.dispose()
    ;(this.edgeMesh.material as THREE.Material).dispose()
    this.mat.dispose()
    for (const child of this.group.children) {
      if (child instanceof THREE.Mesh && child !== this.hitMesh) {
        child.geometry.dispose()
      }
    }
  }
}
