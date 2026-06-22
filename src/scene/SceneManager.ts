import * as THREE from 'three'
import * as TWEEN from '@tweenjs/tween.js'

const FRUSTUM = 12

export class SceneManager {
  renderer: THREE.WebGLRenderer
  scene:    THREE.Scene
  camera:   THREE.OrthographicCamera
  clock:    THREE.Clock

  private rafId: number | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x1a1a2e)

    const { width, height } = canvas.getBoundingClientRect()
    const w = width  || canvas.clientWidth  || 800
    const h = height || canvas.clientHeight || 600
    const aspect = w / h

    this.camera = new THREE.OrthographicCamera(
      -FRUSTUM * aspect,
       FRUSTUM * aspect,
       FRUSTUM,
      -FRUSTUM,
       0.1,
       1000
    )

    const D = 50
    this.camera.position.set(D, D, D)
    this.camera.lookAt(0, 0, 0)
    this.camera.up.set(0, 1, 0)

    this.scene = new THREE.Scene()
    this.clock = new THREE.Clock()
    this.renderer.setSize(w, h, false)
  }

  dispose(): void {
    this.renderer.dispose()
  }

  resize(width: number, height: number): void {
    const aspect = width / height
    this.camera.left   = -FRUSTUM * aspect
    this.camera.right  =  FRUSTUM * aspect
    this.camera.top    =  FRUSTUM
    this.camera.bottom = -FRUSTUM
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  startLoop(): void {
    const tick = () => {
      this.rafId = requestAnimationFrame(tick)
      const delta = this.clock.getDelta()
      TWEEN.update()
      this.onFrame(delta * 1000)
      this.renderer.render(this.scene, this.camera)
    }
    this.clock.start()
    tick()
  }

  stopLoop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  captureFrame(): string {
    return this.renderer.domElement.toDataURL('image/png')
  }

  protected onFrame(_deltaMs: number): void {}
}
