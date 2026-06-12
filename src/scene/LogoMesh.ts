import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import * as brandIcons from '@fortawesome/free-brands-svg-icons'
import { COMPONENT_GAP } from '@/engine/layoutEngine'

// Font Awesome icon tuple: [width, height, aliases, unicode, svgPathData]
type FAIconTuple = [number, number, string[], string, string | string[]]
type FAIconEntry = { icon: FAIconTuple }

const svgLoader = new SVGLoader()

function resolveIcon(logoName: string): { paths: string[]; width: number; height: number } | null {
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

  const allShapes: THREE.Shape[] = []
  for (const path of paths) {
    allShapes.push(...SVGLoader.createShapes(path))
  }
  if (allShapes.length === 0) return []

  // Measure bounding box using ShapeGeometry (flat, no extrusion)
  const tempBox = new THREE.Box3()
  for (const shape of allShapes) {
    const g = new THREE.ShapeGeometry(shape)
    g.computeBoundingBox()
    if (g.boundingBox) tempBox.union(g.boundingBox)
    g.dispose()
  }

  const svgSize   = tempBox.getSize(new THREE.Vector3())
  const svgCenter = tempBox.getCenter(new THREE.Vector3())

  // Scale logo to fill ~90% of one grid cell (undo COMPONENT_GAP shrink, then 90%)
  const uniformScale = Math.min(
    (meshSize.x / COMPONENT_GAP * 0.9) / svgSize.x,
    (meshSize.z / COMPONENT_GAP * 0.9) / svgSize.y,
  )

  // Center → scale+flipY (SVG is Y-down) → rotate flat into XZ plane
  // RotateX(-PI/2): (x, y, 0) → (x, 0, -y), so the shape lies flat on XZ
  // Normals: (0,0,1) → (0,1,0) after the rotation → lit correctly from above
  const transform = new THREE.Matrix4()
    .premultiply(new THREE.Matrix4().makeTranslation(-svgCenter.x, -svgCenter.y, 0))
    .premultiply(new THREE.Matrix4().makeScale(uniformScale, -uniformScale, uniformScale))
    .premultiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))

  // The component group origin sits at world y = meshSize.y / 2.
  // Translate the logo down so it rests at world y ≈ 0 (ground level).
  const yOffset = -meshSize.y / 2 + 0.02

  return allShapes.map(shape => {
    const geo = new THREE.ShapeGeometry(shape)
    geo.applyMatrix4(transform)
    geo.translate(0, yOffset, 0)
    return new THREE.Mesh(geo, mat)
  })
}
