import * as THREE from 'three'
import type { PacketShape, ComponentShape, ComponentType } from '@/types/schema'
import { buildSolidIconMeshes } from '@/scene/IconMesh'

// ── Packet geometry registry ──────────────────────────────────────────────────
// Each factory returns a fresh BufferGeometry. Add new shapes here.

export const PACKET_GEOMETRY_BUILDERS: Record<PacketShape, () => THREE.BufferGeometry> = {
  sphere:   () => new THREE.SphereGeometry(0.35, 16, 8),
  document: () => new THREE.BoxGeometry(0.65, 0.45, 0.12),
  token:    () => new THREE.CylinderGeometry(0.28, 0.28, 0.09, 16),
  blob: () => {
    const g = new THREE.SphereGeometry(0.38, 8, 6)
    g.scale(1.0, 0.7, 0.9)
    return g
  },
  envelope: () => new THREE.BoxGeometry(0.60, 0.42, 0.09),
}

export function buildPacketGeometry(shape: PacketShape): THREE.BufferGeometry {
  return PACKET_GEOMETRY_BUILDERS[shape]()
}

// ── Component shape registry ──────────────────────────────────────────────────
// Each builder returns an array of positioned mesh parts. Add new shapes here.

type ShapeBuilder = (size: THREE.Vector3, mat: THREE.MeshStandardMaterial, iconMat: THREE.MeshBasicMaterial) => THREE.Mesh[]

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
  const configs: Array<[number, number, number]> = [
    [ 0.00,  0.00, 0.80],
    [-0.55,  0.00, 0.55],
    [ 0.55,  0.00, 0.55],
    [-0.28, -0.45, 0.50],
    [ 0.28, -0.45, 0.50],
    [ 0.00,  0.50, 0.42],
  ]
  return configs.map(([xf, zf, rf]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(rf * s, 12, 8), mat)
    m.position.set(xf * s, 0, zf * s)
    m.scale.y = yScale
    return m
  })
}

function buildServer(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  const body = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y * 0.55, size.z * 0.75), mat)
  body.position.y = -size.y * 0.12

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.9, size.y * 0.35, size.z * 0.08), mat)
  bezel.position.set(0, -size.y * 0.12, size.z * 0.38)

  const bay = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.35, size.y * 0.18, size.z * 0.06), mat)
  bay.position.set(-size.x * 0.22, size.y * 0.20, size.z * 0.38)

  return [body, bezel, bay]
}

function buildDesktop(size: THREE.Vector3, mat: THREE.MeshStandardMaterial, iconMat: THREE.MeshBasicMaterial): THREE.Mesh[] {
  return buildSolidIconMeshes('desktop', size, mat, iconMat)
}

function buildSmartphone(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.50, size.y * 0.96, size.z * 0.10), mat)

  const btn = new THREE.Mesh(
    new THREE.CylinderGeometry(size.x * 0.065, size.x * 0.065, size.z * 0.025, 16), mat)
  btn.rotation.x = Math.PI / 2
  btn.position.set(0, -size.y * 0.38, size.z * 0.06)

  const cam = new THREE.Mesh(
    new THREE.CylinderGeometry(size.x * 0.05, size.x * 0.05, size.z * 0.025, 12), mat)
  cam.rotation.x = Math.PI / 2
  cam.position.set(size.x * 0.12, size.y * 0.37, -size.z * 0.06)

  return [body, btn, cam]
}

function buildRouter(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y * 0.38, size.z * 0.65), mat)
  body.position.y = -size.y * 0.22

  const antennaH = size.y * 0.58
  const antennaR = Math.min(size.x, size.z) * 0.028
  const antennas = [-size.x * 0.32, 0, size.x * 0.32].map(x => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(antennaR, antennaR * 1.3, antennaH, 8), mat)
    m.position.set(x, size.y * 0.06, -size.z * 0.18)
    return m
  })

  return [body, ...antennas]
}

function buildDeskphone(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.82, size.y * 0.50, size.z * 0.78), mat)
  body.position.y = -size.y * 0.18

  const handset = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.28, size.y * 0.14, size.z * 0.62), mat)
  handset.position.set(size.x * 0.26, size.y * 0.26, 0)
  handset.rotation.z = -0.28

  return [body, handset]
}

function buildWall(size: THREE.Vector3, mat: THREE.MeshStandardMaterial): THREE.Mesh[] {
  const ROWS = 3
  const COLS = 4
  const gapX  = size.x * 0.022
  const gapY  = size.y * 0.06
  const brickW = (size.x - gapX * (COLS + 1)) / COLS
  const brickH = (size.y - gapY * (ROWS + 1)) / ROWS
  const brickD = size.z * 0.55
  const geo    = new THREE.BoxGeometry(brickW * 0.96, brickH * 0.88, brickD)
  const meshes: THREE.Mesh[] = []

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

export const COMPONENT_SHAPE_BUILDERS: Record<ComponentShape, ShapeBuilder> = {
  stack:      buildStack,
  cloud:      buildCloud,
  server:     buildServer,
  desktop:    buildDesktop,
  smartphone: buildSmartphone,
  router:     buildRouter,
  deskphone:  buildDeskphone,
  wall:       buildWall,
}

const TYPE_ICON: Record<ComponentType, string> = {
  client:   'laptop',
  service:  'server',
  function: 'bolt',
  database: 'database',
  queue:    'layerGroup',
  external: 'globe',
}

function buildTypeMesh(
  type:    ComponentType,
  size:    THREE.Vector3,
  mat:     THREE.MeshStandardMaterial,
  iconMat: THREE.MeshBasicMaterial,
): THREE.Mesh[] {
  return buildSolidIconMeshes(TYPE_ICON[type] ?? 'cube', size, mat, iconMat)
}

export function buildShapeMeshes(
  type:    ComponentType,
  shape:   ComponentShape | undefined,
  size:    THREE.Vector3,
  mat:     THREE.MeshStandardMaterial,
  iconMat: THREE.MeshBasicMaterial,
): THREE.Mesh[] {
  if (shape) {
    const builder = COMPONENT_SHAPE_BUILDERS[shape]
    if (builder) return builder(size, mat, iconMat)
  }
  return buildTypeMesh(type, size, mat, iconMat)
}
