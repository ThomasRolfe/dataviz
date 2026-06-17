import * as THREE from 'three'
import * as brandIcons from '@fortawesome/free-brands-svg-icons'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

type FAIconTuple = [number, number, string[], string, string | string[]]
type FAIconEntry = { icon: FAIconTuple }

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
 * Uses a canvas texture on a PlaneGeometry rather than floating ShapeGeometry,
 * which eliminates z-fighting entirely (the orthographic camera near=0.1/far=1000
 * gives too few depth levels for a sub-unit gap in swiftshader).
 *
 * boxMat  — component colour material (used for the box body)
 * iconMat — white icon material (receives the canvas texture map)
 */
const TEX_SIZE = 256

function buildIconBoxMeshes(
  svgPaths: string[],
  vbW:     number,
  vbH:     number,
  meshSize: THREE.Vector3,
  boxMat:  THREE.MeshStandardMaterial,
  iconMat: THREE.MeshBasicMaterial,
): THREE.Mesh[] {
  const boxY = -meshSize.y / 2 + BOX_H / 2
  const box  = buildBox(meshSize, boxMat, boxY)
  if (svgPaths.length === 0) return [box]

  // Draw FA paths onto a 2-D canvas using the browser Path2D API.
  // The canvas context handles the evenodd fill rule correctly, avoiding
  // the winding / hole misinterpretation that THREE.SVGLoader can produce.
  const canvas = document.createElement('canvas')
  canvas.width  = TEX_SIZE
  canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = `#${iconMat.color.getHexString()}`

  const fill = 0.78
  const s    = Math.min(TEX_SIZE * fill / vbW, TEX_SIZE * fill / vbH)
  const ox   = (TEX_SIZE - vbW * s) / 2
  const oy   = (TEX_SIZE - vbH * s) / 2

  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(s, s)
  for (const d of svgPaths) ctx.fill(new Path2D(d), 'evenodd')
  ctx.restore()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace

  // Apply texture to the shared iconMat (each ComponentMesh has its own instance).
  // polygonOffset pushes the face forward in the depth buffer, defeating any
  // residual z-fighting even when both box and icon are in the transparent pass.
  iconMat.map                = tex
  iconMat.polygonOffset      = true
  iconMat.polygonOffsetFactor = -2
  iconMat.polygonOffsetUnits  = -2
  iconMat.needsUpdate        = true

  // PlaneGeometry lying flat on top of the box, face up
  const planeY = -meshSize.y / 2 + BOX_H + 0.01
  const face   = new THREE.Mesh(
    new THREE.PlaneGeometry(meshSize.x * 0.88, meshSize.z * 0.88),
    iconMat,
  )
  face.rotation.x  = -Math.PI / 2
  face.position.y  = planeY
  face.renderOrder = 1

  return [box, face]
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
