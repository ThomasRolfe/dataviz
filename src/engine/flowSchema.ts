import { z } from 'zod'
import type { FlowDefinition } from '@/types/schema'

// ── Valid value sets (shared with parseFlow.ts) ───────────────────────────────

const COMPONENT_TYPES  = ['client', 'service', 'database', 'queue', 'function', 'external'] as const
const COMPONENT_SHAPES = ['stack', 'cloud', 'server', 'desktop', 'smartphone', 'router', 'deskphone', 'wall'] as const
const PACKET_SHAPES    = ['sphere', 'document', 'token', 'blob', 'envelope'] as const
const ANNOTATION_TYPES = ['callout', 'transform'] as const
const ANNOTATION_STYLES= ['info', 'success', 'warning', 'error'] as const
const ARRIVAL_STYLES   = ['error', 'success', 'warning'] as const
const DIRECTIONS       = ['forward', 'reverse'] as const

// ── Helper ────────────────────────────────────────────────────────────────────

// Produces a string field that validates against a fixed set and emits a human-
// readable error containing `label` so callers can match on it.
function enumStr<T extends string>(valid: readonly T[], label: string): z.ZodType<T> {
  return z.string().superRefine((v, ctx) => {
    if (!(valid as readonly string[]).includes(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label}: ${v}` })
    }
  }) as unknown as z.ZodType<T>
}

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const ZoneSchema = z.object({
  id:       z.string(),
  label:    z.string(),
  color:    z.string(),
  parentId: z.string().optional(),
  outline:  z.enum(['solid', 'dashed']).optional(),
  bounds: z.object({
    col:    z.number(),
    row:    z.number(),
    width:  z.number(),
    height: z.number(),
  }),
  meta: z.object({
    description: z.string().optional(),
    notes:       z.string().optional(),
  }).optional(),
})

const ComponentSchema = z.object({
  id:       z.string(),
  label:    z.string(),
  type:     enumStr(COMPONENT_TYPES,  'Invalid component type'),
  shape:    enumStr(COMPONENT_SHAPES, 'Invalid component shape').optional(),
  logo:     z.string().optional(),
  icon:     z.string().optional(),
  color:    z.string().optional(),
  position: z.object({
    col:       z.number(),
    row:       z.number(),
    elevation: z.number().optional(),
  }),
  size: z.object({ w: z.number(), h: z.number() }).optional(),
  meta: z.object({
    description: z.string().optional(),
    file:        z.string().optional(),
    line:        z.number().optional(),
    notes:       z.string().optional(),
  }).optional(),
})

const WayPointSchema = z.object({ col: z.number(), row: z.number() })

const ConnectionSchema = z.object({
  id:    z.string(),
  from:  z.string(),
  to:    z.string(),
  label: z.string().optional(),
  route: z.union([z.literal('auto'), z.array(WayPointSchema)]),
})

const AnnotationSchema = z.object({
  type:   enumStr(ANNOTATION_TYPES,  'Invalid annotation type'),
  target: z.string(),
  text:   z.string(),
  style:  enumStr(ANNOTATION_STYLES, 'Invalid annotation style').optional(),
})

const PopoutSchema = z.object({
  title:  z.string(),
  anchor: z.string(),
  data:   z.record(z.string(), z.unknown()),
})

// Two packet schemas so arrival-style errors carry the correct label.
// step.packet  → "Invalid packet arrivalStyle"
// step.packets → "Invalid packets[].arrivalStyle"
const PacketSchema = z.object({
  connection:   z.string(),
  shape:        enumStr(PACKET_SHAPES,  'Invalid packet shape'),
  direction:    enumStr(DIRECTIONS,     'Invalid packet direction').optional(),
  data:         z.record(z.string(), z.unknown()).optional(),
  arrivalStyle: enumStr(ARRIVAL_STYLES, 'Invalid packet arrivalStyle').optional(),
})

const MultiPacketSchema = z.object({
  connection:   z.string(),
  shape:        enumStr(PACKET_SHAPES,  'Invalid packet shape'),
  direction:    enumStr(DIRECTIONS,     'Invalid packet direction').optional(),
  data:         z.record(z.string(), z.unknown()).optional(),
  arrivalStyle: enumStr(ARRIVAL_STYLES, 'Invalid packets[].arrivalStyle').optional(),
})

const StepSchema = z.object({
  id:                 z.number(),
  title:              z.string(),
  name:               z.string().optional(),
  description:        z.string().optional(),
  highlight:          z.array(z.string()),
  active_connections: z.array(z.string()),
  camera: z.object({
    focus: z.string().nullable().optional(),
    zoom:  z.number().optional(),
  }).optional(),
  annotations: z.array(AnnotationSchema).optional(),
  popouts:     z.array(PopoutSchema).optional(),
  packet:      PacketSchema.nullable().optional(),
  packets:     z.array(MultiPacketSchema).optional(),
})

// ── Root schema with cross-reference checks ───────────────────────────────────

export const FlowDefinitionSchema = z.object({
  meta:        z.object({ title: z.string(), description: z.string().optional() }),
  layout:      z.object({ grid: z.object({ cols: z.number(), rows: z.number() }) }),
  zones:       z.array(ZoneSchema),
  components:  z.array(ComponentSchema),
  connections: z.array(ConnectionSchema),
  steps:       z.array(StepSchema),
}).superRefine((flow, ctx) => {
  const componentIds  = new Set(flow.components.map(c => c.id))
  const connectionIds = new Set(flow.connections.map(c => c.id))

  flow.connections.forEach((conn, i) => {
    if (!componentIds.has(conn.from)) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['connections', i, 'from'],
        message: `References unknown component: ${conn.from}`,
      })
    }
    if (!componentIds.has(conn.to)) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['connections', i, 'to'],
        message: `References unknown component: ${conn.to}`,
      })
    }
  })

  flow.steps.forEach((step, si) => {
    step.active_connections.forEach((id, ai) => {
      if (!connectionIds.has(id)) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          path:    ['steps', si, 'active_connections', ai],
          message: `References unknown connection: ${id}`,
        })
      }
    })
    if (step.packet) {
      if (!connectionIds.has(step.packet.connection)) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          path:    ['steps', si, 'packet', 'connection'],
          message: `References unknown connection: ${step.packet.connection}`,
        })
      }
    }
    step.packets?.forEach((pkt, pi) => {
      if (!connectionIds.has(pkt.connection)) {
        ctx.addIssue({
          code:    z.ZodIssueCode.custom,
          path:    ['steps', si, 'packets', pi, 'connection'],
          message: `References unknown connection: ${pkt.connection}`,
        })
      }
    })
  })
})

// ── Public API ────────────────────────────────────────────────────────────────

export type ValidationResult =
  | { success: true;  data: FlowDefinition }
  | { success: false; errors: string[] }

function formatIssue(issue: z.ZodIssue): string {
  const path = issue.path.join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}

/**
 * Validates a raw JSON value against the FlowDefinition schema.
 * Returns a result object — never throws.
 * Errors are human-readable strings in the form "path.to.field: what went wrong".
 */
export function parseFlowSchema(raw: unknown): ValidationResult {
  const result = FlowDefinitionSchema.safeParse(raw)
  if (result.success) return { success: true, data: result.data as FlowDefinition }
  return { success: false, errors: result.error.issues.map(formatIssue) }
}
