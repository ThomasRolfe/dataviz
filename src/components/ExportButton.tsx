import { useState, useCallback } from 'react'
import { exportAnimationGif } from '@/utils/gifExport'
import type { FlowScene } from '@/scene/FlowScene'
import type { StepEngine } from '@/engine/stepEngine'
import styles from '@/styles/ExportButton.module.css'

interface ExportButtonProps {
  scene:  FlowScene | null
  engine: StepEngine | null
}

export function ExportButton({ scene, engine }: ExportButtonProps) {
  const [progress, setProgress] = useState<string | null>(null)

  const handleExport = useCallback(async () => {
    if (!scene || !engine || progress) return

    setProgress('Starting…')

    // Pause any ongoing playback
    engine.pause()

    try {
      const blob = await exportAnimationGif(
        scene,
        engine,
        3000,
        (step, total) => setProgress(`Recording ${step} / ${total}`),
      )

      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = 'flowviz.gif'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('GIF export failed:', err)
    } finally {
      setProgress(null)
    }
  }, [scene, engine, progress])

  const recording = progress !== null

  return (
    <button
      className={`${styles.btn} ${recording ? styles.recording : ''}`}
      onClick={handleExport}
      disabled={recording || !scene || !engine}
      title="Export all steps as an animated GIF"
    >
      {recording ? (
        <>
          <span className={styles.dot} />
          {progress}
        </>
      ) : (
        'Export GIF'
      )}
    </button>
  )
}
