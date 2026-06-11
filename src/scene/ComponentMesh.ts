import * as THREE from 'three'
import * as TWEEN from '@tweenjs/tween.js'
import type { InternalComponent } from '@/types/internal'
import type { ComponentType } from '@/types/schema'

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

function buildGeometry(type: ComponentType, size: THREE.Vector3): THREE.BufferGeometry {
  const { x: w, y: h, z: d } = size
  switch (type) {
    case 'client':
      return new THREE.BoxGeometry(w, h, d)
    case 'service':
      return new THREE.BoxGeometry(w, h, d)
    case 'database':
      return new THREE.CylinderGeometry(w / 2, w / 2, h, 24)
    case 'queue':
      return new THREE.BoxGeometry(w, h * 0.5, d)
    case 'function':
      return new THREE.OctahedronGeometry(Math.min(w, d) * 0.45)
    case 'external':
      return new THREE.BoxGeometry(w, h, d)
  }
}

export class ComponentMesh {
  mesh:      THREE.Mesh
  topCenter: THREE.Vector3
  id:        string

  constructor(scene: THREE.Scene, component: InternalComponent) {
    this.id        = component.id
    this.topCenter = component.topCenter.clone()

    const geo = buildGeometry(component.type, component.meshSize)
    const mat = new THREE.MeshStandardMaterial({
      color:       TYPE_COLOR[component.type],
      transparent: true,
      opacity:     STATE_OPACITY['idle'],
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.copy(component.center)
    this.mesh.position.y += component.meshSize.y / 2  // sit bottom face on ground
    this.mesh.castShadow    = true
    this.mesh.receiveShadow = true
    this.mesh.userData.componentId = component.id
    scene.add(this.mesh)
  }

  transitionTo(state: MeshState, durationMs: number): Promise<void> {
    return new Promise(resolve => {
      const mat            = this.mesh.material as THREE.MeshStandardMaterial
      const targetOpacity  = STATE_OPACITY[state]
      const targetEmissive = new THREE.Color(STATE_EMISSIVE[state])

      new TWEEN.Tween({
        opacity: mat.opacity,
        r:       mat.emissive.r,
        g:       mat.emissive.g,
        b:       mat.emissive.b,
      })
        .to({ opacity: targetOpacity, r: targetEmissive.r, g: targetEmissive.g, b: targetEmissive.b }, durationMs)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(({ opacity, r, g, b }) => {
          mat.opacity = opacity
          mat.transparent = opacity < 1.0
          mat.emissive.setRGB(r, g, b)
        })
        .onComplete(() => resolve())
        .start()
    })
  }

  addToRaycastTargets(targets: THREE.Object3D[]): void {
    targets.push(this.mesh)
  }

  removeFromRaycastTargets(targets: THREE.Object3D[]): void {
    const idx = targets.indexOf(this.mesh)
    if (idx !== -1) targets.splice(idx, 1)
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
