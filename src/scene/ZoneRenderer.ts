import * as THREE from 'three'
import type { InternalZone } from '@/types/internal'

export class ZoneRenderer {
  private fillMesh:   THREE.Mesh
  private borderMesh: THREE.LineSegments
  private labelMesh:  THREE.Mesh

  constructor(scene: THREE.Scene, zone: InternalZone) {
    const width = zone.max.x - zone.min.x
    const depth = zone.max.z - zone.min.z

    const geometry = new THREE.PlaneGeometry(width, depth)
    geometry.rotateX(-Math.PI / 2)

    const fill = new THREE.MeshStandardMaterial({
      color:       zone.color,
      transparent: true,
      opacity:     0.12,
      depthWrite:  false,
    })
    this.fillMesh = new THREE.Mesh(geometry, fill)
    this.fillMesh.position.set(
      (zone.min.x + zone.max.x) / 2,
      -0.08,
      (zone.min.z + zone.max.z) / 2
    )
    this.fillMesh.receiveShadow = true
    scene.add(this.fillMesh)

    // Border
    const edges = new THREE.EdgesGeometry(geometry)
    this.borderMesh = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: zone.color, opacity: 0.6, transparent: true })
    )
    this.borderMesh.position.copy(this.fillMesh.position)
    this.borderMesh.position.y += 0.01
    scene.add(this.borderMesh)

    // Label — flat canvas-texture plane sitting on the ground at the top-left of the zone
    this.labelMesh = this.buildLabelMesh(zone)
    scene.add(this.labelMesh)
  }

  private buildLabelMesh(zone: InternalZone): THREE.Mesh {
    const DPR        = 2
    const fontPx     = 22 * DPR
    const padX       = 14 * DPR
    const padY       = 8  * DPR
    const hexColor   = '#' + zone.color.getHexString()
    const labelText  = zone.label.toUpperCase()

    const canvas = document.createElement('canvas')
    const ctx    = canvas.getContext('2d')!

    ctx.font = `700 ${fontPx}px system-ui, -apple-system, sans-serif`
    const textW   = ctx.measureText(labelText).width
    canvas.width  = Math.ceil(textW) + padX * 2
    canvas.height = fontPx + padY * 2

    // Zone-colored background
    ctx.fillStyle  = hexColor
    ctx.globalAlpha = 0.88
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 1

    // White text centered vertically
    ctx.font         = `700 ${fontPx}px system-ui, -apple-system, sans-serif`
    ctx.fillStyle    = 'rgba(255,255,255,0.95)'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelText, padX, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)

    const labelH = 0.75
    const labelW = (canvas.width / canvas.height) * labelH

    const geo = new THREE.PlaneGeometry(labelW, labelH)
    geo.rotateX(-Math.PI / 2)

    const mat = new THREE.MeshBasicMaterial({
      map:         texture,
      transparent: true,
      depthWrite:  false,
    })

    const mesh = new THREE.Mesh(geo, mat)
    // Sit just inside the top (near) edge of the zone, left-aligned
    mesh.position.set(
      zone.min.x + labelW / 2 + 0.3,
      0.02,
      zone.min.z + labelH / 2 + 0.1,
    )
    return mesh
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.fillMesh)
    scene.remove(this.borderMesh)
    scene.remove(this.labelMesh)
    this.fillMesh.geometry.dispose()
    ;(this.fillMesh.material as THREE.Material).dispose()
    this.borderMesh.geometry.dispose()
    ;(this.borderMesh.material as THREE.Material).dispose()
    this.labelMesh.geometry.dispose()
    ;(this.labelMesh.material as THREE.MeshBasicMaterial).map?.dispose()
    ;(this.labelMesh.material as THREE.Material).dispose()
  }
}
