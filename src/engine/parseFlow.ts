import * as THREE from 'three'
import type { FlowDefinition, Component, Connection } from '@/types/schema'
import type { InternalGraph, InternalComponent, InternalConnection, InternalZone } from '@/types/internal'
import { componentCenter, componentMeshSize, gridToWorld, CELL_SIZE } from '@/engine/layoutEngine'

export const PIPE_HEIGHT = 0.5

function assertString(val: unknown, field: string): string {
  if (typeof val !== 'string') throw new Error(`${field} must be a string`)
  return val
}

function assertNumber(val: unknown, field: string): number {
  if (typeof val !== 'number') throw new Error(`${field} must be a number`)
  return val
}

function assertArray(val: unknown, field: string): unknown[] {
  if (!Array.isArray(val)) throw new Error(`${field} must be an array`)
  return val
}

function assertObject(val: unknown, field: string): Record<string, unknown> {
  if (typeof val !== 'object' || val === null || Array.isArray(val))
    throw new Error(`${field} must be an object`)
  return val as Record<string, unknown>
}

const VALID_COMPONENT_TYPES   = new Set(['client', 'service', 'database', 'queue', 'function', 'external'])
const VALID_COMPONENT_SHAPES  = new Set(['stack', 'cloud', 'server', 'desktop', 'smartphone', 'router', 'deskphone', 'wall'])
const VALID_PACKET_SHAPES     = new Set(['sphere', 'document', 'token', 'blob', 'envelope'])
const VALID_ANNOTATION_TYPES  = new Set(['callout', 'transform'])
const VALID_ANNOTATION_STYLES = new Set(['info', 'success', 'warning', 'error'])
const VALID_ARRIVAL_STYLES    = new Set(['error', 'success', 'warning'])

export function validateFlow(raw: unknown): FlowDefinition {
  const r = assertObject(raw, 'root')

  const meta = assertObject(r['meta'], 'meta')
  assertString(meta['title'], 'meta.title')

  const layout = assertObject(r['layout'], 'layout')
  const grid = assertObject(layout['grid'], 'layout.grid')
  assertNumber(grid['cols'], 'layout.grid.cols')
  assertNumber(grid['rows'], 'layout.grid.rows')

  const zones = assertArray(r['zones'], 'zones')
  for (const z of zones) {
    const zone = assertObject(z, 'zone')
    assertString(zone['id'], 'zone.id')
    assertString(zone['label'], 'zone.label')
    assertString(zone['color'], 'zone.color')
    const bounds = assertObject(zone['bounds'], 'zone.bounds')
    assertNumber(bounds['col'], 'zone.bounds.col')
    assertNumber(bounds['row'], 'zone.bounds.row')
    assertNumber(bounds['width'], 'zone.bounds.width')
    assertNumber(bounds['height'], 'zone.bounds.height')
  }

  const components = assertArray(r['components'], 'components')
  const componentIds = new Set<string>()
  for (const c of components) {
    const comp = assertObject(c, 'component')
    const id = assertString(comp['id'], 'component.id')
    assertString(comp['label'], 'component.label')
    const type = assertString(comp['type'], 'component.type')
    if (!VALID_COMPONENT_TYPES.has(type)) throw new Error(`Invalid component type: ${type}`)
    if (comp['shape'] !== undefined) {
      const shape = assertString(comp['shape'], 'component.shape')
      if (!VALID_COMPONENT_SHAPES.has(shape)) throw new Error(`Invalid component shape: ${shape}`)
    }
    const pos = assertObject(comp['position'], 'component.position')
    assertNumber(pos['col'], 'component.position.col')
    assertNumber(pos['row'], 'component.position.row')
    componentIds.add(id)
  }

  const connections = assertArray(r['connections'], 'connections')
  const connectionIds = new Set<string>()
  for (const c of connections) {
    const conn = assertObject(c, 'connection')
    const id = assertString(conn['id'], 'connection.id')
    const from = assertString(conn['from'], 'connection.from')
    const to = assertString(conn['to'], 'connection.to')
    if (!componentIds.has(from)) throw new Error(`connection.from references unknown component: ${from}`)
    if (!componentIds.has(to)) throw new Error(`connection.to references unknown component: ${to}`)
    connectionIds.add(id)
  }

  const steps = assertArray(r['steps'], 'steps')
  for (const s of steps) {
    const step = assertObject(s, 'step')
    assertNumber(step['id'], 'step.id')
    assertString(step['title'], 'step.title')
    const highlight = assertArray(step['highlight'], 'step.highlight')
    for (const h of highlight) assertString(h, 'step.highlight item')
    const activeConns = assertArray(step['active_connections'], 'step.active_connections')
    for (const a of activeConns) {
      const connId = assertString(a, 'step.active_connections item')
      if (!connectionIds.has(connId)) throw new Error(`step.active_connections references unknown connection: ${connId}`)
    }
    if (step['annotations'] !== undefined) {
      const anns = assertArray(step['annotations'], 'step.annotations')
      for (const a of anns) {
        const ann = assertObject(a, 'annotation')
        const annType = assertString(ann['type'], 'annotation.type')
        if (!VALID_ANNOTATION_TYPES.has(annType)) throw new Error(`Invalid annotation type: ${annType}`)
        assertString(ann['target'], 'annotation.target')
        assertString(ann['text'], 'annotation.text')
        if (ann['style'] !== undefined) {
          const annStyle = assertString(ann['style'], 'annotation.style')
          if (!VALID_ANNOTATION_STYLES.has(annStyle)) throw new Error(`Invalid annotation style: ${annStyle}`)
        }
      }
    }
    if (step['packet'] !== null && step['packet'] !== undefined) {
      const packet = assertObject(step['packet'], 'step.packet')
      const connId = assertString(packet['connection'], 'packet.connection')
      if (!connectionIds.has(connId)) throw new Error(`packet.connection references unknown connection: ${connId}`)
      const shape = assertString(packet['shape'], 'packet.shape')
      if (!VALID_PACKET_SHAPES.has(shape)) throw new Error(`Invalid packet shape: ${shape}`)
      if (packet['arrivalStyle'] !== undefined) {
        const as_ = assertString(packet['arrivalStyle'], 'packet.arrivalStyle')
        if (!VALID_ARRIVAL_STYLES.has(as_)) throw new Error(`Invalid packet arrivalStyle: ${as_}`)
      }
    }
    if (step['packets'] !== undefined) {
      const packets = assertArray(step['packets'], 'step.packets')
      for (const p of packets) {
        const pkt    = assertObject(p, 'step.packets item')
        const connId = assertString(pkt['connection'], 'packets[].connection')
        if (!connectionIds.has(connId)) throw new Error(`packets[].connection references unknown connection: ${connId}`)
        const shape  = assertString(pkt['shape'], 'packets[].shape')
        if (!VALID_PACKET_SHAPES.has(shape)) throw new Error(`Invalid packet shape in packets[]: ${shape}`)
        if (pkt['arrivalStyle'] !== undefined) {
          const as_ = assertString(pkt['arrivalStyle'], 'packets[].arrivalStyle')
          if (!VALID_ARRIVAL_STYLES.has(as_)) throw new Error(`Invalid packets[].arrivalStyle: ${as_}`)
        }
      }
    }
  }

  return raw as FlowDefinition
}

