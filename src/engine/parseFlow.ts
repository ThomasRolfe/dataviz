import * as THREE from 'three'
import type { FlowDefinition, Component, Connection } from '@/types/schema'
import type { InternalGraph, InternalComponent, InternalConnection, InternalZone } from '@/types/internal'
import { componentCenter, componentMeshSize, gridToWorld, CELL_SIZE } from '@/engine/layoutEngine'
import { parseFlowSchema } from '@/engine/flowSchema'

export const PIPE_HEIGHT = 0.5

export function validateFlow(raw: unknown): FlowDefinition {
  const result = parseFlowSchema(raw)
  if (!result.success) throw new Error(result.errors[0])
  return result.data
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
