import * as THREE from 'three'
import type { ComponentType, ComponentShape, Step } from './schema'

export interface InternalComponent {
  id: string
  label: string
  type: ComponentType
  shape?: ComponentShape
  logo?: string
  center: THREE.Vector3
  meshSize: THREE.Vector3
  topCenter: THREE.Vector3
  meta: {
    description?: string
    file?: string
    line?: number
    notes?: string
  } | undefined
}

export interface InternalConnection {
  id: string
  from: InternalComponent
  to: InternalComponent
  label?: string
  curve: THREE.CatmullRomCurve3
  tubePoints: THREE.Vector3[]
}

export interface InternalZone {
  id: string
  label: string
  color: THREE.Color
  min: THREE.Vector3
  max: THREE.Vector3
}

export interface InternalGraph {
  components: Map<string, InternalComponent>
  connections: Map<string, InternalConnection>
  zones: InternalZone[]
  steps: Step[]
  gridBounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}
