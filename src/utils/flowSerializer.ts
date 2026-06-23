import type { FlowDefinition } from '@/types/schema'
import type { InternalGraph } from '@/types/internal'
import { CELL_SIZE, COMPONENT_GAP } from '@/engine/layoutEngine'

export function graphToFlowDefinition(
  graph: InternalGraph,
  original: FlowDefinition,
): FlowDefinition {
  const components = original.components.map(orig => {
    const ic = graph.components.get(orig.id)
    if (!ic) return orig
    const w   = ic.meshSize.x / (CELL_SIZE * COMPONENT_GAP)
    const h   = ic.meshSize.z / (CELL_SIZE * COMPONENT_GAP)
    const col = Math.round(ic.center.x / CELL_SIZE - w / 2)
    const row = Math.round(ic.center.z / CELL_SIZE - h / 2)
    return { ...orig, position: { ...orig.position, col, row } }
  })
  return { ...original, components }
}
