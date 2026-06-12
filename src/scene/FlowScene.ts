import * as THREE from 'three'
import * as TWEEN from '@tweenjs/tween.js'
import { SceneManager } from '@/scene/SceneManager'
import { OverlayBridge } from '@/scene/OverlayBridge'
import { GridFloor } from '@/scene/GridFloor'
import { ZoneRenderer } from '@/scene/ZoneRenderer'
import { ComponentMesh } from '@/scene/ComponentMesh'
import type { MeshState } from '@/scene/ComponentMesh'
import { ConnectionPipe } from '@/scene/ConnectionPipe'
import { DataPacket } from '@/scene/DataPacket'
import { HoverSystem } from '@/scene/HoverSystem'
import { setupLighting, updateLighting } from '@/scene/LightingSetup'
import type { SceneLights } from '@/scene/LightingSetup'
import { THEME_COLORS } from '@/scene/ThemeColors'
import type { Theme } from '@/scene/ThemeColors'
import type { InternalGraph } from '@/types/internal'
import type { Step } from '@/types/schema'
import { CELL_SIZE } from '@/engine/layoutEngine'

const PACKET_TRAVEL_MS = 2000

export class FlowScene extends SceneManager {
  private graph:          InternalGraph
  private components:     Map<string, ComponentMesh>
  private pipes:          Map<string, ConnectionPipe>
  private zones:          ZoneRenderer[]
  private grid:           GridFloor
  private lights:         SceneLights
  private currentTheme:    Theme = 'light'
  private activePackets:   DataPacket[] = []
  private packetPipeMap:   Map<DataPacket, string> = new Map()
  private arrivedPackets:  Set<DataPacket> = new Set()
  private penetratedIds:   Set<string> = new Set()
  private hoverSystem:            HoverSystem
  private packetArrivalCallback:  ((targetId: string) => void) | null = null
  private overviewTarget:         THREE.Vector3
  private overviewFrustum: number
  private isPanning:       boolean = false
  private panLast:         THREE.Vector2 = new THREE.Vector2()
  private cameraTween:     TWEEN.Tween<{ tx: number; tz: number; f: number }> | null = null
  cameraTarget:   THREE.Vector3
  currentFrustum: number
  overlayBridge:  OverlayBridge

