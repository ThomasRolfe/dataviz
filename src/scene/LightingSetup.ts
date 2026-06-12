import * as THREE from 'three'
import { THEME_COLORS } from '@/scene/ThemeColors'
import type { Theme } from '@/scene/ThemeColors'

export interface SceneLights {
  ambient: THREE.AmbientLight
  fill:    THREE.DirectionalLight
}

export function setupLighting(scene: THREE.Scene, theme: Theme = 'light'): SceneLights {
  const c = THEME_COLORS[theme]

  const ambient = new THREE.AmbientLight(c.ambientColor, c.ambientIntensity)
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

  const fill = new THREE.DirectionalLight(c.fillColor, c.fillIntensity)
  fill.position.set(10, 10, -10)
  scene.add(fill)

  return { ambient, fill }
}

export function updateLighting(lights: SceneLights, theme: Theme): void {
  const c = THEME_COLORS[theme]
  lights.ambient.color.setHex(c.ambientColor)
  lights.ambient.intensity = c.ambientIntensity
  lights.fill.color.setHex(c.fillColor)
  lights.fill.intensity = c.fillIntensity
}
