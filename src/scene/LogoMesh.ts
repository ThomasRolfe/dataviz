import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import * as brandIcons from '@fortawesome/free-brands-svg-icons'
import { COMPONENT_GAP } from '@/engine/layoutEngine'

// Font Awesome icon tuple: [width, height, aliases, unicode, svgPathData]
type FAIconTuple = [number, number, string[], string, string | string[]]
type FAIconEntry = { icon: FAIconTuple }

const svgLoader = new SVGLoader()
const WORLD_EXTRUDE_DEPTH = 0.08  // world-unit depth for the extrusion

function resolveIcon(logoName: string): { paths: string[]; width: number; height: number } | null {
  // "stripe" → "faStripe", "github" → "faGithub", etc.
  const key = `fa${logoName.charAt(0).toUpperCase()}${logoName.slice(1)}`
  const entry = (brandIcons as Record<string, unknown>)[key] as FAIconEntry | undefined
  if (!entry?.icon) return null
  const [width, height, , , svgPathData] = entry.icon
  const paths = Array.isArray(svgPathData) ? svgPathData : [svgPathData]
  return { paths, width, height }
}

export function buildLogoMeshes(
  logoName:  string,
  meshSize:  THREE.Vector3,
  mat:       THREE.MeshStandardMaterial,
): THREE.Mesh[] {
  const resolved = resolveIcon(logoName)
  if (!resolved) {
    console.warn(`[LogoMesh] Unknown logo: "${logoName}". Use a Font Awesome brands icon name (e.g. "stripe", "github").`)
    return []
  }

  const { paths: pathStrings, width: vbW, height: vbH } = resolved
  const svgStr  = `<svg viewBox="0 0 ${vbW} ${vbH}">${pathStrings.map(d => `<path d="${d}"/>`).join('')}</svg>`
  const { paths } = svgLoader.parse(svgStr)

  // Collect all Shape objects from all SVG paths
  const allShapes: THREE.Shape[] = []
  for (const path of paths) {
    allShapes.push(...SVGLoader.createShapes(path))
  }
  if (allShapes.length === 0) return []

  // Measure the SVG bounding box before scaling (need a dummy extrude)
  const probe = new THREE.ExtrudeGeometry(allShapes[0], { depth: 1, bevelEnabled: false })
  const tempBox = new THREE.Box3()
  for (const shape of allShapes) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false })
    g.computeBoundingBox()
    if (g.boundingBox) tempBox.union(g.boundingBox)
    g.dispose()
  }
  probe.dispose()

  const svgSize   = tempBox.getSize(new THREE.Vector3())
  const svgCenter = tempBox.getCenter(new THREE.Vector3())

  // Scale logo to fill ~90% of one grid cell (undo COMPONENT_GAP shrink, then 90%)
  const uniformScale = Math.min(
    (meshSize.x / COMPONENT_GAP * 0.9) / svgSize.x,
    (meshSize.z / COMPONENT_GAP * 0.9) / svgSize.y,
  )

  // Extrusion depth in SVG units → equals WORLD_EXTRUDE_DEPTH after scaling
  const extrudeDepthSVG = WORLD_EXTRUDE_DEPTH / uniformScale

  // Combined transform: centre → scale+flipY → rotate flat into XZ plane
  // Rx(-PI/2): (X, Y, Z) → (X, -Z, Y)
  // With flipY on scale: SVG Y-down converts to Three.js Y-up before rotation
  const transform = new THREE.Matrix4()
    .premultiply(new THREE.Matrix4().makeTranslation(-svgCenter.x, -svgCenter.y, 0))
    .premultiply(new THREE.Matrix4().makeScale(uniformScale, -uniformScale, uniformScale))
    .premultiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))

  return allShapes.map(shape => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: extrudeDepthSVG,
      bevelEnabled: false,
    })
    geo.applyMatrix4(transform)
    // After rotation the extrusion points downward; lift so bottom face is at Y=0
    geo.translate(0, WORLD_EXTRUDE_DEPTH, 0)
    return new THREE.Mesh(geo, mat)
  })
}