  constructor(canvas: HTMLCanvasElement, graph: InternalGraph) {
    super(canvas)
    this.graph = graph

    this.lights = setupLighting(this.scene)

    // Build scene objects
    this.grid = new GridFloor(this.scene, graph)

    this.zones = graph.zones.map(z => new ZoneRenderer(this.scene, z))

    this.components = new Map()
    for (const [id, comp] of graph.components) {
      this.components.set(id, new ComponentMesh(this.scene, comp))
    }

    this.pipes = new Map()
    for (const [id, conn] of graph.connections) {
      this.pipes.set(id, new ConnectionPipe(this.scene, conn))
    }

    // Overlay bridge
    this.overlayBridge = new OverlayBridge(this.camera, this.renderer)

    // Hover system
    this.hoverSystem = new HoverSystem(canvas, this.camera, () => {})
    for (const cm of this.components.values()) {
      cm.addToRaycastTargets(this.hoverSystem['targets'])
    }

    // Compute overview camera
    const { minX, maxX, minZ, maxZ } = graph.gridBounds
    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2
    const extentX = (maxX - minX) / 2 + CELL_SIZE
    const extentZ = (maxZ - minZ) / 2 + CELL_SIZE
    const frustumNeeded = Math.max(extentX, extentZ) * 1.2

    this.overviewTarget  = new THREE.Vector3(centerX, 0, centerZ)
    this.overviewFrustum = frustumNeeded
    this.cameraTarget    = this.overviewTarget.clone()
    this.currentFrustum  = frustumNeeded

    // Position camera at overview
    const t = this.overviewTarget
    this.camera.position.set(t.x + 50, 50, t.z + 50)
    this.camera.lookAt(t)
    const aspect = canvas.clientWidth / canvas.clientHeight || 1
    this.camera.left   = -frustumNeeded * aspect
    this.camera.right  =  frustumNeeded * aspect
    this.camera.top    =  frustumNeeded
    this.camera.bottom = -frustumNeeded
    this.camera.updateProjectionMatrix()

    canvas.addEventListener('wheel',        this.onWheel,       { passive: false })
    canvas.addEventListener('pointerdown',  this.onPointerDown)
    canvas.addEventListener('pointermove',  this.onPointerMove)
    canvas.addEventListener('pointerup',    this.onPointerUp)
    canvas.addEventListener('pointerleave', this.onPointerUp)
    canvas.addEventListener('contextmenu',  this.onContextMenu)
    canvas.style.cursor = 'grab'
    this.startLoop()
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.12 : 0.89
    const next = Math.min(
      Math.max(this.currentFrustum * factor, this.overviewFrustum * 0.25),
      this.overviewFrustum * 2.5
    )
    this.currentFrustum = next
    const aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight || 1
    this.camera.left   = -next * aspect
    this.camera.right  =  next * aspect
    this.camera.top    =  next
    this.camera.bottom = -next
    this.camera.updateProjectionMatrix()
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return
    this.isPanning = true
    this.panLast.set(e.clientX, e.clientY)
    this.cameraTween?.stop()
    this.cameraTween = null
    this.renderer.domElement.style.cursor = 'grabbing'
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isPanning) return
    const dx = e.clientX - this.panLast.x
    const dy = e.clientY - this.panLast.y
    this.panLast.set(e.clientX, e.clientY)
    if (dx === 0 && dy === 0) return

    const el     = this.renderer.domElement
    const scaleX = (this.camera.right - this.camera.left) / el.clientWidth
    const scaleY = (this.camera.top   - this.camera.bottom) / el.clientHeight

