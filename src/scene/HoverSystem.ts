import * as THREE from 'three'

export class HoverSystem {
  private raycaster:     THREE.Raycaster
  private pointer:       THREE.Vector2
  private targets:       THREE.Object3D[]
  private camera:        THREE.OrthographicCamera
  private canvas:        HTMLCanvasElement
  private onHoverChange: (id: string | null) => void
  private lastHoveredId: string | null = null

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.OrthographicCamera,
    onHoverChange: (id: string | null) => void
  ) {
    this.raycaster     = new THREE.Raycaster()
    this.pointer       = new THREE.Vector2()
    this.targets       = []
    this.camera        = camera
    this.canvas        = canvas
    this.onHoverChange = onHoverChange

    this.onMouseMove = this.onMouseMove.bind(this)
    canvas.addEventListener('mousemove', this.onMouseMove)
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1
    this.pointer.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1
  }

  update(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const intersects = this.raycaster.intersectObjects(this.targets)

    const hit = intersects.length > 0 ? intersects[0].object : null
    const hoveredId = (hit?.userData?.componentId as string | undefined) ?? null

    if (hoveredId !== this.lastHoveredId) {
      this.lastHoveredId = hoveredId
      this.onHoverChange(hoveredId)
    }
  }

  addTarget(mesh: THREE.Object3D): void {
    this.targets.push(mesh)
  }

  removeTarget(mesh: THREE.Object3D): void {
    const idx = this.targets.indexOf(mesh)
    if (idx !== -1) this.targets.splice(idx, 1)
  }

  dispose(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
  }
}
