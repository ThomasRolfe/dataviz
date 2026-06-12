export type Theme = 'dark' | 'light'

export interface ThemeConfig {
  clearColor:         number
  gridPrimary:        number
  gridSecondary:      number
  pipeIdle:           number
  pipeActive:         number
  pipeActiveEmissive: number
  packetColor:        number
  ambientColor:       number
  ambientIntensity:   number
  fillColor:          number
  fillIntensity:      number
}

export const THEME_COLORS: Record<Theme, ThemeConfig> = {
  dark: {
    clearColor:         0x1a1a2e,
    gridPrimary:        0x334455,
    gridSecondary:      0x223344,
    pipeIdle:           0x334455,
    pipeActive:         0x4a6a8a,
    pipeActiveEmissive: 0x1a3a5c,
    packetColor:        0x00ffcc,
    ambientColor:       0xffeedd,
    ambientIntensity:   0.6,
    fillColor:          0xaaccff,
    fillIntensity:      0.4,
  },
  light: {
    clearColor:         0xedf0f5,
    gridPrimary:        0xc8d4e0,
    gridSecondary:      0xd8e4ee,
    pipeIdle:           0x8899aa,
    pipeActive:         0x3366aa,
    pipeActiveEmissive: 0x000000,
    packetColor:        0x009966,
    ambientColor:       0xffffff,
    ambientIntensity:   1.4,
    fillColor:          0xaaccff,
    fillIntensity:      0.3,
  },
}
