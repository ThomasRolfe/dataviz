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
import { setupLighting } from '@/scene/LightingSetup'
import type { InternalGraph } from '@/types/internal'
import type { Step } from '@/types/schema'
import { CELL_SIZE } from '@/engine/layoutEngine'

export class FlowScene extends SceneManager {
  private graph:          InternalGraph
  private components:     Map<string, ComponentMesh>
  private pipes:          Map<string, ConnectionPipe>
  private zones:          ZoneRenderer[]
  private grid:           GridFloor
  private activePacket:   DataPacket | null = null
  private hoverSystem:    HoverSystem
  private overviewTarget: THREE.Vector3
  private overviewFrustum: number
  cameraTarget:   THREE.Vector3
  currentFrustum: number
  overlayBridge:  OverlayBridge

  constructor(canvas: HTMLCanvasElement, graph: InternalGraph) {
    super(canvas)
    this.graph = graph

    setupLighting(this.scene)

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

    this.startLoop()
  }

  setHoverCallback(fn: (id: string | null) => void): void {
    this.hoverSystem['onHoverChange'] = fn
  }

  applyStep(step: Step, _prevStep: Step | null, durationMs: number): void {
    const PHASE_MATERIAL = durationMs * 0.4
    const PHASE_PACKET   = durationMs * 0.8
    const PHASE_CAMERA   = durationMs * 0.3

    // 1. Dispose active packet from previous step
    if (this.activePacket) {
      this.activePacket.dispose(this.scene)
      this.activePacket = null
    }

    // 2. Transition component materials
    for (const [id, mesh] of this.components) {
      const state: MeshState = step.highlight.includes(id)
        ? 'highlighted'
        : step.highlight.length > 0
          ? 'dimmed'
          : 'idle'
      mesh.transitionTo(state, PHASE_MATERIAL)
    }

    // 3. Transition pipe materials
    for (const [id, pipe] of this.pipes) {
      const active = step.active_connections.includes(id)
      pipe.setActive(active, PHASE_MATERIAL)
    }

    // 4. Animate camera
    this.animateCamera(step.camera, PHASE_CAMERA)

    // 5. Animate packet
    if (step.packet) {
      const pipe = this.pipes.get(step.packet.connection)
      if (pipe) {
        const packet = new DataPacket(this.scene, step.packet.shape)
        this.activePacket = packet
        packet.travel(pipe.curve, Math.max(PHASE_PACKET, 100))
      }
    }
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
    const aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight || 1

    new TWEEN.Tween({
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

  getZoneLabelData(): Array<{ label: string; position: THREE.Vector3; color: string }> {
    return this.graph.zones.map((zone, i) => ({
      label:    zone.label,
      position: this.zones[i].labelPosition,
      color:    '#' + zone.color.getHexString(),
    }))
  }

  protected onFrame(_deltaMs: number): void {
    this.hoverSystem.update()
    if (this.activePacket) {
      const done = this.activePacket.update(performance.now())
      if (done) {
        this.activePacket.dispose(this.scene)
        this.activePacket = null
      }
    }
  }

  dispose(): void {
    this.stopLoop()
    this.hoverSystem.dispose()
    this.grid.dispose(this.scene)
    for (const z of this.zones) z.dispose(this.scene)
    for (const cm of this.components.values()) cm.dispose(this.scene)
    for (const pipe of this.pipes.values()) pipe.dispose(this.scene)
    if (this.activePacket) {
      this.activePacket.dispose(this.scene)
      this.activePacket = null
    }
    super.dispose()
  }
}
