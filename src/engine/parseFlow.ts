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
const VALID_DIRECTIONS        = new Set(['forward', 'reverse'])

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
      if (packet['direction'] !== undefined) {
        const dir = assertString(packet['direction'], 'packet.direction')
        if (!VALID_DIRECTIONS.has(dir)) throw new Error(`Invalid packet direction: ${dir}`)
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
        if (pkt['direction'] !== undefined) {
          const dir = assertString(pkt['direction'], 'packets[].direction')
          if (!VALID_DIRECTIONS.has(dir)) throw new Error(`Invalid packets[].direction: ${dir}`)
        }
      }
    }
  }

  return raw as FlowDefinition
}

// Wide S-curve: control points pulled 75% of the way across — sweeping, flat on the ground plane.
function autoRoute(start: THREE.Vector3, end: THREE.Vector3): THREE.CubicBezierCurve3 {
  const dx  = end.x - start.x
  const cp1 = new THREE.Vector3(start.x + dx * 0.75, PIPE_HEIGHT, start.z)
  const cp2 = new THREE.Vector3(end.x   - dx * 0.75, PIPE_HEIGHT, end.z)
  return new THREE.CubicBezierCurve3(start, cp1, cp2, end)
}

function bakeRoute(
  connection: Connection,
  startPt: THREE.Vector3,
  endPt:   THREE.Vector3,
): THREE.Curve<THREE.Vector3> {
  if (connection.route === 'auto') {
    return autoRoute(startPt, endPt)
  } else {
    const waypoints = connection.route.map(wp =>
      gridToWorld(wp.col, wp.row, 0).setY(PIPE_HEIGHT)
    )
    return new THREE.CatmullRomCurve3([startPt, ...waypoints, endPt])
  }
}

// ── Port-spreading helpers ────────────────────────────────────────────────────
//
// When N connections share the same source or destination, their attachment
// points are spread perpendicularly so pipes fan out rather than stacking.

const PORT_SPREAD = 0.55  // world-unit gap between adjacent attachment points

type PortOffsets = Map<string, { start: THREE.Vector3; end: THREE.Vector3 }>

function computePortOffsets(
  def: FlowDefinition,
  components: Map<string, InternalComponent>,
): PortOffsets {
  const offsets: PortOffsets = new Map()
  const ensure = (id: string) => {
    if (!offsets.has(id))
      offsets.set(id, { start: new THREE.Vector3(), end: new THREE.Vector3() })
    return offsets.get(id)!
  }

  // Index connections by source and destination for O(1) lookups
  const connById  = new Map(def.connections.map(c => [c.id, c]))
  const byDest    = new Map<string, string[]>()
  const bySrc     = new Map<string, string[]>()
  for (const c of def.connections) {
    ;(byDest.get(c.to)  ?? (byDest.set(c.to,   []), byDest.get(c.to)!)).push(c.id)
    ;(bySrc.get(c.from) ?? (bySrc.set(c.from, []), bySrc.get(c.from)!)).push(c.id)
  }

  // Spread a group of connections at a shared attachment point.
  // `sortKey`  — center of the "other" component, used to order pipes spatially.
  // `applyFn`  — adds the computed offset to start or end of the named connection.
  // `avgDir`   — average travel direction (XZ) across the group; perpendicular
  //              to this is the spread axis.
  function spreadGroup(
    connIds:  string[],
    sortKey:  (id: string) => THREE.Vector3,
    applyFn:  (id: string, v: THREE.Vector3) => void,
    avgDir:   THREE.Vector2,
  ) {
    if (connIds.length < 2) return
    const n    = connIds.length
    const perp = new THREE.Vector2(-avgDir.y, avgDir.x).normalize()
    const sorted = [...connIds].sort((a, b) => sortKey(a).z - sortKey(b).z)
    sorted.forEach((id, i) => {
      const t = (i - (n - 1) / 2) * PORT_SPREAD
      applyFn(id, new THREE.Vector3(perp.x * t, 0, perp.y * t))
    })
  }

  function avgDirection(connIds: string[]): THREE.Vector2 {
    let ax = 0, az = 0
    for (const id of connIds) {
      const c    = connById.get(id)!
      const src  = components.get(c.from)!.center
      const dest = components.get(c.to)!.center
      const dx = dest.x - src.x
      const dz = dest.z - src.z
      const len = Math.max(Math.sqrt(dx * dx + dz * dz), 0.01)
      ax += dx / len
      az += dz / len
    }
    const len = Math.max(Math.sqrt(ax * ax + az * az), 0.01)
    return new THREE.Vector2(ax / len, az / len)
  }

  // Spread arrivals at each destination
  for (const [, ids] of byDest) {
    const dir = avgDirection(ids)
    spreadGroup(
      ids,
      id => components.get(connById.get(id)!.from)!.center,
      (id, v) => ensure(id).end.add(v),
      dir,
    )
  }

  // Spread departures from each source
  for (const [, ids] of bySrc) {
    const dir = avgDirection(ids)
    spreadGroup(
      ids,
      id => components.get(connById.get(id)!.to)!.center,
      (id, v) => ensure(id).start.add(v),
      dir,
    )
  }

  return offsets
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
      color:     c.color,
      center,
      meshSize,
      topCenter,
      meta:      c.meta,
    }
    components.set(c.id, ic)
  }

  // Compute port-spread offsets so pipes fan out at shared attach points
  const portOffsets = computePortOffsets(def, components)

  // Build InternalConnection map
  const connections = new Map<string, InternalConnection>()
  for (const conn of def.connections) {
    const from  = components.get(conn.from)!
    const to    = components.get(conn.to)!
    const po    = portOffsets.get(conn.id)
    const startPt = from.center.clone().add(po?.start ?? new THREE.Vector3()).setY(PIPE_HEIGHT)
    const endPt   = to.center.clone().add(po?.end   ?? new THREE.Vector3()).setY(PIPE_HEIGHT)
    const curve   = bakeRoute(conn, startPt, endPt)
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
