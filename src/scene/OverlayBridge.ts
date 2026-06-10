import * as THREE from 'three'

export class OverlayBridge {
  constructor(
    private camera:   THREE.OrthographicCamera,
    private renderer: THREE.WebGLRenderer
  ) {}

  worldToScreen(worldPos: THREE.Vector3): { x: number; y: number } {
    const ndc = worldPos.clone().project(this.camera)
    const canvas = this.renderer.domElement
    return {
      x:  (ndc.x + 1) / 2 * canvas.clientWidth,
      y: -(ndc.y - 1) / 2 * canvas.clientHeight,
    }
  }
}
