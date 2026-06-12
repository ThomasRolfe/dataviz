import { describe, it, expect } from 'vitest'
import { validateFlow, buildGraph, PIPE_HEIGHT } from '@/engine/parseFlow'
import { CELL_SIZE } from '@/engine/layoutEngine'
import type { FlowDefinition } from '@/types/schema'

// ── fixture helpers ──────────────────────────────────────────────────────────

function minimalFlow(overrides: Partial<FlowDefinition> = {}): FlowDefinition {
  return {
    meta: { title: 'Test Flow' },
    layout: { grid: { cols: 8, rows: 4 } },
    zones: [],
    components: [
      { id: 'a', label: 'A', type: 'client',  position: { col: 1, row: 1 } },
      { id: 'b', label: 'B', type: 'service', position: { col: 5, row: 1 } },
    ],
    connections: [
      { id: 'c_ab', from: 'a', to: 'b', route: 'auto' },
    ],
    steps: [
      { id: 0, title: 'Overview', highlight: [], active_connections: [] },
    ],
    ...overrides,
  }
}

// Deep-clone so mutation in one test does not affect others.
const clone = (v: unknown): unknown => JSON.parse(JSON.stringify(v))

// ── validateFlow() ───────────────────────────────────────────────────────────

describe('validateFlow()', () => {
  it('accepts a valid minimal flow', () => {
    expect(() => validateFlow(clone(minimalFlow()))).not.toThrow()
  })

  it('accepts a step with an optional name field', () => {
    const flow = minimalFlow()
    flow.steps[0] = { ...flow.steps[0], name: 'Overview' }
    expect(() => validateFlow(clone(flow))).not.toThrow()
  })

  it('accepts zones when present', () => {
    const flow = minimalFlow({
      zones: [{
        id: 'z1', label: 'Client', color: '#4a9edd',
        bounds: { col: 0, row: 0, width: 3, height: 3 },
      }],
    })
    expect(() => validateFlow(clone(flow))).not.toThrow()
  })

  it('throws when root is not an object', () => {
    expect(() => validateFlow('not an object')).toThrow()
  })

  it('throws when meta.title is missing', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['meta'] as Record<string, unknown>)['title'] = 42
    expect(() => validateFlow(flow)).toThrow(/meta.title/)
  })

  it('throws when layout.grid.cols is not a number', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;((flow['layout'] as Record<string, unknown>)['grid'] as Record<string, unknown>)['cols'] = 'eight'
    expect(() => validateFlow(flow)).toThrow(/cols/)
  })

  it('throws on an invalid component type', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['components'] as Record<string, unknown>[])[0]['type'] = 'spaceship'
    expect(() => validateFlow(flow)).toThrow(/Invalid component type/)
  })

  it('accepts all valid component shapes', () => {
    const shapes = ['stack', 'cloud', 'server', 'desktop', 'smartphone', 'router', 'deskphone', 'wall'] as const
    for (const shape of shapes) {
      const flow = clone(minimalFlow()) as Record<string, unknown>
      ;(flow['components'] as Record<string, unknown>[])[0]['shape'] = shape
      expect(() => validateFlow(flow), `shape: ${shape}`).not.toThrow()
    }
  })

  it('throws on an invalid component shape', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['components'] as Record<string, unknown>[])[0]['shape'] = 'triangle'
    expect(() => validateFlow(flow)).toThrow(/Invalid component shape/)
  })

  it('accepts components with no shape (shape is optional)', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    // shape is not set — must not throw
    expect(() => validateFlow(flow)).not.toThrow()
  })

  it('throws when connection.from references an unknown component', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['connections'] as Record<string, unknown>[])[0]['from'] = 'does_not_exist'
    expect(() => validateFlow(flow)).toThrow(/unknown component/)
  })

  it('throws when connection.to references an unknown component', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['connections'] as Record<string, unknown>[])[0]['to'] = 'does_not_exist'
    expect(() => validateFlow(flow)).toThrow(/unknown component/)
  })

  it('throws when step.active_connections references an unknown connection', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['steps'] as Record<string, unknown>[])[0]['active_connections'] = ['ghost_conn']
    expect(() => validateFlow(flow)).toThrow(/unknown connection/)
  })

  it('throws when packet.connection references an unknown connection', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['steps'] as Record<string, unknown>[])[0]['packet'] = {
      connection: 'ghost_conn',
      shape: 'document',
    }
    expect(() => validateFlow(flow)).toThrow(/unknown connection/)
  })

  it('throws on an invalid packet shape', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['steps'] as Record<string, unknown>[])[0]['packet'] = {
      connection: 'c_ab',
      shape: 'cube',
    }
    expect(() => validateFlow(flow)).toThrow(/Invalid packet shape/)
  })

  it('throws on an invalid annotation type', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['steps'] as Record<string, unknown>[])[0]['annotations'] = [
      { type: 'popup', target: 'a', text: 'hello' },
    ]
    expect(() => validateFlow(flow)).toThrow(/Invalid annotation type/)
  })

  it('accepts all valid packet shapes', () => {
    const shapes = ['sphere', 'document', 'token', 'blob', 'envelope'] as const
    for (const shape of shapes) {
      const flow = clone(minimalFlow()) as Record<string, unknown>
      ;(flow['steps'] as Record<string, unknown>[])[0]['packet'] = {
        connection: 'c_ab',
        shape,
      }
      expect(() => validateFlow(flow), `shape: ${shape}`).not.toThrow()
    }
  })

  it('accepts null packet', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['steps'] as Record<string, unknown>[])[0]['packet'] = null
    expect(() => validateFlow(flow)).not.toThrow()
  })

  it('accepts a step with multiple packets', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['steps'] as Record<string, unknown>[])[0]['packets'] = [
      { connection: 'c_ab', shape: 'sphere' },
      { connection: 'c_ab', shape: 'document' },
    ]
    expect(() => validateFlow(flow)).not.toThrow()
  })

  it('throws when packets[].connection references an unknown connection', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['steps'] as Record<string, unknown>[])[0]['packets'] = [
      { connection: 'ghost_conn', shape: 'sphere' },
    ]
    expect(() => validateFlow(flow)).toThrow(/unknown connection/)
  })

  it('throws on an invalid shape in packets[]', () => {
    const flow = clone(minimalFlow()) as Record<string, unknown>
    ;(flow['steps'] as Record<string, unknown>[])[0]['packets'] = [
      { connection: 'c_ab', shape: 'cube' },
    ]
    expect(() => validateFlow(flow)).toThrow(/Invalid packet shape/)
  })
})

