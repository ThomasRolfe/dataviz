export interface FlowMeta {
  title: string
  description?: string
}

export interface LayoutConfig {
  grid: {
    cols: number
    rows: number
  }
}

export interface Zone {
  id: string
  label: string
  color: string
  bounds: {
    col: number
    row: number
    width: number
    height: number
  }
}

export type ComponentType =
  | 'client'
  | 'service'
  | 'database'
  | 'queue'
  | 'function'
  | 'external'

export interface Component {
  id: string
  label: string
  type: ComponentType
  position: { col: number; row: number; elevation?: number }
  size?: { w: number; h: number }
  meta?: {
    description?: string
    file?: string
    line?: number
    notes?: string
  }
}

export interface WayPoint {
  col: number
  row: number
}

export interface Connection {
  id: string
  from: string
  to: string
  label?: string
  route: 'auto' | WayPoint[]
}

export type AnnotationType = 'callout' | 'transform'

export interface Annotation {
  type: AnnotationType
  target: string
  text: string
}

export interface Popout {
  title: string
  anchor: string
  data: Record<string, unknown>
}

export type PacketShape = 'sphere' | 'document' | 'token' | 'blob' | 'envelope'

export interface Packet {
  connection: string
  shape: PacketShape
  data?: Record<string, unknown>
}

export interface Step {
  id: number
  title: string
  description?: string
  highlight: string[]
  active_connections: string[]
  camera?: {
    focus?: string | null
    zoom?: number
  }
  annotations?: Annotation[]
  popouts?: Popout[]
  packet?: Packet | null
}

export interface FlowDefinition {
  meta: FlowMeta
  layout: LayoutConfig
  zones: Zone[]
  components: Component[]
  connections: Connection[]
  steps: Step[]
}
