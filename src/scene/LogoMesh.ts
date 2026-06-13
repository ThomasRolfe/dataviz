import * as THREE from 'three'
import { buildBrandIconMeshes } from '@/scene/IconMesh'

export function buildLogoMeshes(
  logoName: string,
  meshSize: THREE.Vector3,
  boxMat:  THREE.MeshStandardMaterial,
  iconMat: THREE.MeshBasicMaterial,
): THREE.Mesh[] {
  return buildBrandIconMeshes(logoName, meshSize, boxMat, iconMat)
}
