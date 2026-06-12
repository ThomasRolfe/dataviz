export interface ComponentMeshUserData {
  readonly componentId: string
}

export interface PacketMeshUserData {
  componentId: string  // format: __packet__N
  packetLabel: string
  packetShape: string
  packetData:  Record<string, unknown> | undefined
}
