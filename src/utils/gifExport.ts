import { GIFEncoder, quantize, applyPalette } from 'gifenc'

const MAX_GIF_WIDTH = 960

interface ExportTarget {
  captureFrame(): string
}

interface ExportEngine {
  goTo(index: number): void
  getState(): { totalSteps: number }
}

function scaleCanvas(
  source: HTMLCanvasElement,
  maxWidth: number,
): HTMLCanvasElement {
  const ratio = Math.min(1, maxWidth / source.width)
  const w = Math.round(source.width  * ratio)
  const h = Math.round(source.height * ratio)
  const out = document.createElement('canvas')
  out.width  = w
  out.height = h
  out.getContext('2d')!.drawImage(source, 0, 0, w, h)
  return out
}

async function dataURLToCanvas(dataURL: string): Promise<HTMLCanvasElement> {
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload  = () => resolve()
    img.onerror = reject
    img.src = dataURL
  })
  const c   = document.createElement('canvas')
  c.width   = img.naturalWidth
  c.height  = img.naturalHeight
  c.getContext('2d')!.drawImage(img, 0, 0)
  return c
}

export async function exportAnimationGif(
  scene:      ExportTarget,
  engine:     ExportEngine,
  msPerStep:  number = 3000,
  onProgress: (step: number, total: number) => void = () => {},
): Promise<Blob> {
  const total = engine.getState().totalSteps
  const gif   = GIFEncoder()

  for (let i = 0; i < total; i++) {
    engine.goTo(i)
    onProgress(i + 1, total)

    // Wait for packet animations and camera tweens to settle
    await new Promise<void>(r => setTimeout(r, msPerStep))

    const dataURL = scene.captureFrame()
    const raw     = await dataURLToCanvas(dataURL)
    const scaled  = scaleCanvas(raw, MAX_GIF_WIDTH)

    const ctx       = scaled.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, scaled.width, scaled.height)

    const palette  = quantize(imageData.data, 256)
    const indices  = applyPalette(imageData.data, palette)
    gif.writeFrame(indices, scaled.width, scaled.height, { palette, delay: msPerStep })
  }

  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}
