import * as THREE from 'three'
import { SceneManager } from '@/scene/SceneManager'
import { OverlayBridge } from '@/scene/OverlayBridge'
import { GridFloor } from '@/scene/GridFloor'
import { ZoneRenderer } from '@/scene/ZoneRenderer'
import { ComponentMesh } from '@/scene/ComponentMesh'
import type { MeshState } from '@/scene/ComponentMesh'
import { ConnectionPipe } from '@/scene/ConnectionPipe'
import { DataPacket } from '@/scene/DataPacket'
import { ChevronStream } from '@/scene/ChevronStream'
import { HoverSystem } from '@/scene/HoverSystem'
import { setupLighting, updateLighting } from '@/scene/LightingSetup'
import type { SceneLights } from '@/scene/LightingSetup'
import { THEME_COLORS } from '@/scene/ThemeColors'
import type { Theme } from '@/scene/ThemeColors'
import type { PacketMeshUserData } from '@/scene/meshUserData'
import type { InternalGraph } from '@/types/internal'
import type { Step } from '@/types/schema'
import { CELL_SIZE, COMPONENT_GAP, worldToGrid } from '@/engine/layoutEngine'
import { Tween } from '@tweenjs/tween.js'
import { tweenGroup } from '@/scene/tweenGroup'

const PACKET_TRAVEL_MS     = 2000
const CAMERA_HEIGHT        = 50
const PHASE_MATERIAL_RATIO = 0.4
const WHEEL_ZOOM_IN        = 0.89
const WHEEL_ZOOM_OUT       = 1.12
const FRUSTUM_MIN_RATIO    = 0.25
const FRUSTUM_MAX_RATIO    = 2.5
const PIPE_DIM_DELAY_MS    = 600
const DRAG_THRESHOLD_PX    = 4    // movement before a press becomes a drag
const DRAG_LIFT            = 0.6  // world-units a component rises while being dragged

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
  private activeStreams:    ChevronStream[] = []
  private hoverSystem:     HoverSystem
  zoneLabelPositions:      Map<string, THREE.Vector3> = new Map()
  private overviewTarget:  THREE.Vector3
  private overviewFrustum: number
  private isPanning:       boolean = false
  private panLast:         THREE.Vector2 = new THREE.Vector2()
  private packetArrivalCallback: ((targetId: string) => void) | null = null
  // ── Edit-mode drag state ──
  private editMode:        boolean = false
  private dragId:          string | null = null
  private dragGroup:       THREE.Group | null = null
  private dragPointerId:   number | null = null
  private dragOffset:      THREE.Vector2 = new THREE.Vector2()  // (groupX-groundX, groupZ-groundZ) at grab
  private dragStartClient: THREE.Vector2 = new THREE.Vector2()  // pointer-down position, for threshold
  private dragOriginY:     number = 0
  private dragMoved:       boolean = false
  private dragRay:         THREE.Raycaster = new THREE.Raycaster()
  private dragGhost:       THREE.Mesh | null = null
  private dragW:           number = 0
  private dragH:           number = 0
  cameraTarget:   THREE.Vector3
  currentFrustum: number
  overlayBridge:  OverlayBridge

  constructor(canvas: HTMLCanvasElement, graph: InternalGraph) {
    super(canvas)
    this.graph = graph

    this.lights = setupLighting(this.scene, this.currentTheme)

    // Build scene objects — pass theme so grid uses correct colors from first frame
    this.grid = new GridFloor(this.scene, graph, this.currentTheme)

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

    // Hover system — components and zone labels register as targets
    this.hoverSystem = new HoverSystem(canvas, this.camera, () => {})
    for (const cm of this.components.values()) {
      this.hoverSystem.addTarget(cm.hitMesh)
    }
    for (const z of this.zones) {
      this.hoverSystem.addTarget(z.labelMesh)
      this.zoneLabelPositions.set(
        z.labelMesh.userData.zoneId as string,
        z.labelMesh.position.clone(),
      )
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
    this.camera.position.set(t.x + CAMERA_HEIGHT, CAMERA_HEIGHT, t.z + CAMERA_HEIGHT)
    this.camera.lookAt(t)
    const aspect = canvas.clientWidth / canvas.clientHeight || 1
    this.camera.left   = -frustumNeeded * aspect
    this.camera.right  =  frustumNeeded * aspect
    this.camera.top    =  frustumNeeded
    this.camera.bottom = -frustumNeeded
    this.camera.updateProjectionMatrix()

    // Apply initial theme to renderer before the first frame is drawn
    this.renderer.setClearColor(THEME_COLORS[this.currentTheme].clearColor)

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
    const factor = e.deltaY > 0 ? WHEEL_ZOOM_OUT : WHEEL_ZOOM_IN
    const next = Math.min(
      Math.max(this.currentFrustum * factor, this.overviewFrustum * FRUSTUM_MIN_RATIO),
      this.overviewFrustum * FRUSTUM_MAX_RATIO
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

    // Edit mode: grab a component if the press lands on one. Empty space still pans.
    if (this.editMode) {
      const id = this.pickComponent(e.clientX, e.clientY)
      if (id) {
        const cm = this.components.get(id)!
        const icForDrag = this.graph.components.get(id)!
        this.dragW         = icForDrag.meshSize.x / (CELL_SIZE * COMPONENT_GAP)
        this.dragH         = icForDrag.meshSize.z / (CELL_SIZE * COMPONENT_GAP)
        this.dragId        = id
        this.dragGroup     = cm.group
        this.dragPointerId = e.pointerId
        this.dragOriginY   = cm.group.position.y
        this.dragMoved     = false
        this.dragStartClient.set(e.clientX, e.clientY)
        const ground = this.pointerToGround(e.clientX, e.clientY)
        this.dragOffset.set(cm.group.position.x - ground.x, cm.group.position.z - ground.z)
        this.renderer.domElement.setPointerCapture(e.pointerId)
        this.renderer.domElement.style.cursor = 'grabbing'
        return
      }
    }

    this.isPanning = true
    this.panLast.set(e.clientX, e.clientY)
    this.renderer.domElement.style.cursor = 'grabbing'
  }

  private onPointerMove = (e: PointerEvent): void => {
    // Edit-mode drag takes priority over panning
    if (this.dragId && this.dragGroup) {
      if (!this.dragMoved) {
        const dist = Math.hypot(e.clientX - this.dragStartClient.x, e.clientY - this.dragStartClient.y)
        if (dist < DRAG_THRESHOLD_PX) return  // sub-threshold: treat as a click, don't move yet
        this.dragMoved = true
        this.dragGroup.position.y = this.dragOriginY + DRAG_LIFT  // lift on first real movement
      }
      const ground = this.pointerToGround(e.clientX, e.clientY)
      this.dragGroup.position.x = ground.x + this.dragOffset.x
      this.dragGroup.position.z = ground.z + this.dragOffset.y

      // Sync InternalComponent center with live mesh position for pipe rebuild
      const id = this.dragId!
      const ic = this.graph.components.get(id)!
      const gx = this.dragGroup.position.x
      const gz = this.dragGroup.position.z
      ic.center.set(gx, 0, gz)
      ic.topCenter.set(gx, ic.meshSize.y, gz)

      // Live-rebuild all pipes connected to the dragged component
      for (const [connId, conn] of this.graph.connections) {
        if (conn.from.id === id || conn.to.id === id) this.pipes.get(connId)?.update()
      }

      // Show/update ghost box at the snapped target position
      if (!this.dragGhost) {
        const geo = new THREE.BoxGeometry(ic.meshSize.x, 0.05, ic.meshSize.z)
        const mat = new THREE.MeshBasicMaterial({ color: 0x4488ff, wireframe: true, transparent: true, opacity: 0.8 })
        this.dragGhost = new THREE.Mesh(geo, mat)
        this.scene.add(this.dragGhost)
      }
      const { cx: snapX, cz: snapZ } = this.computeSnap(gx, gz, this.dragW, this.dragH)
      this.dragGhost.position.set(snapX, 0.05, snapZ)
      return
    }

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
    if (this.dragId) {
      this.endDrag()
      return
    }
    this.isPanning = false
    this.renderer.domElement.style.cursor = this.editMode ? 'move' : 'grab'
  }

  private onContextMenu = (e: Event): void => {
    e.preventDefault()
  }

  // ── Edit-mode drag helpers ────────────────────────────────────────────────

  setEditMode(enabled: boolean): void {
    this.editMode = enabled
    // Leaving edit mode mid-drag commits the in-progress move rather than orphaning state.
    if (!enabled && this.dragId) this.endDrag()
    this.renderer.domElement.style.cursor = enabled ? 'move' : 'grab'
  }

  private clientToNdc(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect()
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width)  * 2 - 1,
      -((clientY - rect.top)  / rect.height) * 2 + 1,
    )
  }

  /** Raycast the component hit meshes; returns the topmost component id or null. */
  private pickComponent(clientX: number, clientY: number): string | null {
    this.dragRay.setFromCamera(this.clientToNdc(clientX, clientY), this.camera)
    const meshes: THREE.Object3D[] = []
    for (const cm of this.components.values()) meshes.push(cm.hitMesh)
    const hits = this.dragRay.intersectObjects(meshes, false)
    return hits.length ? (hits[0].object.userData.componentId as string) : null
  }

  /** Project a screen pointer onto the y=0 ground plane. Camera always looks
   *  down at an angle, so ray.direction.y is non-zero and the solve is stable. */
  private pointerToGround(clientX: number, clientY: number): THREE.Vector3 {
    this.dragRay.setFromCamera(this.clientToNdc(clientX, clientY), this.camera)
    const ray = this.dragRay.ray
    const t   = -ray.origin.y / ray.direction.y
    return ray.origin.clone().add(ray.direction.clone().multiplyScalar(t))
  }

  /** Compute the snapped grid position from a raw center (world coords). */
  private computeSnap(centerX: number, centerZ: number, w: number, h: number): { col: number; row: number; cx: number; cz: number } {
    const cols = this.graph.gridBounds.maxX / CELL_SIZE
    const rows = this.graph.gridBounds.maxZ / CELL_SIZE
    const raw  = worldToGrid(centerX - (w / 2) * CELL_SIZE, centerZ - (h / 2) * CELL_SIZE)
    const col  = Math.min(Math.max(raw.col, 0), Math.max(0, Math.round(cols - w)))
    const row  = Math.min(Math.max(raw.row, 0), Math.max(0, Math.round(rows - h)))
    return { col, row, cx: (col + w / 2) * CELL_SIZE, cz: (row + h / 2) * CELL_SIZE }
  }

  private endDrag(): void {
    const id    = this.dragId
    const group = this.dragGroup
    if (id && group && this.dragMoved) {
      const cm = this.components.get(id)!
      const ic = this.graph.components.get(id)!

      // Snap to nearest grid cell
      const { cx, cz } = this.computeSnap(group.position.x, group.position.z, this.dragW, this.dragH)

      // Commit snapped position to model and mesh
      ic.center.set(cx, 0, cz)
      ic.topCenter.set(cx, ic.meshSize.y, cz)
      cm.topCenter.set(cx, ic.meshSize.y, cz)
      group.position.set(cx, this.dragOriginY, cz)

      // Final pipe rebuild at snapped position
      for (const [connId, conn] of this.graph.connections) {
        if (conn.from.id === id || conn.to.id === id) this.pipes.get(connId)?.update()
      }

      // Brief scale-bounce to signal the snap commit
      new Tween({ t: 0 }, tweenGroup)
        .to({ t: 1 }, 300)
        .onUpdate(({ t }) => { group.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.1) })
        .onComplete(() => { group.scale.setScalar(1.0) })
        .start()
    } else if (group) {
      group.position.y = this.dragOriginY
    }
    this.clearDrag()
  }

  private clearDrag(): void {
    if (this.dragPointerId !== null) {
      try { this.renderer.domElement.releasePointerCapture(this.dragPointerId) } catch { /* already released */ }
    }
    if (this.dragGhost) {
      this.scene.remove(this.dragGhost)
      this.dragGhost.geometry.dispose()
      ;(this.dragGhost.material as THREE.Material).dispose()
      this.dragGhost = null
    }
    this.dragId        = null
    this.dragGroup     = null
    this.dragPointerId = null
    this.dragMoved     = false
    this.renderer.domElement.style.cursor = this.editMode ? 'move' : 'grab'
  }

  setHoverCallback(fn: (id: string | null) => void): void {
    this.hoverSystem.setOnHoverChange(fn)
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
    const phaseMaterial = durationMs * PHASE_MATERIAL_RATIO

    // 1. Dispose all active packets, clear traversal state, clear penetration
    for (const [, pipeId] of this.packetPipeMap) {
      this.pipes.get(pipeId)?.setPacketTraversing(false, phaseMaterial)
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

    // 1b. Dispose previous streams
    for (const s of this.activeStreams) s.dispose()
    this.activeStreams = []

    // 2. Transition component materials
    for (const [id, mesh] of this.components) {
      const state: MeshState = step.highlight.includes(id)
        ? 'highlighted'
        : step.highlight.length > 0
          ? 'dimmed'
          : 'idle'
      mesh.transitionTo(state, phaseMaterial)
    }

    // 3. Transition pipe materials (active_connections → medium brightness)
    for (const [id, pipe] of this.pipes) {
      const active = step.active_connections.includes(id)
      pipe.setActive(active, phaseMaterial)
    }

    // 4. Launch all packets — each pipe flares to full brightness while a packet is on it
    const packetDefs = [
      ...(step.packet  ? [step.packet]    : []),
      ...(step.packets ?? []),
    ]
    packetDefs.forEach((def, i) => {
      const pipe = this.pipes.get(def.connection)
      if (!pipe) return
      const conn   = this.graph.connections.get(def.connection)
      const packet = new DataPacket(this.scene, def.shape, this.currentTheme)
      const ud: PacketMeshUserData = {
        componentId: `__packet__${i}`,
        packetLabel: conn?.label ?? def.connection,
        packetShape: def.shape,
        packetData:  def.data,
      }
      Object.assign(packet.mesh.userData, ud)
      if (def.arrivalStyle) packet.setArrivalStyle(def.arrivalStyle)
      this.hoverSystem.addTarget(packet.mesh)
      this.activePackets.push(packet)
      this.packetPipeMap.set(packet, def.connection)
      pipe.setPacketTraversing(true, 200)
      packet.travel(pipe.curve, PACKET_TRAVEL_MS, def.direction === 'reverse')
    })

    // 6. Launch chevron streams
    const streamDefs = [
      ...(step.stream  ? [step.stream]    : []),
      ...(step.streams ?? []),
    ]
    for (const def of streamDefs) {
      const pipe = this.pipes.get(def.connection)
      if (!pipe) continue
      const color = def.color
        ? new THREE.Color(def.color).getHex()
        : THEME_COLORS[this.currentTheme].packetColor
      this.activeStreams.push(new ChevronStream(this.scene, pipe.curve, color))
    }
  }

  override resize(width: number, height: number): void {
    const aspect = width / height || 1
    this.camera.left   = -this.currentFrustum * aspect
    this.camera.right  =  this.currentFrustum * aspect
    this.camera.top    =  this.currentFrustum
    this.camera.bottom = -this.currentFrustum
    this.camera.position.set(this.cameraTarget.x + CAMERA_HEIGHT, CAMERA_HEIGHT, this.cameraTarget.z + CAMERA_HEIGHT)
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

  getPacketMesh(id: string): THREE.Mesh | null {
    return this.activePackets.find(p => p.mesh.userData.componentId === id)?.mesh ?? null
  }

  protected onFrame(_deltaMs: number): void {
    if (!this.isPanning) this.hoverSystem.update()

    const now = performance.now()
    for (const s of this.activeStreams) s.update(now)
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
          if (!stillTraveling) this.pipes.get(pipeId)?.setPacketTraversing(false, PIPE_DIM_DELAY_MS)

          const conn   = this.graph.connections.get(pipeId)
          const destId = packet.reversed ? conn?.from.id : conn?.to.id
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
      if (!this.penetratedIds.has(id)) {
        this.components.get(id)?.setPenetrated(true)
      }
    }
    for (const id of this.penetratedIds) {
      if (!next.has(id)) {
        this.components.get(id)?.setPenetrated(false)
      }
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
    for (const s of this.activeStreams) s.dispose()
    this.activeStreams = []
    this.penetratedIds.clear()
    super.dispose()
  }
}
