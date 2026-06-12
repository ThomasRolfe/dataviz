import * as THREE from 'three'
import type { ComponentType, ComponentShape } from '@/types/schema'

// ── type-based fallback geometries (existing behaviour) ───────────────────────

function buildTypeMesh(
  type: ComponentType,
  size: THREE.Vector3,
  mat: THREE.MeshStandardMaterial,
): THREE.Mesh[] {
  const { x: w, y: h, z: d } = size
  let geo: THREE.BufferGeometry
  switch (type) {
    case 'database':
      geo = new THREE.CylinderGeometry(w / 2, w / 2, h, 24)
      break
    case 'queue':
      geo = new THREE.BoxGeometry(w, h * 0.5, d)
      break
    case 'function':
      geo = new THREE.OctahedronGeometry(Math.min(w, d) * 0.45)
      break
    default:
      geo = new THREE.BoxGeometry(w, h, d)
  }
  return [new THREE.Mesh(geo, mat)]
}

// ── iconic shape builders ─────────────────────────────────────────────────────
// All positions are in group-local space centred at origin (y spans -h/2 → +h/2).

function buildStack(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  const r     = Math.min(size.x, size.z) * 0.42
  const diskH = size.y * 0.22
  const gap   = size.y * 0.08
  return [-1, 0, 1].map(i => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * (i === -1 ? 0.93 : 1.0), diskH, 32),
      mat,
    )
    m.position.y = i * (diskH + gap)
    return m
  })
}

function buildCloud(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  const s = Math.min(size.x, size.z) * 0.5
  const yScale = size.y / (s * 1.4)
  // [xFrac, zFrac, radiusFrac] all relative to s
  const configs: Array<[number, number, number]> = [
    [ 0.00,  0.00, 0.80],  // main centre
    [-0.55,  0.00, 0.55],  // left
    [ 0.55,  0.00, 0.55],  // right
    [-0.28, -0.45, 0.50],  // front-left
    [ 0.28, -0.45, 0.50],  // front-right
    [ 0.00,  0.50, 0.42],  // back
  ]
  return configs.map(([xf, zf, rf]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(rf * s, 12, 8), mat)
    m.position.set(xf * s, 0, zf * s)
    m.scale.y = yScale
    return m
  })
}

function buildServer(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  // Flat 1U-style rack body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y * 0.55, size.z * 0.75),
    mat,
  )
  body.position.y = -size.y * 0.12

  // Front bezel strip
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.9, size.y * 0.35, size.z * 0.08),
    mat,
  )
  bezel.position.set(0, -size.y * 0.12, size.z * 0.38)

  // Drive bay indicator (small raised panel)
  const bay = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.35, size.y * 0.18, size.z * 0.06),
    mat,
  )
  bay.position.set(-size.x * 0.22, size.y * 0.20, size.z * 0.38)

  return [body, bezel, bay]
}

function buildDesktop(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  // Monitor screen
  const monitor = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.88, size.y * 0.54, size.z * 0.07),
    mat,
  )
  monitor.position.set(0, size.y * 0.18, 0)

  // Neck
  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.06, size.y * 0.22, size.z * 0.06),
    mat,
  )
  neck.position.set(0, -size.y * 0.18, 0)

  // Base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.50, size.y * 0.06, size.z * 0.32),
    mat,
  )
  base.position.set(0, -size.y * 0.30, 0)

  return [monitor, neck, base]
}

function buildSmartphone(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  // Phone body — portrait orientation, standing upright
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.50, size.y * 0.96, size.z * 0.10),
    mat,
  )

  // Home button (small disc on front face)
  const btn = new THREE.Mesh(
    new THREE.CylinderGeometry(size.x * 0.065, size.x * 0.065, size.z * 0.025, 16),
    mat,
  )
  btn.rotation.x = Math.PI / 2
  btn.position.set(0, -size.y * 0.38, size.z * 0.06)

  // Camera bump
  const cam = new THREE.Mesh(
    new THREE.CylinderGeometry(size.x * 0.05, size.x * 0.05, size.z * 0.025, 12),
    mat,
  )
  cam.rotation.x = Math.PI / 2
  cam.position.set(size.x * 0.12, size.y * 0.37, -size.z * 0.06)

  return [body, btn, cam]
}

function buildRouter(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  // Flat body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y * 0.38, size.z * 0.65),
    mat,
  )
  body.position.y = -size.y * 0.22

  // Three antennas
  const antennaH = size.y * 0.58
  const antennaR = Math.min(size.x, size.z) * 0.028
  const positions = [-size.x * 0.32, 0, size.x * 0.32]
  const antennas = positions.map(x => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(antennaR, antennaR * 1.3, antennaH, 8),
      mat,
    )
    m.position.set(x, size.y * 0.06, -size.z * 0.18)
    return m
  })

  return [body, ...antennas]
}

function buildDeskphone(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.82, size.y * 0.50, size.z * 0.78),
    mat,
  )
  body.position.y = -size.y * 0.18

  // Handset — diagonal elongated box
  const handset = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.28, size.y * 0.14, size.z * 0.62),
    mat,
  )
  handset.position.set(size.x * 0.26, size.y * 0.26, 0)
  handset.rotation.z = -0.28

  return [body, handset]
}

function buildWall(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  const ROWS = 3
  const COLS = 4
  const gapX = size.x * 0.022
  const gapY = size.y * 0.06
  const brickW = (size.x - gapX * (COLS + 1)) / COLS
  const brickH = (size.y - gapY * (ROWS + 1)) / ROWS
  const brickD = size.z * 0.55
  const meshes: THREE.Mesh[] = []
  const geo = new THREE.BoxGeometry(brickW * 0.96, brickH * 0.88, brickD)

  for (let r = 0; r < ROWS; r++) {
    const shift = (r % 2) * (brickW + gapX) * 0.5
    const y = -size.y / 2 + gapY + brickH / 2 + r * (brickH + gapY)
    for (let c = -1; c <= COLS; c++) {
      const x = -size.x / 2 + gapX + brickW / 2 + c * (brickW + gapX) + shift
      if (x - brickW / 2 > size.x / 2 || x + brickW / 2 < -size.x / 2) continue
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, 0)
      meshes.push(m)
    }
  }
  return meshes
}

// ── public API ────────────────────────────────────────────────────────────────

export function buildShapeMeshes(
  type: ComponentType,
  shape: ComponentShape | undefined,
  size: THREE.Vector3,
  mat: THREE.MeshStandardMaterial,
): THREE.Mesh[] {
  if (shape) {
    switch (shape) {
      case 'stack':      return buildStack(size, mat)
      case 'cloud':      return buildCloud(size, mat)
      case 'server':     return buildServer(size, mat)
      case 'desktop':    return buildDesktop(size, mat)
      case 'smartphone': return buildSmartphone(size, mat)
      case 'router':     return buildRouter(size, mat)
      case 'deskphone':  return buildDeskphone(size, mat)
      case 'wall':       return buildWall(size, mat)
    }
  }
  return buildTypeMesh(type, size, mat)
}
