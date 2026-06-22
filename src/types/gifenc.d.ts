declare module 'gifenc' {
  export interface GIFEncoderInstance {
    writeFrame(
      indexedPixels: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][]
        delay?: number
        repeat?: number
        transparent?: number
        transparentIndex?: number
        colorDepth?: number
        dispose?: number
      },
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }

  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GIFEncoderInstance

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: string; oneBitAlpha?: boolean; clearAlpha?: boolean; clearAlphaColor?: number; clearAlphaThreshold?: number },
  ): number[][]

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    opts?: { format?: string },
  ): Uint8Array
}
