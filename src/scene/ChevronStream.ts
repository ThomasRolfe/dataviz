import * as THREE from 'three'

const COUNT     = 6
const PERIOD_MS = 1800

// Flat arrowhead chevron shape, pointing in +X direction in local XZ space
// Made large enough to be clearly visible against glass tubes
const W  = 0.22   // half-span across the tube
const TIP = 0.30  // forward tip distance
const T   = 0.07  // stem thickness (half)

function buildChevronGeo(): THREE.BufferGeometry {
  // Arrowhead "> " lying flat in XZ plane (Y=0).
  // +X points forward (along tube tangent), +Z is lateral.
  const shape = new THREE.Shape()
  shape.moveTo(TIP,    0)          // leading tip
  shape.lineTo(0,      W)          // outer top
  shape.lineTo(0,      T)          // inner top shoulder
  shape.lineTo(-TIP * 0.5, T)     // tail top
  shape.lineTo(-TIP * 0.5, -T)    // tail bottom
  shape.lineTo(0,      -T)         // inner bottom shoulder
  shape.lineTo(0,      -W)         // outer bottom
  shape.closePath()
  const geo = new THREE.ShapeGeometry(shape)
  // Rotate from XY plane to XZ plane (flat on ground)
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
  return geo
}

export class ChevronStream {
  private meshes: THREE.Mesh[]
  private geo:    THREE.BufferGeometry
  private mat:    THREE.MeshBasicMaterial
  private scene:  THREE.Scene
  private curve:  THREE.Curve<THREE.Vector3>

  constructor(scene: THREE.Scene, curve: THREE.Curve<THREE.Vector3>, color: number) {
    this.scene = scene
    this.curve = curve

    this.geo = buildChevronGeo()
    this.mat = new THREE.MeshBasicMaterial({
      color,
      side:       THREE.DoubleSide,
      depthWrite: false,
    })

    this.meshes = Array.from({ length: COUNT }, () => {
      const m = new THREE.Mesh(this.geo, this.mat)
      m.renderOrder = 2
      scene.add(m)
      return m
    })
  }

  update(now: number): void {
    const phase = (now % PERIOD_MS) / PERIOD_MS

    for (let i = 0; i < COUNT; i++) {
      const t   = (phase + i / COUNT) % 1
      const pos = this.curve.getPointAt(t)
      const tan = this.curve.getTangentAt(t)

      // Project tangent onto horizontal plane and rotate around Y axis
      // so the chevron arrow points in the direction of travel (flat in XZ plane)
      const angle = Math.atan2(tan.x, tan.z)

      const mesh = this.meshes[i]
      mesh.position.copy(pos)
      mesh.rotation.set(0, angle, 0)
    }
  }

  dispose(): void {
    for (const m of this.meshes) this.scene.remove(m)
    this.geo.dispose()
    this.mat.dispose()
  }
}
