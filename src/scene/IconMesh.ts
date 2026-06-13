import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import { COMPONENT_GAP } from '@/engine/layoutEngine'

// Font Awesome icon tuple: [width, height, aliases, unicode, svgPathData]
type FAIconTuple = [number, number, string[], string, string | string[]]
type FAIconEntry = { icon: FAIconTuple }

const svgLoader = new SVGLoader()

function resolveSolidIcon(name: string): { paths: string[]; width: number; height: number } | null {
  const key = `fa${name.charAt(0).toUpperCase()}${name.slice(1)}`
  const entry = (solidIcons as Record<string, unknown>)[key] as FAIconEntry | undefined
  if (!entry?.icon) return null
  const [width, height, , , svgPathData] = entry.icon
  const paths = Array.isArray(svgPathData) ? svgPathData : [svgPathData]
  return { paths, width, height }
}

/**
 * Build meshes for a Font Awesome solid icon, extruded upward from the ground plane.
 * The icon lies flat on the XZ plane and the extrusion direction is +Y, giving a
 * 3D relief that rises out of the ground — readable from any isometric angle.
 */
export function buildSolidIconMeshes(
  iconName: string,
  meshSize: THREE.Vector3,
  mat:      THREE.MeshStandardMaterial,
  fillRatio = 0.82,  // fraction of grid cell to fill (default slightly smaller than logos)
): THREE.Mesh[] {
  const resolved = resolveSolidIcon(iconName)
  if (!resolved) {
    console.warn(`[IconMesh] Unknown solid icon: "${iconName}"`)
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

  // Measure bounding box
  const tempBox = new THREE.Box3()
  for (const shape of allShapes) {
    const g = new THREE.ShapeGeometry(shape)
    g.computeBoundingBox()
    if (g.boundingBox) tempBox.union(g.boundingBox)
    g.dispose()
  }

  const svgSize   = tempBox.getSize(new THREE.Vector3())
  const svgCenter = tempBox.getCenter(new THREE.Vector3())

  // Scale icon to fill `fillRatio` of one grid cell
  const uniformScale = Math.min(
    (meshSize.x / COMPONENT_GAP * fillRatio) / svgSize.x,
    (meshSize.z / COMPONENT_GAP * fillRatio) / svgSize.y,
  )

  // Extrude upward — after rotateX(-PI/2), the SVG Z (extrusion) maps to world +Y
  const extrudeDepth = meshSize.y * 0.65
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth:          extrudeDepth / uniformScale,  // in SVG space (undone by scale)
    bevelEnabled:   true,
    bevelThickness: (meshSize.y * 0.04) / uniformScale,
    bevelSize:      (meshSize.y * 0.03) / uniformScale,
    bevelSegments:  2,
  }

  // Center → scale+flipY (SVG Y-down) → rotateX(-PI/2): shape lies flat on XZ, extrusion goes up
  const transform = new THREE.Matrix4()
    .premultiply(new THREE.Matrix4().makeTranslation(-svgCenter.x, -svgCenter.y, 0))
    .premultiply(new THREE.Matrix4().makeScale(uniformScale, -uniformScale, uniformScale))
    .premultiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))

  // Group origin is at world y = center.y + meshSize.y/2.
  // Put the icon base at ground level (world y ≈ 0).
  const yOffset = -meshSize.y / 2 + 0.01

  return allShapes.map(shape => {
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    geo.applyMatrix4(transform)
    geo.translate(0, yOffset, 0)
    return new THREE.Mesh(geo, mat)
  })
}