// ── buildGraph() ─────────────────────────────────────────────────────────────

describe('buildGraph()', () => {
  it('produces a components Map keyed by component id', () => {
    const graph = buildGraph(minimalFlow())
    expect(graph.components.has('a')).toBe(true)
    expect(graph.components.has('b')).toBe(true)
    expect(graph.components.size).toBe(2)
  })

  it('produces a connections Map keyed by connection id', () => {
    const graph = buildGraph(minimalFlow())
    expect(graph.connections.has('c_ab')).toBe(true)
    expect(graph.connections.size).toBe(1)
  })

  it('computes component center from grid position', () => {
    const graph = buildGraph(minimalFlow())
    // Component 'a' at col 1, row 1, size 1×1 → center at (1.5, 0, 1.5) × CELL_SIZE
    const a = graph.components.get('a')!
    expect(a.center.x).toBeCloseTo(1.5 * CELL_SIZE)
    expect(a.center.z).toBeCloseTo(1.5 * CELL_SIZE)
  })

  it('sets topCenter above center by meshSize.y', () => {
    const graph = buildGraph(minimalFlow())
    const a = graph.components.get('a')!
    expect(a.topCenter.y).toBeCloseTo(a.center.y + a.meshSize.y)
  })

  it('connection curve starts near the from-component center', () => {
    const graph = buildGraph(minimalFlow())
    const conn  = graph.connections.get('c_ab')!
    const start = conn.curve.getPointAt(0)
    const fromCenter = graph.components.get('a')!.center
    expect(start.x).toBeCloseTo(fromCenter.x, 1)
    expect(start.z).toBeCloseTo(fromCenter.z, 1)
    expect(start.y).toBeCloseTo(PIPE_HEIGHT)
  })

  it('connection curve ends near the to-component center', () => {
    const graph = buildGraph(minimalFlow())
    const conn = graph.connections.get('c_ab')!
    const end  = conn.curve.getPointAt(1)
    const toCenter = graph.components.get('b')!.center
    expect(end.x).toBeCloseTo(toCenter.x, 1)
    expect(end.z).toBeCloseTo(toCenter.z, 1)
  })

  it('connection stores from/to component references', () => {
    const graph = buildGraph(minimalFlow())
    const conn = graph.connections.get('c_ab')!
    expect(conn.from).toBe(graph.components.get('a'))
    expect(conn.to).toBe(graph.components.get('b'))
  })

  it('gridBounds match layout grid dimensions', () => {
    const graph = buildGraph(minimalFlow())
    expect(graph.gridBounds.minX).toBe(0)
    expect(graph.gridBounds.minZ).toBe(0)
    expect(graph.gridBounds.maxX).toBeCloseTo(8 * CELL_SIZE)
    expect(graph.gridBounds.maxZ).toBeCloseTo(4 * CELL_SIZE)
  })

  it('passes steps through unchanged', () => {
    const flow  = minimalFlow()
    const graph = buildGraph(flow)
    expect(graph.steps).toEqual(flow.steps)
  })

  it('builds zones with correct world coordinates', () => {
    const flow = minimalFlow({
      zones: [{
        id: 'z1', label: 'Client', color: '#4a9edd',
        bounds: { col: 0, row: 0, width: 2, height: 2 },
      }],
    })
    const graph = buildGraph(flow)
    expect(graph.zones).toHaveLength(1)
    const z = graph.zones[0]
    expect(z.min.x).toBe(0)
    expect(z.max.x).toBeCloseTo(2 * CELL_SIZE)
  })

  it('supports waypoint routes', () => {
    const flow = minimalFlow({
      connections: [
        { id: 'c_ab', from: 'a', to: 'b', route: [{ col: 3, row: 0 }] },
      ],
    })
    expect(() => buildGraph(flow)).not.toThrow()
    const conn = buildGraph(flow).connections.get('c_ab')!
    expect(conn.curve.points.length).toBe(3) // start + 1 waypoint + end
  })
})