    // Camera right/up in world space, projected onto XZ so panning stays on the ground plane
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
    const up    = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1)
    right.y = 0
    up.y    = 0

    const offset = new THREE.Vector3()
    offset.addScaledVector(right, -dx * scaleX)
    offset.addScaledVector(up,     dy * scaleY)

    this.cameraTarget.add(offset)
    this.camera.position.add(offset)
    this.camera.lookAt(this.cameraTarget)
    this.camera.updateProjectionMatrix()
  }

  private onPointerUp = (): void => {
    this.isPanning = false
    this.renderer.domElement.style.cursor = 'grab'
  }

  private onContextMenu = (e: Event): void => {
    e.preventDefault()
  }

  setHoverCallback(fn: (id: string | null) => void): void {
    this.hoverSystem['onHoverChange'] = fn
  }

  setPacketArrivalCallback(fn: (targetId: string) => void): void {
    this.packetArrivalCallback = fn
  }

  setTheme(theme: Theme): void {
    this.currentTheme = theme
    this.renderer.setClearColor(THEME_COLORS[theme].clearColor)
    updateLighting(this.lights, theme)
    this.grid.setTheme(theme, this.scene)
    for (const pipe of this.pipes.values()) pipe.setTheme(theme)
    for (const packet of this.activePackets) packet.setTheme(theme)
  }

  applyStep(step: Step, _prevStep: Step | null, durationMs: number): void {
    const PHASE_MATERIAL = durationMs * 0.4
    const PHASE_CAMERA   = durationMs * 0.3

    // 1. Dispose all active packets, clear traversal state, clear penetration
    for (const [, pipeId] of this.packetPipeMap) {
      this.pipes.get(pipeId)?.setPacketTraversing(false, PHASE_MATERIAL)
    }
    for (const packet of this.activePackets) {
      this.hoverSystem.removeTarget(packet.mesh)
      packet.dispose(this.scene)
    }
    this.activePackets  = []
    this.packetPipeMap  = new Map()
    this.arrivedPackets = new Set()
    for (const id of this.penetratedIds) {
      this.components.get(id)?.setPenetrated(false)
    }
    this.penetratedIds.clear()

    // 2. Transition component materials
    for (const [id, mesh] of this.components) {
      const state: MeshState = step.highlight.includes(id)
        ? 'highlighted'
        : step.highlight.length > 0
          ? 'dimmed'
          : 'idle'
      mesh.transitionTo(state, PHASE_MATERIAL)
    }

    // 3. Transition pipe materials (active_connections → medium brightness)
    for (const [id, pipe] of this.pipes) {
      const active = step.active_connections.includes(id)
      pipe.setActive(active, PHASE_MATERIAL)
    }

    // 4. Animate camera
    this.animateCamera(step.camera, PHASE_CAMERA)

    // 5. Launch all packets — each pipe flares to full brightness while a packet is on it
    const packetDefs = [
      ...(step.packet  ? [step.packet]    : []),
      ...(step.packets ?? []),
    ]
    packetDefs.forEach((def, i) => {
      const pipe = this.pipes.get(def.connection)
      if (!pipe) return
      const conn   = this.graph.connections.get(def.connection)
      const packet = new DataPacket(this.scene, def.shape, this.currentTheme)
      packet.mesh.userData.componentId = `__packet__${i}`
      packet.mesh.userData.packetData  = def.data
      packet.mesh.userData.packetLabel = conn?.label ?? def.connection
      packet.mesh.userData.packetShape = def.shape
      this.hoverSystem.addTarget(packet.mesh)
      this.activePackets.push(packet)
      this.packetPipeMap.set(packet, def.connection)
      pipe.setPacketTraversing(true, 200)
      packet.travel(pipe.curve, PACKET_TRAVEL_MS)
    })
  }

  private animateCamera(config: Step['camera'], durationMs: number): void {
    if (!config || config.focus === undefined) {
      this.tweenCameraToOverview(durationMs)
      return
    }

    if (config.focus === null) {
      this.tweenCameraToOverview(durationMs)
      return
    }

    const component = this.graph.components.get(config.focus)
    if (!component) return

    const zoom   = config.zoom ?? 1.0
    const target = component.center.clone()

    this.tweenCameraTo(target, this.overviewFrustum / zoom, durationMs)
  }

  private tweenCameraToOverview(durationMs: number): void {
    this.tweenCameraTo(this.overviewTarget, this.overviewFrustum, durationMs)
  }

  private tweenCameraTo(target: THREE.Vector3, frustum: number, durationMs: number): void {
    this.cameraTween?.stop()
    const aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight || 1

    this.cameraTween = new TWEEN.Tween({
      tx: this.cameraTarget.x,
      tz: this.cameraTarget.z,
      f:  this.currentFrustum,
    })
      .to({ tx: target.x, tz: target.z, f: frustum }, durationMs)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(({ tx, tz, f }) => {
        this.cameraTarget.set(tx, 0, tz)
        this.currentFrustum = f

        this.camera.position.set(tx + 50, 50, tz + 50)
        this.camera.lookAt(this.cameraTarget)

        this.camera.left   = -f * aspect
        this.camera.right  =  f * aspect
        this.camera.top    =  f
        this.camera.bottom = -f
        this.camera.updateProjectionMatrix()
      })
      .onComplete(() => { this.cameraTween = null })
      .start()
  }

  override resize(width: number, height: number): void {
    const aspect = width / height || 1
    this.camera.left   = -this.currentFrustum * aspect
    this.camera.right  =  this.currentFrustum * aspect
    this.camera.top    =  this.currentFrustum
    this.camera.bottom = -this.currentFrustum
    this.camera.position.set(this.cameraTarget.x + 50, 50, this.cameraTarget.z + 50)
    this.camera.lookAt(this.cameraTarget)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  getConnectionLabelData(): Array<{ id: string; label: string; midpoint: THREE.Vector3 }> {
    const result: Array<{ id: string; label: string; midpoint: THREE.Vector3 }> = []
    for (const [id, pipe] of this.pipes) {
      const label = this.graph.connections.get(id)?.label
      if (label) result.push({ id, label, midpoint: pipe.midpoint })
    }
    return result
  }

  getZoneLabelData(): Array<{ label: string; position: THREE.Vector3; color: string }> {
    return this.graph.zones.map((zone, i) => ({
      label:    zone.label,
      position: this.zones[i].labelPosition,
      color:    '#' + zone.color.getHexString(),
    }))
  }

  getPacketMesh(id: string): THREE.Mesh | null {
    return this.activePackets.find(p => p.mesh.userData.componentId === id)?.mesh ?? null
  }

  protected onFrame(_deltaMs: number): void {
    if (!this.isPanning) this.hoverSystem.update()

    const now = performance.now()
    for (const packet of this.activePackets) {
      packet.update(now)

      // Dim the pipe once this packet lands, but only if no other traveling packet
      // is still using the same connection.
      if (packet.arrived && !this.arrivedPackets.has(packet)) {
        this.arrivedPackets.add(packet)
        const pipeId = this.packetPipeMap.get(packet)
        if (pipeId) {
          const stillTraveling = this.activePackets.some(
            p => !p.arrived && this.packetPipeMap.get(p) === pipeId
          )
          if (!stillTraveling) this.pipes.get(pipeId)?.setPacketTraversing(false, 600)

          const destId = this.graph.connections.get(pipeId)?.to.id
          if (destId) this.packetArrivalCallback?.(destId)
        }
      }
    }

    this.updatePenetration()
  }

  private updatePenetration(): void {
    if (this.activePackets.length === 0) {
      if (this.penetratedIds.size > 0) {
        for (const id of this.penetratedIds) this.components.get(id)?.setPenetrated(false)
        this.penetratedIds.clear()
      }
      return
    }

    // Union penetration test across all active packets
    const next = new Set<string>()
    for (const packet of this.activePackets) {
      const p = packet.mesh.position
      for (const [id] of this.components) {
        const ic = this.graph.components.get(id)
        if (!ic) continue
        const hx = ic.meshSize.x / 2
        const hz = ic.meshSize.z / 2
        if (
          p.x >= ic.center.x - hx && p.x <= ic.center.x + hx &&
          p.z >= ic.center.z - hz && p.z <= ic.center.z + hz
        ) {
          next.add(id)
        }
      }
    }

    for (const id of next) {
      if (!this.penetratedIds.has(id)) this.components.get(id)?.setPenetrated(true)
    }
    for (const id of this.penetratedIds) {
      if (!next.has(id)) this.components.get(id)?.setPenetrated(false)
    }
    this.penetratedIds = next
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('wheel',        this.onWheel)
    this.renderer.domElement.removeEventListener('pointerdown',  this.onPointerDown)
    this.renderer.domElement.removeEventListener('pointermove',  this.onPointerMove)
    this.renderer.domElement.removeEventListener('pointerup',    this.onPointerUp)
    this.renderer.domElement.removeEventListener('pointerleave', this.onPointerUp)
    this.renderer.domElement.removeEventListener('contextmenu',  this.onContextMenu)
    this.stopLoop()
    this.hoverSystem.dispose()
    this.grid.dispose(this.scene)
    for (const z of this.zones) z.dispose(this.scene)
    for (const cm of this.components.values()) cm.dispose(this.scene)
    for (const pipe of this.pipes.values()) pipe.dispose(this.scene)
    for (const packet of this.activePackets) {
      this.hoverSystem.removeTarget(packet.mesh)
      packet.dispose(this.scene)
    }
    this.activePackets = []
    this.penetratedIds.clear()
    super.dispose()
  }
}