function autoRoute(from: InternalComponent, to: InternalComponent): THREE.CatmullRomCurve3 {
  const start = from.center.clone().setY(PIPE_HEIGHT)
  const end   = to.center.clone().setY(PIPE_HEIGHT)
  const mid   = new THREE.Vector3(end.x, PIPE_HEIGHT, start.z)
  return new THREE.CatmullRomCurve3([start, mid, end])
}

function bakeRoute(
  from: InternalComponent,
  to: InternalComponent,
  connection: Connection,
): THREE.CatmullRomCurve3 {
  if (connection.route === 'auto') {
    return autoRoute(from, to)
  } else {
    const waypoints = connection.route.map(wp =>
      gridToWorld(wp.col, wp.row, 0).setY(PIPE_HEIGHT)
    )
    return new THREE.CatmullRomCurve3([
      from.center.clone().setY(PIPE_HEIGHT),
      ...waypoints,
      to.center.clone().setY(PIPE_HEIGHT),
    ])
  }
}

export function buildGraph(def: FlowDefinition): InternalGraph {
  validateFlow(def)

  // Build InternalComponent map
  const components = new Map<string, InternalComponent>()
  for (const c of def.components) {
    const center    = componentCenter(c)
    const meshSize  = componentMeshSize(c)
    const topCenter = center.clone()
    topCenter.y += meshSize.y  // mesh bottom sits on ground; top = full height above ground

    const ic: InternalComponent = {
      id:        c.id,
      label:     c.label,
      type:      c.type,
      shape:     c.shape,
      logo:      c.logo,
      center,
      meshSize,
      topCenter,
      meta:      c.meta,
    }
    components.set(c.id, ic)
  }

  // Build InternalConnection map
  const connections = new Map<string, InternalConnection>()
  for (const conn of def.connections) {
    const from = components.get(conn.from)!
    const to   = components.get(conn.to)!
    const curve = bakeRoute(from, to, conn)
    const tubePoints = curve.getPoints(64)

    const ic: InternalConnection = {
      id:    conn.id,
      from,
      to,
      label: conn.label,
      curve,
      tubePoints,
    }
    connections.set(conn.id, ic)
  }

  // Build InternalZone array
  const zones: InternalZone[] = def.zones.map(z => {
    const min = new THREE.Vector3(
      z.bounds.col * CELL_SIZE,
      0,
      z.bounds.row * CELL_SIZE
    )
    const max = new THREE.Vector3(
      (z.bounds.col + z.bounds.width)  * CELL_SIZE,
      0,
      (z.bounds.row + z.bounds.height) * CELL_SIZE
    )
    return {
      id:    z.id,
      label: z.label,
      color: new THREE.Color(z.color),
      min,
      max,
    }
  })

  // Compute gridBounds
  const cols = def.layout.grid.cols
  const rows = def.layout.grid.rows
  const gridBounds = {
    minX: 0,
    maxX: cols * CELL_SIZE,
    minZ: 0,
    maxZ: rows * CELL_SIZE,
  }

  return {
    components,
    connections,
    zones,
    steps: def.steps,
    gridBounds,
  }
}

export type { Component, Connection }
