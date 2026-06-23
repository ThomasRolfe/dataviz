import * as THREE from 'three'
import type { ComponentType, ComponentShape, Step } from './schema'

export interface InternalComponent {
  id: string
  label: string
  type: ComponentType
  shape?: ComponentShape
  logo?: string
  icon?: string
  color?: string
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
  curve: THREE.Curve<THREE.Vector3>
  tubePoints: THREE.Vector3[]
  /** t-range [t0, t1] used for the visible TubeGeometry — clipped to component edges */
  renderTrim: { t0: number; t1: number }
}

export interface InternalZone {
  id: string
  label: string
  color: THREE.Color
  min: THREE.Vector3
  max: THREE.Vector3
  parentId?: string
  outline: 'solid' | 'dashed'
  depth: number
  meta?: { description?: string; notes?: string }
}

export interface InternalGraph {
  components: Map<string, InternalComponent>
  connections: Map<string, InternalConnection>
  zones: InternalZone[]
  steps: Step[]
  gridBounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}
