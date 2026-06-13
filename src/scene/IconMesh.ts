import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import * as brandIcons from '@fortawesome/free-brands-svg-icons'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

type FAIconTuple = [number, number, string[], string, string | string[]]
type FAIconEntry = { icon: FAIconTuple }

const svgLoader = new SVGLoader()

const BOX_H = 0.30  // fixed height for all icon-box components

function resolveIcon(
  name: string,
  pack: Record<string, unknown>,
): { paths: string[]; width: number; height: number } | null {
  const key   = `fa${name.charAt(0).toUpperCase()}${name.slice(1)}`
  const entry = pack[key] as FAIconEntry | undefined
  if (!entry?.icon) return null
  const [width, height, , , svgPathData] = entry.icon
  const paths = Array.isArray(svgPathData) ? svgPathData : [svgPathData]
  return { paths, width, height }
}

/**
 * Build a thin coloured box with a flat white icon face on top.
 *
 * boxMat  — component colour material (used for the box body)
 * iconMat — white icon material (used for the SVG face on top)
 */
function buildIconBoxMeshes(
  svgPaths: string[],
  vbW:     number,
  vbH:     number,
  meshSize: THREE.Vector3,
  boxMat:  THREE.MeshStandardMaterial,
  iconMat: THREE.MeshBasicMaterial,
): THREE.Mesh[] {
  const svgStr   = `<svg viewBox="0 0 ${vbW} ${vbH}">${svgPaths.map(d => `<path d="${d}"/>`).join('')}</svg>`
  const { paths } = svgLoader.parse(svgStr)

  const allShapes: THREE.Shape[] = []
  for (const path of paths) allShapes.push(...SVGLoader.createShapes(path))
  if (allShapes.length === 0) return [buildBox(meshSize, boxMat)]

  // Measure SVG bounding box
  const tempBox = new THREE.Box3()
  for (const shape of allShapes) {
    const g = new THREE.ShapeGeometry(shape)
    g.computeBoundingBox()
    if (g.boundingBox) tempBox.union(g.boundingBox)
    g.dispose()
  }
  const svgSize   = tempBox.getSize(new THREE.Vector3())
  const svgCenter = tempBox.getCenter(new THREE.Vector3())

  // Scale icon to fill 72% of the box footprint
  const uniformScale = Math.min(
    meshSize.x * 0.72 / svgSize.x,
    meshSize.z * 0.72 / svgSize.y,
  )

  // Center → flipY → rotateX(-PI/2): SVG lies flat on the XZ plane, face up
  const transform = new THREE.Matrix4()
    .premultiply(new THREE.Matrix4().makeTranslation(-svgCenter.x, -svgCenter.y, 0))
    .premultiply(new THREE.Matrix4().makeScale(uniformScale, -uniformScale, uniformScale))
    .premultiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))

  // Group origin is at world y = center.y + meshSize.y/2.
  // Box base at ground (world y=0) → local y offset = -meshSize.y/2 + BOX_H/2
  const boxY  = -meshSize.y / 2 + BOX_H / 2
  // Icon face sits just above box top
  const iconY = -meshSize.y / 2 + BOX_H + 0.004

  const box   = buildBox(meshSize, boxMat, boxY)
  const icons = allShapes.map(shape => {
    const geo = new THREE.ShapeGeometry(shape)
    geo.applyMatrix4(transform)
    geo.translate(0, iconY, 0)
    return new THREE.Mesh(geo, iconMat)
  })

  return [box, ...icons]
}

function buildBox(
  meshSize: THREE.Vector3,
  mat: THREE.MeshStandardMaterial,
  localY = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(meshSize.x, BOX_H, meshSize.z), mat)
  m.position.y = localY
  return m
}

// ── Public builders ───────────────────────────────────────────────────────────

export function buildBrandIconMeshes(
  logoName: string,
  meshSize: THREE.Vector3,
  boxMat:  THREE.MeshStandardMaterial,
  iconMat: THREE.MeshBasicMaterial,
): THREE.Mesh[] {
  const resolved = resolveIcon(logoName, brandIcons as Record<string, unknown>)
  if (!resolved) {
    console.warn(`[IconMesh] Unknown brand icon: "${logoName}"`)
    return [buildBox(meshSize, boxMat, -meshSize.y / 2 + BOX_H / 2)]
  }
  return buildIconBoxMeshes(resolved.paths, resolved.width, resolved.height, meshSize, boxMat, iconMat)
}

export function buildSolidIconMeshes(
  iconName: string,
  meshSize: THREE.Vector3,
  boxMat:  THREE.MeshStandardMaterial,
  iconMat: THREE.MeshBasicMaterial,
): THREE.Mesh[] {
  const resolved = resolveIcon(iconName, solidIcons as Record<string, unknown>)
  if (!resolved) {
    console.warn(`[IconMesh] Unknown solid icon: "${iconName}"`)
    return [buildBox(meshSize, boxMat, -meshSize.y / 2 + BOX_H / 2)]
  }
  return buildIconBoxMeshes(resolved.paths, resolved.width, resolved.height, meshSize, boxMat, iconMat)
}
