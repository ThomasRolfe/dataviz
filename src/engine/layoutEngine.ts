import * as THREE from 'three'
import type { Component, ComponentType } from '@/types/schema'

export const CELL_SIZE      = 3.0
export const ELEVATION_UNIT = 1.5
export const COMPONENT_GAP  = 0.8

export const COMPONENT_HEIGHT: Record<ComponentType, number> = {
  client:   0.8,
  service:  1.2,
  database: 1.6,
  queue:    0.80,
  function: 0.80,
  external: 1.0,
}

export function gridToWorld(col: number, row: number, elevation = 0): THREE.Vector3 {
  return new THREE.Vector3(
    col * CELL_SIZE,
    elevation * ELEVATION_UNIT,
    row * CELL_SIZE
  )
}

export function componentCenter(c: Component): THREE.Vector3 {
  const { col, row, elevation = 0 } = c.position
  const { w = 1, h = 1 } = c.size ?? {}
  return new THREE.Vector3(
    (col + w / 2) * CELL_SIZE,
    elevation * ELEVATION_UNIT,
    (row + h / 2) * CELL_SIZE
  )
}

export function componentMeshSize(c: Component): THREE.Vector3 {
  const { w = 1, h = 1 } = c.size ?? {}
  return new THREE.Vector3(
    w * CELL_SIZE * COMPONENT_GAP,
    COMPONENT_HEIGHT[c.type],
    h * CELL_SIZE * COMPONENT_GAP
  )
}
