import * as THREE from 'three'

export function setupLighting(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight(0xffeedd, 0.6)
  scene.add(ambient)

  const key = new THREE.DirectionalLight(0xffffff, 1.2)
  key.position.set(-10, 20, 10)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 200
  key.shadow.camera.left = -40
  key.shadow.camera.right = 40
  key.shadow.camera.top = 40
  key.shadow.camera.bottom = -40
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xaaccff, 0.4)
  fill.position.set(10, 10, -10)
  scene.add(fill)
}
